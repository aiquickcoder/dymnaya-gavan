// Package menu implements a restaurant's recipe menu (a standalone entity).
package menu

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

// Handler wires the menu endpoints to the data layer.
type Handler struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

// New creates a menu Handler.
func New(pool *pgxpool.Pool, q *db.Queries) *Handler {
	return &Handler{pool: pool, q: q}
}

// Routes mounts the /menu subtree.
func (h *Handler) Routes(r chi.Router) {
	r.Post("/", h.Create)
	r.Post("/list", h.List)
	r.Patch("/{id}", h.Update)
	r.Delete("/{id}", h.Remove)
}

// ---- DTOs ----

// MenuRecipeInput is the editable payload of a menu recipe.
type MenuRecipeInput struct {
	Name        string   `json:"name" example:"Negroni"`
	Description string   `json:"description"`
	Strength    int32    `json:"strength" example:"7"`
	Price       float64  `json:"price" example:"550"`
	Rating      *float64 `json:"rating,omitempty" example:"4.6"`
	Badge       *string  `json:"badge,omitempty" example:"ХИТ"`
	Tags        []string `json:"tags"`
}

// CreateMenuRecipeRequest creates a menu recipe.
type CreateMenuRecipeRequest struct {
	RestaurantID     uuid.UUID `json:"restaurantId"`
	AuthorEmployeeID uuid.UUID `json:"authorEmployeeId"`
	MenuRecipeInput
}

// ListMenuRequest lists a restaurant's menu.
type ListMenuRequest struct {
	RestaurantID uuid.UUID `json:"restaurantId"`
}

// MenuRecipeView is a menu recipe.
type MenuRecipeView struct {
	ID               uuid.UUID `json:"id"`
	RestaurantID     uuid.UUID `json:"restaurantId"`
	AuthorEmployeeID uuid.UUID `json:"authorEmployeeId"`
	Name             string    `json:"name"`
	Description      string    `json:"description"`
	Strength         int32     `json:"strength"`
	Price            float64   `json:"price"`
	Rating           *float64  `json:"rating,omitempty"`
	Badge            *string   `json:"badge,omitempty"`
	Tags             []string  `json:"tags"`
	CreatedAt        time.Time `json:"createdAt"`
}

// ---- Handlers ----

// Create godoc
//
//	@Summary	Create a menu recipe
//	@Tags		menu
//	@Accept		json
//	@Produce	json
//	@Param		body	body		CreateMenuRecipeRequest	true	"Menu recipe"
//	@Success	201		{object}	httpx.Envelope{data=menu.MenuRecipeView}
//	@Failure	400		{object}	httpx.Envelope
//	@Router		/menu [post]
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateMenuRecipeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if req.RestaurantID == uuid.Nil || req.AuthorEmployeeID == uuid.Nil {
		httpx.Error(w, http.StatusBadRequest, "validation", "restaurantId and authorEmployeeId are required")
		return
	}
	if msg := validate(req.MenuRecipeInput); msg != "" {
		httpx.Error(w, http.StatusBadRequest, "validation", msg)
		return
	}
	m, err := h.q.CreateMenuRecipe(r.Context(), db.CreateMenuRecipeParams{
		RestaurantID:     req.RestaurantID,
		AuthorEmployeeID: req.AuthorEmployeeID,
		Name:             req.Name,
		Description:      req.Description,
		Strength:         req.Strength,
		Price:            req.Price,
		Rating:           req.Rating,
		Badge:            req.Badge,
		Tags:             req.Tags,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			httpx.Error(w, http.StatusBadRequest, "invalid_reference", "restaurant or author does not exist")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, toView(m))
}

// List godoc
//
//	@Summary	List a restaurant's menu recipes
//	@Tags		menu
//	@Accept		json
//	@Produce	json
//	@Param		body	body		ListMenuRequest	true	"Restaurant id"
//	@Success	200		{object}	httpx.Envelope{data=[]menu.MenuRecipeView}
//	@Router		/menu/list [post]
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	var req ListMenuRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	rows, err := h.q.ListMenuRecipes(r.Context(), req.RestaurantID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	out := make([]MenuRecipeView, 0, len(rows))
	for _, m := range rows {
		out = append(out, toView(m))
	}
	httpx.JSON(w, http.StatusOK, out)
}

// Update godoc
//
//	@Summary	Edit a menu recipe (full replace of editable fields)
//	@Tags		menu
//	@Accept		json
//	@Produce	json
//	@Param		id		path		string			true	"Menu recipe ID"
//	@Param		body	body		MenuRecipeInput	true	"New values"
//	@Success	200		{object}	httpx.Envelope{data=menu.MenuRecipeView}
//	@Failure	404		{object}	httpx.Envelope
//	@Router		/menu/{id} [patch]
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var req MenuRecipeInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if msg := validate(req); msg != "" {
		httpx.Error(w, http.StatusBadRequest, "validation", msg)
		return
	}
	m, err := h.q.UpdateMenuRecipe(r.Context(), db.UpdateMenuRecipeParams{
		ID:          id,
		Name:        req.Name,
		Description: req.Description,
		Strength:    req.Strength,
		Price:       req.Price,
		Rating:      req.Rating,
		Badge:       req.Badge,
		Tags:        req.Tags,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "not_found", "menu recipe not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, toView(m))
}

// Remove godoc
//
//	@Summary	Remove a menu recipe (soft)
//	@Tags		menu
//	@Produce	json
//	@Param		id	path		string	true	"Menu recipe ID"
//	@Success	204	{object}	nil
//	@Router		/menu/{id} [delete]
func (h *Handler) Remove(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	if err := h.q.SoftRemoveMenuRecipe(r.Context(), id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- helpers ----

func validate(in MenuRecipeInput) string {
	if in.Name == "" {
		return "name is required"
	}
	if in.Strength < 1 || in.Strength > 10 {
		return "strength must be between 1 and 10"
	}
	if in.Price < 0 {
		return "price must be >= 0"
	}
	if len(in.Tags) != 3 {
		return "tags must contain exactly 3 items"
	}
	return ""
}

func toView(m db.MenuRecipe) MenuRecipeView {
	return MenuRecipeView{
		ID:               m.ID,
		RestaurantID:     m.RestaurantID,
		AuthorEmployeeID: m.AuthorEmployeeID,
		Name:             m.Name,
		Description:      m.Description,
		Strength:         m.Strength,
		Price:            m.Price,
		Rating:           m.Rating,
		Badge:            m.Badge,
		Tags:             m.Tags,
		CreatedAt:        m.CreatedAt,
	}
}

func parseID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid menu recipe id")
		return uuid.Nil, false
	}
	return id, true
}
