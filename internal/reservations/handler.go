// Package reservations implements the table-booking domain ("Брони"):
// create/patch a reservation, list a venue's bookings (optionally by day),
// change status, and delete. There is no table domain yet, so table_id stores
// the table's label (e.g. "7") and tableLabel echoes it back for display.
package reservations

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"mixmaster/internal/db"
	"mixmaster/internal/httpx"
)

// Handler groups the /reservations endpoints.
type Handler struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

// New creates a reservations Handler.
func New(pool *pgxpool.Pool, q *db.Queries) *Handler {
	return &Handler{pool: pool, q: q}
}

// Routes mounts the reservations subtree (called via r.Route("/reservations", …)).
func (h *Handler) Routes(r chi.Router) {
	r.Post("/", h.Create)
	r.Post("/list", h.List)
	r.Patch("/{id}", h.Update)
	r.Post("/{id}/status", h.SetStatus)
	r.Delete("/{id}", h.Delete)
}

const dateLayout = "2006-01-02"

// ReservationResponse is the admin/guest view of a booking (camelCase; mirrors the
// web Reservation type). TableLabel duplicates TableID until a table domain exists.
type ReservationResponse struct {
	ID           uuid.UUID `json:"id"`
	RestaurantID uuid.UUID `json:"restaurantId"`
	GuestName    string    `json:"guestName"`
	Phone        string    `json:"phone"`
	Date         string    `json:"date"`    // YYYY-MM-DD
	Time         string    `json:"time"`    // HH:MM — start
	EndTime      string    `json:"endTime"` // HH:MM — end
	TableID      *string   `json:"tableId"`
	TableLabel   *string   `json:"tableLabel"`
	Guests       int32     `json:"guests"`
	Zone         *string   `json:"zone"`
	Status       string    `json:"status"`
	Note         *string   `json:"note"`
	CreatedAt    time.Time `json:"createdAt"`
}

func toReservationResponse(r db.Reservation) ReservationResponse {
	return ReservationResponse{
		ID:           r.ID,
		RestaurantID: r.RestaurantID,
		GuestName:    r.GuestName,
		Phone:        r.Phone,
		Date:         r.ResDate.Format(dateLayout),
		Time:         r.StartTime,
		EndTime:      r.EndTime,
		TableID:      r.TableID,
		TableLabel:   r.TableID, // no table domain yet — label == stored id
		Guests:       r.Guests,
		Zone:         r.Zone,
		Status:       r.Status,
		Note:         r.Note,
		CreatedAt:    r.CreatedAt,
	}
}

// CreateReservationRequest is a new booking. guestName/date/time are required.
type CreateReservationRequest struct {
	RestaurantID uuid.UUID `json:"restaurantId"`
	GuestName    string    `json:"guestName"`
	Phone        string    `json:"phone"`
	Date         string    `json:"date"`
	Time         string    `json:"time"`
	EndTime      string    `json:"endTime"`
	TableID      *string   `json:"tableId"`
	Guests       int32     `json:"guests"`
	Zone         *string   `json:"zone"`
	Status       string    `json:"status"`
	Note         *string   `json:"note"`
}

// Create godoc
//
//	@Summary	Create a table reservation
//	@Tags		reservations
//	@Accept		json
//	@Produce	json
//	@Param		body	body		reservations.CreateReservationRequest	true	"Booking"
//	@Success	201		{object}	httpx.Envelope{data=reservations.ReservationResponse}
//	@Failure	400		{object}	httpx.Envelope
//	@Router		/reservations [post]
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateReservationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if req.RestaurantID == uuid.Nil || req.GuestName == "" || req.Date == "" || req.Time == "" {
		httpx.Error(w, http.StatusBadRequest, "validation", "restaurantId, guestName, date and time are required")
		return
	}
	day, err := time.Parse(dateLayout, req.Date)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid date (want YYYY-MM-DD)")
		return
	}
	status := req.Status
	if status == "" {
		status = "new"
	}
	end := req.EndTime
	if end == "" {
		end = req.Time
	}
	guests := req.Guests
	if guests <= 0 {
		guests = 2
	}

	res, err := h.q.CreateReservation(r.Context(), db.CreateReservationParams{
		RestaurantID: req.RestaurantID,
		GuestName:    req.GuestName,
		Phone:        req.Phone,
		ResDate:      day,
		StartTime:    req.Time,
		EndTime:      end,
		TableID:      req.TableID,
		Guests:       guests,
		Zone:         req.Zone,
		Status:       status,
		Note:         req.Note,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23514" { // status check
			httpx.Error(w, http.StatusBadRequest, "validation", "invalid status")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, toReservationResponse(res))
}

