// Package calls implements the guest-call domain ("Обращения"): a guest taps
// "Позвать" at their table (master/coals/waiter/bill) → a call lands in the admin
// feed, where staff acknowledge (new → ack) and complete it (→ done). There is no
// table domain yet, so table_id carries the guest's table label; tableLabel echoes it.
package calls

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"mixmaster/internal/db"
	"mixmaster/internal/httpx"
	"mixmaster/internal/push"
)

// WebPushNotifier fans a guest-call out to subscribed browsers (CRM/PWA).
// Primitive-typed so calls doesn't import the webpush package's types.
type WebPushNotifier interface {
	Notify(ctx context.Context, title, body, targetURL, tag string)
}

// Handler groups the /calls endpoints.
type Handler struct {
	pool *pgxpool.Pool
	q    *db.Queries
	push push.Sender
	wp   WebPushNotifier
}

// New creates a calls Handler. sender fans out guest-call pushes to staff devices
// (FCM); wp fans out the same call to subscribed browsers (Web Push).
func New(pool *pgxpool.Pool, q *db.Queries, sender push.Sender, wp WebPushNotifier) *Handler {
	return &Handler{pool: pool, q: q, push: sender, wp: wp}
}

// Routes mounts the calls subtree (called via r.Route("/calls", …)).
func (h *Handler) Routes(r chi.Router) {
	r.Post("/", h.Create)
	r.Post("/list", h.ListActive)
	r.Post("/archive", h.ListArchive)
	r.Post("/{id}/ack", h.Ack)
	r.Post("/{id}/done", h.Done)
}

// CallResponse is the admin/guest view of a call (camelCase; mirrors the web Call
// type). TableLabel duplicates TableID until a table domain exists.
type CallResponse struct {
	ID           uuid.UUID  `json:"id"`
	RestaurantID uuid.UUID  `json:"restaurantId"`
	TableID      string     `json:"tableId"`
	TableLabel   *string    `json:"tableLabel"`
	Type         string     `json:"type"`
	Status       string     `json:"status"`
	CreatedAt    time.Time  `json:"createdAt"`
	AckedAt      *time.Time `json:"ackedAt"`
	DoneAt       *time.Time `json:"doneAt"`
}

func toCallResponse(c db.Call) CallResponse {
	label := c.TableID // no table domain yet — label == stored id
	return CallResponse{
		ID:           c.ID,
		RestaurantID: c.RestaurantID,
		TableID:      c.TableID,
		TableLabel:   &label,
		Type:         c.Type,
		Status:       c.Status,
		CreatedAt:    c.CreatedAt,
		AckedAt:      c.AckedAt,
		DoneAt:       c.DoneAt,
	}
}

// CreateCallRequest is a guest raising a call from their table.
type CreateCallRequest struct {
	RestaurantID uuid.UUID `json:"restaurantId"`
	TableID      string    `json:"tableId"`
	Type         string    `json:"type"`
}

var validCallTypes = map[string]bool{"master": true, "coals": true, "waiter": true, "bill": true}

