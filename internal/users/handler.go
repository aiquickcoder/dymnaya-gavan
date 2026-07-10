// Package users implements the guest (client) domain: registration and favourites.
package users

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"mixmaster/internal/db"
	"mixmaster/internal/httpx"
)

// Handler wires the users/favourites HTTP endpoints to the data layer.
type Handler struct {
	q *db.Queries
}

// New creates a users Handler.
func New(q *db.Queries) *Handler {
	return &Handler{q: q}
}

// Routes mounts the users sub-router.
func (h *Handler) Routes(r chi.Router) {
	r.Post("/", h.Register)
	r.Get("/{id}", h.Get)
	r.Get("/{id}/summary", h.Summary) // guest card: aggregates (visits/ltv/…)
	r.Get("/{id}/visits", h.Visits)   // guest visit history
	r.Get("/{id}/favourites", h.ListFavourites)
	r.Post("/{id}/favourites", h.AddFavourite)
	r.Delete("/{id}/favourites/{orderRecipeId}", h.RemoveFavourite)
}

// RegisterRequest is the body for guest registration.
type RegisterRequest struct {
	PhoneNumber string  `json:"phoneNumber" example:"+79991234567"`
	Gender      *string `json:"gender,omitempty" example:"male"`
}

// UserResponse is the public view of a guest.
type UserResponse struct {
	ID          uuid.UUID `json:"id"`
	PhoneNumber string    `json:"phoneNumber"`
	Gender      *string   `json:"gender,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}

// Register godoc
//
//	@Summary	Register a guest
//	@Tags		users
//	@Accept		json
//	@Produce	json
//	@Param		body	body		RegisterRequest	true	"Guest data"
//	@Success	201		{object}	httpx.Envelope{data=users.UserResponse}
//	@Failure	400		{object}	httpx.Envelope
//	@Router		/users [post]
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if req.PhoneNumber == "" {
		httpx.Error(w, http.StatusBadRequest, "validation", "phoneNumber is required")
		return
	}

	u, err := h.q.CreateUser(r.Context(), db.CreateUserParams{
		PhoneNumber: req.PhoneNumber,
		Gender:      req.Gender,
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, toUserResponse(u))
}

// Get godoc
//
//	@Summary	Get guest data
//	@Tags		users
//	@Produce	json
//	@Param		id	path		string	true	"User ID"
//	@Success	200	{object}	httpx.Envelope{data=users.UserResponse}
//	@Failure	404	{object}	httpx.Envelope
//	@Router		/users/{id} [get]
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid user id")
		return
	}
	u, err := h.q.GetUser(r.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "not_found", "user not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, toUserResponse(u))
}

// ComponentView is a single recipe component in a favourite.
type ComponentView struct {
	Brand   string `json:"brand"`
	Flavour string `json:"flavour"`
	Percent int32  `json:"percent"`
}

// FavouriteView is an enriched favourite: recipe, components and author (rules R2.4, R5.5).
type FavouriteView struct {
	OrderRecipeID  uuid.UUID       `json:"orderRecipeId"`
	RecipeID       uuid.UUID       `json:"recipeId"`
	RecipeName     *string         `json:"recipeName,omitempty"`
	Strength       *int32          `json:"strength,omitempty"`
	IsSecret       bool            `json:"isSecret"`
	RestaurantID   uuid.UUID       `json:"restaurantId"`
	RestaurantName string          `json:"restaurantName"`
	AuthorFullName string          `json:"authorFullName"`
	AuthorShort    string          `json:"authorShortName"`
	Components     []ComponentView `json:"components"`
	MyScore        *int32          `json:"myScore,omitempty"`
	MyReview       *string         `json:"myReview,omitempty"`
	LikedAt        time.Time       `json:"likedAt"`
}

// ListFavourites godoc
//
//	@Summary	List guest favourites (enriched: restaurant, components, author)
//	@Tags		users
//	@Produce	json
//	@Param		id	path		string	true	"User ID"
//	@Success	200	{object}	httpx.Envelope{data=[]users.FavouriteView}
//	@Router		/users/{id}/favourites [get]
func (h *Handler) ListFavourites(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid user id")
		return
	}
	rows, err := h.q.ListFavourites(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	out := make([]FavouriteView, 0, len(rows))
	for _, row := range rows {
		comps, err := h.q.ListComponentsByRecipeID(r.Context(), row.RecipeID)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
			return
		}
		cv := make([]ComponentView, 0, len(comps))
		for _, c := range comps {
			cv = append(cv, ComponentView{Brand: c.Brand, Flavour: c.Flavour, Percent: c.Percent})
		}
		out = append(out, FavouriteView{
			OrderRecipeID:  row.OrderRecipeID,
			RecipeID:       row.RecipeID,
			RecipeName:     row.RecipeName,
			Strength:       row.RecipeStrength,
			IsSecret:       row.RecipeIsSecret,
			RestaurantID:   row.RestaurantID,
			RestaurantName: row.RestaurantName,
			AuthorFullName: fullName(row.LastName, row.FirstName, row.MiddleName),
			AuthorShort:    row.ShortName,
			Components:     cv,
			MyScore:        row.MyScore,
			MyReview:       row.MyReview,
			LikedAt:        row.LikedAt,
		})
	}
	httpx.JSON(w, http.StatusOK, out)
}

// AddFavouriteRequest is the body for adding a favourite.
type AddFavouriteRequest struct {
	OrderRecipeID uuid.UUID `json:"orderRecipeId"`
}

// AddFavourite godoc
//
//	@Summary	Add a recipe to favourites
//	@Tags		users
//	@Accept		json
//	@Produce	json
//	@Param		id		path		string				true	"User ID"
//	@Param		body	body		AddFavouriteRequest	true	"OrderRecipe to like"
//	@Success	204		{object}	nil
//	@Router		/users/{id}/favourites [post]
func (h *Handler) AddFavourite(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid user id")
		return
	}
	var req AddFavouriteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if err := h.q.AddFavourite(r.Context(), db.AddFavouriteParams{
		UserID:        id,
		OrderRecipeID: req.OrderRecipeID,
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// RemoveFavourite godoc
//
//	@Summary	Remove a recipe from favourites
//	@Tags		users
//	@Produce	json
//	@Param		id				path	string	true	"User ID"
//	@Param		orderRecipeId	path	string	true	"OrderRecipe ID"
//	@Success	204				{object}	nil
//	@Router		/users/{id}/favourites/{orderRecipeId} [delete]
func (h *Handler) RemoveFavourite(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid user id")
		return
	}
	orid, err := uuid.Parse(chi.URLParam(r, "orderRecipeId"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid orderRecipe id")
		return
	}
	if err := h.q.RemoveFavourite(r.Context(), db.RemoveFavouriteParams{
		UserID:        id,
		OrderRecipeID: orid,
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- guests (admin) ----
//
// A "guest" is a user seen through a venue's orders. NB: order price is not
// persisted on the order yet, so ltv/ltvMonth/total are backend APPROXIMATIONS
// (see internal/db/queries/guests.sql). Real revenue is the analytics wave.

// GuestSummary is the admin card for one guest (matches the web GuestSummary).
type GuestSummary struct {
	ID           uuid.UUID  `json:"id"`
	Name         *string    `json:"name,omitempty"` // users have no name yet → always null
	PhoneNumber  string     `json:"phoneNumber"`
	Visits       int32      `json:"visits"`
	LastVisit    *time.Time `json:"lastVisit,omitempty"`
	FavouriteMix *string    `json:"favouriteMix,omitempty"`
	AvgScore     *float64   `json:"avgScore,omitempty"`
	Ltv          float64    `json:"ltv"`
	LtvMonth     float64    `json:"ltvMonth"`
	CreatedAt    time.Time  `json:"createdAt"`
}

// Visit is one entry in a guest's visit history (matches the web Visit).
type Visit struct {
	OrderID    uuid.UUID `json:"orderId"`
	Date       time.Time `json:"date"`
	TableLabel string    `json:"tableLabel"`
	Mixes      []string  `json:"mixes"`
	Master     *string   `json:"master,omitempty"`
	Total      float64   `json:"total"`
	Score      *float64  `json:"score,omitempty"`
}

// Summary godoc
//
//	@Summary	Guest aggregate summary (visits, ltv, favourite mix, avg score)
//	@Tags		users
//	@Produce	json
//	@Param		id	path		string	true	"User ID"
//	@Success	200	{object}	httpx.Envelope{data=users.GuestSummary}
//	@Failure	404	{object}	httpx.Envelope
//	@Router		/users/{id}/summary [get]
func (h *Handler) Summary(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid user id")
		return
	}
	row, err := h.q.GetGuestSummary(r.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "not_found", "user not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, guestSummaryFromSummaryRow(row))
}

// Visits godoc
//
//	@Summary	Guest visit history (orders with mixes, master, total, score)
//	@Tags		users
//	@Produce	json
//	@Param		id	path		string	true	"User ID"
//	@Success	200	{object}	httpx.Envelope{data=[]users.Visit}
//	@Router		/users/{id}/visits [get]
func (h *Handler) Visits(w http.ResponseWriter, r *http.Request) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid user id")
		return
	}
	rows, err := h.q.ListOrdersByUser(r.Context(), &id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	out := make([]Visit, 0, len(rows))
	for _, o := range rows {
		out = append(out, Visit{
			OrderID:    o.OrderID,
			Date:       o.CreatedAt,
			TableLabel: o.TableID,
			Mixes:      o.Mixes,
			Master:     o.Master,
			Total:      o.Total,
			Score:      float8Ptr(o.Score),
		})
	}
	httpx.JSON(w, http.StatusOK, out)
}

// GuestSummaryFromRestaurantRow maps a per-venue guests row to the shared DTO.
// Exported so the restaurant-scoped list (in the employees package) reuses it.
func GuestSummaryFromRestaurantRow(g db.ListGuestsByRestaurantRow) GuestSummary {
	return GuestSummary{
		ID:           g.ID,
		PhoneNumber:  g.PhoneNumber,
		Visits:       g.Visits,
		LastVisit:    timePtr(g.LastVisit),
		FavouriteMix: g.FavouriteMix,
		AvgScore:     float8Ptr(g.AvgScore),
		Ltv:          g.Ltv,
		LtvMonth:     g.LtvMonth,
		CreatedAt:    g.CreatedAt,
	}
}

func guestSummaryFromSummaryRow(g db.GetGuestSummaryRow) GuestSummary {
	return GuestSummary{
		ID:           g.ID,
		PhoneNumber:  g.PhoneNumber,
		Visits:       g.Visits,
		LastVisit:    timePtr(g.LastVisit),
		FavouriteMix: g.FavouriteMix,
		AvgScore:     float8Ptr(g.AvgScore),
		Ltv:          g.Ltv,
		LtvMonth:     g.LtvMonth,
		CreatedAt:    g.CreatedAt,
	}
}

// timePtr adapts an untyped scan target (max(timestamptz) infers as interface{}
// in sqlc) into a nullable *time.Time.
func timePtr(v interface{}) *time.Time {
	if t, ok := v.(time.Time); ok {
		return &t
	}
	return nil
}

// float8Ptr adapts a nullable pgtype.Float8 into *float64 (null → nil).
func float8Ptr(v pgtype.Float8) *float64 {
	if v.Valid {
		f := v.Float64
		return &f
	}
	return nil
}

func toUserResponse(u db.User) UserResponse {
	return UserResponse{
		ID:          u.ID,
		PhoneNumber: u.PhoneNumber,
		Gender:      u.Gender,
		CreatedAt:   u.CreatedAt,
	}
}

func fullName(last, first, middle string) string {
	s := last + " " + first
	if middle != "" {
		s += " " + middle
	}
	return s
}
