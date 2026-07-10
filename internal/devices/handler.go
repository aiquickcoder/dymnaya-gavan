// Package devices manages staff push-token registration for the staff mobile app.
// On login / app start the app upserts its FCM token here; on logout it removes it.
// The calls domain reads on-shift tokens to fan out guest-call pushes.
package devices

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"mixmaster/internal/db"
	"mixmaster/internal/httpx"
)

// Handler groups the /devices endpoints.
type Handler struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

// New creates a devices Handler.
func New(pool *pgxpool.Pool, q *db.Queries) *Handler { return &Handler{pool: pool, q: q} }

// Routes mounts the devices subtree (called via r.Route("/devices", …)).
func (h *Handler) Routes(r chi.Router) {
	r.Post("/register", h.Register)
	r.Post("/unregister", h.Unregister)
}

// RegisterRequest binds a device's FCM token to a staff member + venue.
type RegisterRequest struct {
	EmployeeID   uuid.UUID `json:"employeeId"`
	RestaurantID uuid.UUID `json:"restaurantId"`
	Platform     string    `json:"platform"` // ios | android
	Token        string    `json:"token"`
}

// Register godoc
//
//	@Summary	Register/refresh a staff device FCM token
//	@Tags		devices
//	@Accept		json
//	@Produce	json
//	@Param		body	body		devices.RegisterRequest	true	"Device"
//	@Success	200		{object}	httpx.Envelope
//	@Router		/devices/register [post]
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if req.EmployeeID == uuid.Nil || req.RestaurantID == uuid.Nil || req.Token == "" {
		httpx.Error(w, http.StatusBadRequest, "validation", "employeeId, restaurantId and token are required")
		return
	}
	platform := "android"
	if req.Platform == "ios" {
		platform = "ios"
	}
	d, err := h.q.RegisterDevice(r.Context(), db.RegisterDeviceParams{
		EmployeeID:   req.EmployeeID,
		RestaurantID: req.RestaurantID,
		Platform:     platform,
		FcmToken:     req.Token,
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"id": d.ID})
}

// UnregisterRequest drops a device token.
type UnregisterRequest struct {
	Token string `json:"token"`
}

// Unregister godoc
//
//	@Summary	Remove a staff device FCM token (logout)
//	@Tags		devices
//	@Accept		json
//	@Produce	json
//	@Param		body	body	devices.UnregisterRequest	true	"Token"
//	@Success	204		{object}	nil
//	@Router		/devices/unregister [post]
func (h *Handler) Unregister(w http.ResponseWriter, r *http.Request) {
	var req UnregisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if req.Token == "" {
		httpx.Error(w, http.StatusBadRequest, "validation", "token is required")
		return
	}
	if err := h.q.DeleteDevice(r.Context(), req.Token); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