// Create godoc
//
//	@Summary	Raise a call from a table (master/coals/waiter/bill)
//	@Tags		calls
//	@Accept		json
//	@Produce	json
//	@Param		body	body		calls.CreateCallRequest	true	"Call"
//	@Success	201		{object}	httpx.Envelope{data=calls.CallResponse}
//	@Failure	400		{object}	httpx.Envelope
//	@Router		/calls [post]
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateCallRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if req.RestaurantID == uuid.Nil || req.TableID == "" {
		httpx.Error(w, http.StatusBadRequest, "validation", "restaurantId and tableId are required")
		return
	}
	if !validCallTypes[req.Type] {
		httpx.Error(w, http.StatusBadRequest, "validation", "type must be one of master, coals, waiter, bill")
		return
	}
	c, err := h.q.CreateCall(r.Context(), db.CreateCallParams{
		RestaurantID: req.RestaurantID,
		TableID:      req.TableID,
		Type:         req.Type,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			httpx.Error(w, http.StatusBadRequest, "invalid_reference", "restaurant does not exist")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	h.notify(c)
	httpx.JSON(w, http.StatusCreated, toCallResponse(c))
}

// notify fans out a push to on-shift staff devices — best-effort and async so the
// guest response is never blocked by push delivery.
func (h *Handler) notify(c db.Call) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
		defer cancel()

		// Web Push to subscribed browsers (CRM/PWA) — always attempt.
		if h.wp != nil {
			h.wp.Notify(ctx, push.Title(c.TableID), push.Body(c.Type), "/admin/calls", "call-"+c.ID.String())
		}

		tokens, err := h.q.ListOnShiftDeviceTokens(ctx, c.RestaurantID)
		if err != nil {
			log.Printf("[calls] push: list tokens: %v", err)
			return
		}
		if len(tokens) == 0 {
			return
		}
		if err := h.push.SendCall(ctx, tokens, push.CallNotification{
			CallID:       c.ID.String(),
			RestaurantID: c.RestaurantID.String(),
			TableID:      c.TableID,
			Type:         c.Type,
		}); err != nil {
			log.Printf("[calls] push: send: %v", err)
		}
	}()
}

// ListRequest identifies a venue.
type ListRequest struct {
	RestaurantID uuid.UUID `json:"restaurantId"`
}

// ListActive godoc
//
//	@Summary	Active calls of a venue (new + ack, freshest first)
//	@Tags		calls
//	@Accept		json
//	@Produce	json
//	@Param		body	body		calls.ListRequest	true	"restaurantId"
//	@Success	200		{object}	httpx.Envelope{data=[]calls.CallResponse}
//	@Router		/calls/list [post]
func (h *Handler) ListActive(w http.ResponseWriter, r *http.Request) {
	rid, ok := h.decodeRID(w, r)
	if !ok {
		return
	}
	rows, err := h.q.ListActiveCalls(r.Context(), rid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	h.writeCalls(w, rows)
}

// ListArchive godoc
//
//	@Summary	Completed calls of a venue (most recently done first)
//	@Tags		calls
//	@Accept		json
//	@Produce	json
//	@Param		body	body		calls.ListRequest	true	"restaurantId"
//	@Success	200		{object}	httpx.Envelope{data=[]calls.CallResponse}
//	@Router		/calls/archive [post]
func (h *Handler) ListArchive(w http.ResponseWriter, r *http.Request) {
	rid, ok := h.decodeRID(w, r)
	if !ok {
		return
	}
	rows, err := h.q.ListArchiveCalls(r.Context(), rid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	h.writeCalls(w, rows)
}

// Ack godoc
//
//	@Summary	Acknowledge a call (new → ack)
//	@Tags		calls
//	@Produce	json
//	@Param		id	path		string	true	"Call ID"
//	@Success	204	{object}	nil
//	@Router		/calls/{id}/ack [post]
func (h *Handler) Ack(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	if err := h.q.AckCall(r.Context(), id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Done godoc
//
//	@Summary	Complete a call (→ done)
//	@Tags		calls
//	@Produce	json
//	@Param		id	path		string	true	"Call ID"
//	@Success	204	{object}	nil
//	@Router		/calls/{id}/done [post]
func (h *Handler) Done(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	if err := h.q.DoneCall(r.Context(), id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- helpers ----

func (h *Handler) decodeRID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	var req ListRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return uuid.Nil, false
	}
	if req.RestaurantID == uuid.Nil {
		httpx.Error(w, http.StatusBadRequest, "validation", "restaurantId is required")
		return uuid.Nil, false
	}
	return req.RestaurantID, true
}

func (h *Handler) writeCalls(w http.ResponseWriter, rows []db.Call) {
	out := make([]CallResponse, 0, len(rows))
	for _, c := range rows {
		out = append(out, toCallResponse(c))
	}
	httpx.JSON(w, http.StatusOK, out)
}

func parseID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid call id")
		return uuid.Nil, false
	}
	return id, true
}