// UpdateReservationRequest is a partial update; only non-null fields change.
type UpdateReservationRequest struct {
	GuestName *string `json:"guestName"`
	Phone     *string `json:"phone"`
	Date      *string `json:"date"`
	Time      *string `json:"time"`
	EndTime   *string `json:"endTime"`
	TableID   *string `json:"tableId"`
	Guests    *int32  `json:"guests"`
	Zone      *string `json:"zone"`
	Status    *string `json:"status"`
	Note      *string `json:"note"`
}

// Update godoc
//
//	@Summary	Update a reservation (partial)
//	@Tags		reservations
//	@Accept		json
//	@Produce	json
//	@Param		id		path		string									true	"Reservation ID"
//	@Param		body	body		reservations.UpdateReservationRequest	true	"Fields to change"
//	@Success	200		{object}	httpx.Envelope{data=reservations.ReservationResponse}
//	@Failure	404		{object}	httpx.Envelope
//	@Router		/reservations/{id} [patch]
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var req UpdateReservationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	var resDate *time.Time
	if req.Date != nil && *req.Date != "" {
		day, err := time.Parse(dateLayout, *req.Date)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid date (want YYYY-MM-DD)")
			return
		}
		resDate = &day
	}
	res, err := h.q.UpdateReservation(r.Context(), db.UpdateReservationParams{
		ID:        id,
		GuestName: req.GuestName,
		Phone:     req.Phone,
		ResDate:   resDate,
		StartTime: req.Time,
		EndTime:   req.EndTime,
		TableID:   req.TableID,
		Guests:    req.Guests,
		Zone:      req.Zone,
		Status:    req.Status,
		Note:      req.Note,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "not_found", "reservation not found")
		return
	}
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23514" {
			httpx.Error(w, http.StatusBadRequest, "validation", "invalid status")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, toReservationResponse(res))
}

// ListReservationsRequest lists a venue's bookings, optionally for one day.
type ListReservationsRequest struct {
	RestaurantID uuid.UUID `json:"restaurantId"`
	Date         *string   `json:"date"`
}

// List godoc
//
//	@Summary	List reservations of a venue (optionally by day)
//	@Tags		reservations
//	@Accept		json
//	@Produce	json
//	@Param		body	body		reservations.ListReservationsRequest	true	"restaurantId + optional date"
//	@Success	200		{object}	httpx.Envelope{data=[]reservations.ReservationResponse}
//	@Router		/reservations/list [post]
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	var req ListReservationsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if req.RestaurantID == uuid.Nil {
		httpx.Error(w, http.StatusBadRequest, "validation", "restaurantId is required")
		return
	}
	var resDate *time.Time
	if req.Date != nil && *req.Date != "" {
		day, err := time.Parse(dateLayout, *req.Date)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid date (want YYYY-MM-DD)")
			return
		}
		resDate = &day
	}
	rows, err := h.q.ListReservations(r.Context(), db.ListReservationsParams{
		RestaurantID: req.RestaurantID,
		ResDate:      resDate,
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	out := make([]ReservationResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, toReservationResponse(row))
	}
	httpx.JSON(w, http.StatusOK, out)
}

// SetStatusRequest changes a reservation's status.
type SetStatusRequest struct {
	Status string `json:"status"`
}

// SetStatus godoc
//
//	@Summary	Set a reservation's status
//	@Tags		reservations
//	@Accept		json
//	@Produce	json
//	@Param		id		path	string							true	"Reservation ID"
//	@Param		body	body	reservations.SetStatusRequest	true	"status"
//	@Success	204		{object}	nil
//	@Router		/reservations/{id}/status [post]
func (h *Handler) SetStatus(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var req SetStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if err := h.q.SetReservationStatus(r.Context(), db.SetReservationStatusParams{ID: id, Status: req.Status}); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23514" {
			httpx.Error(w, http.StatusBadRequest, "validation", "invalid status")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Delete godoc
//
//	@Summary	Delete a reservation
//	@Tags		reservations
//	@Produce	json
//	@Param		id	path		string	true	"Reservation ID"
//	@Success	204	{object}	nil
//	@Router		/reservations/{id} [delete]
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	if err := h.q.DeleteReservation(r.Context(), id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func parseID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid reservation id")
		return uuid.Nil, false
	}
	return id, true
}
