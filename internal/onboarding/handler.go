// Package onboarding receives filled setup briefs from prospective venues (the
// public onboarding form) and lists them for the admin inbox.
package onboarding

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"mixmaster/internal/db"
	"mixmaster/internal/httpx"
)

// Handler groups the /onboarding endpoints.
type Handler struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

// New creates an onboarding Handler.
func New(pool *pgxpool.Pool, q *db.Queries) *Handler { return &Handler{pool: pool, q: q} }

// Routes mounts the onboarding subtree (called via r.Route("/onboarding", …)).
func (h *Handler) Routes(r chi.Router) {
	r.Post("/", h.Create)
	r.Get("/", h.List)
}

// CreateRequest is a filled brief. payload carries the full form answers as JSON.
type CreateRequest struct {
	Venue   string          `json:"venue"`
	City    string          `json:"city"`
	Contact string          `json:"contact"`
	Phone   string          `json:"phone"`
	Payload json.RawMessage `json:"payload"`
}

// BriefResponse is the admin/inbox view of a stored brief.
type BriefResponse struct {
	ID        uuid.UUID       `json:"id"`
	Venue     string          `json:"venue"`
	City      string          `json:"city"`
	Contact   string          `json:"contact"`
	Phone     string          `json:"phone"`
	Status    string          `json:"status"`
	Payload   json.RawMessage `json:"payload"`
	CreatedAt time.Time       `json:"createdAt"`
}

func toResp(b db.OnboardingBrief) BriefResponse {
	p := json.RawMessage(b.Payload)
	if len(p) == 0 {
		p = json.RawMessage("{}")
	}
	return BriefResponse{
		ID:        b.ID,
		Venue:     b.Venue,
		City:      b.City,
		Contact:   b.Contact,
		Phone:     b.Phone,
		Status:    b.Status,
		Payload:   p,
		CreatedAt: b.CreatedAt,
	}
}

// Create godoc
//
//	@Summary	Submit a filled onboarding brief
//	@Tags		onboarding
//	@Accept		json
//	@Produce	json
//	@Param		body	body		onboarding.CreateRequest	true	"Brief"
//	@Success	201		{object}	httpx.Envelope{data=onboarding.BriefResponse}
//	@Router		/onboarding [post]
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	payload := []byte(req.Payload)
	if len(payload) == 0 {
		payload = []byte("{}")
	}
	b, err := h.q.CreateBrief(r.Context(), db.CreateBriefParams{
		Venue:   req.Venue,
		City:    req.City,
		Contact: req.Contact,
		Phone:   req.Phone,
		Payload: payload,
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, toResp(b))
}

// List godoc
//
//	@Summary	List submitted onboarding briefs (admin inbox)
//	@Tags		onboarding
//	@Produce	json
//	@Success	200	{object}	httpx.Envelope{data=[]onboarding.BriefResponse}
//	@Router		/onboarding [get]
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	rows, err := h.q.ListBriefs(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	out := make([]BriefResponse, 0, len(rows))
	for _, b := range rows {
		out = append(out, toResp(b))
	}
	httpx.JSON(w, http.StatusOK, out)
}
