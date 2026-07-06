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
	"github.com/jackc/pgx/v5/pgtype"
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
	r.Post("/list", h.List)            // guest: available hookah positions
	r.Post("/list-admin", h.ListAdmin) // admin: every non-removed position
	r.Post("/list-food", h.ListFood)   // guest: available kitchen positions
	r.Post("/reorder", h.Reorder)
	r.Get("/{id}", h.Get)
	r.Patch("/{id}", h.Update)
	r.Delete("/{id}", h.Remove)
}

// ---- DTOs ----

// Component is one flavour component of a menu position (jsonb).
type Component struct {
	Brand   string `json:"brand"`
	Flavour string `json:"flavour"`
	Percent int32  `json:"percent"`
}

// MenuRecipeInput is the editable payload of a menu recipe on create.
type MenuRecipeInput struct {
	Name        string      `json:"name" example:"Negroni"`
	Description string      `json:"description"`
	Strength    int32       `json:"strength" example:"7"`
	Price       float64     `json:"price" example:"550"`
	Rating      *float64    `json:"rating,omitempty" example:"4.6"`
	Badge       *string     `json:"badge,omitempty" example:"ХИТ"`
	Tags        []string    `json:"tags"`
	Kind        string      `json:"kind,omitempty" example:"hookah"`
	Category    string      `json:"category,omitempty"`
	Available   *bool       `json:"available,omitempty"`
	ImageSlug   *string     `json:"imageSlug,omitempty"`
	Components  []Component `json:"components,omitempty"`
}

// CreateMenuRecipeRequest creates a menu recipe.
type CreateMenuRecipeRequest struct {
	RestaurantID     uuid.UUID `json:"restaurantId"`
	AuthorEmployeeID uuid.UUID `json:"authorEmployeeId"`
	MenuRecipeInput
}

// UpdateMenuRecipeInput is a partial patch: only fields present in the JSON body
// are applied (pointers/slices left nil are ignored, matching the coalesce query).
type UpdateMenuRecipeInput struct {
	Name        *string     `json:"name"`
	Description *string     `json:"description"`
	Strength    *int32      `json:"strength"`
	Price       *float64    `json:"price"`
	Rating      *float64    `json:"rating"`
	Badge       *string     `json:"badge"`
	Tags        []string    `json:"tags"`
	Kind        *string     `json:"kind"`
	Category    *string     `json:"category"`
	Available   *bool       `json:"available"`
	SortOrder   *int32      `json:"sortOrder"`
	ImageSlug   *string     `json:"imageSlug"`
	Components  []Component `json:"components"`
}

// ListMenuRequest lists a restaurant's menu.
type ListMenuRequest struct {
	RestaurantID uuid.UUID `json:"restaurantId"`
}

// ReorderMenuRequest sets sort_order from the position of each id in the array.
type ReorderMenuRequest struct {
	RestaurantID uuid.UUID   `json:"restaurantId,omitempty"`
	IDs          []uuid.UUID `json:"ids"`
}

// MenuRecipeView is a menu recipe.
type MenuRecipeView struct {
	ID               uuid.UUID   `json:"id"`
	RestaurantID     uuid.UUID   `json:"restaurantId"`
	AuthorEmployeeID uuid.UUID   `json:"authorEmployeeId"`
	Name             string      `json:"name"`
	Description      string      `json:"description"`
	Strength         int32       `json:"strength"`
	Price            float64     `json:"price"`
	Rating           *float64    `json:"rating,omitempty"`
	Badge            *string     `json:"badge,omitempty"`
	Tags             []string    `json:"tags"`
	Kind             string      `json:"kind"`
	Category         string      `json:"category"`
	Available        bool        `json:"available"`
	SortOrder        int32       `json:"sortOrder"`
	ImageSlug        *string     `json:"imageSlug,omitempty"`
	Components       []Component `json:"components"`
	CreatedAt        time.Time   `json:"createdAt"`
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
	kind := req.Kind
	if kind == "" {
		kind = "hookah"
	}
	if msg := validateCreate(req.MenuRecipeInput, kind); msg != "" {
		httpx.Error(w, http.StatusBadRequest, "validation", msg)
		return
	}
	available := true
	if req.Available != nil {
		available = *req.Available
	}
	tags := req.Tags
	if tags == nil {
		tags = []string{}
	}
	comps := req.Components
	if comps == nil {
		comps = []Component{}
	}
	compBytes, err := json.Marshal(comps)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "validation", "invalid components")
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
		Tags:             tags,
		Badge:            req.Badge,
		Kind:             kind,
		Category:         req.Category,
		Available:        available,
		ImageSlug:        req.ImageSlug,
		Components:       compBytes,
	})
	if err != nil {
		writeDBError(w, err)
		return
	}
	httpx.JSON(w, http.StatusCreated, toView(m))
}

// List godoc
//
//	@Summary	List a restaurant's guest hookah menu (available only)
//	@Tags		menu
//	@Accept		json
//	@Produce	json
//	@Param		body	body		ListMenuRequest	true	"Restaurant id"
//	@Success	200		{object}	httpx.Envelope{data=[]menu.MenuRecipeView}
//	@Router		/menu/list [post]
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	rid, ok := decodeRestaurantID(w, r)
	if !ok {
		return
	}
	rows, err := h.q.ListMenuRecipes(r.Context(), rid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, toViews(rows))
}

// ListAdmin godoc
//
//	@Summary	List every non-removed menu position of a restaurant (admin)
//	@Tags		menu
//	@Accept		json
//	@Produce	json
//	@Param		body	body		ListMenuRequest	true	"Restaurant id"
//	@Success	200		{object}	httpx.Envelope{data=[]menu.MenuRecipeView}
//	@Router		/menu/list-admin [post]
func (h *Handler) ListAdmin(w http.ResponseWriter, r *http.Request) {
	rid, ok := decodeRestaurantID(w, r)
	if !ok {
		return
	}
	rows, err := h.q.ListMenuRecipesAdmin(r.Context(), rid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, toViews(rows))
}

// ListFood godoc
//
//	@Summary	List a restaurant's guest kitchen-bar menu (available only)
//	@Tags		menu
//	@Accept		json
//	@Produce	json
//	@Param		body	body		ListMenuRequest	true	"Restaurant id"
//	@Success	200		{object}	httpx.Envelope{data=[]menu.MenuRecipeView}
//	@Router		/menu/list-food [post]
func (h *Handler) ListFood(w http.ResponseWriter, r *http.Request) {
	rid, ok := decodeRestaurantID(w, r)
	if !ok {
		return
	}
	rows, err := h.q.ListFoodMenu(r.Context(), rid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, toViews(rows))
}

// Get godoc
//
//	@Summary	Get a single menu recipe by id
//	@Tags		menu
//	@Produce	json
//	@Param		id	path		string	true	"Menu recipe ID"
//	@Success	200	{object}	httpx.Envelope{data=menu.MenuRecipeView}
//	@Failure	404	{object}	httpx.Envelope
//	@Router		/menu/{id} [get]
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	m, err := h.q.GetMenuRecipe(r.Context(), id)
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

// Update godoc
//
//	@Summary	Edit a menu recipe (partial: only provided fields change)
//	@Tags		menu
//	@Accept		json
//	@Produce	json
//	@Param		id		path		string					true	"Menu recipe ID"
//	@Param		body	body		UpdateMenuRecipeInput	true	"Fields to change"
//	@Success	200		{object}	httpx.Envelope{data=menu.MenuRecipeView}
//	@Failure	404		{object}	httpx.Envelope
//	@Router		/menu/{id} [patch]
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var req UpdateMenuRecipeInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if msg := validateUpdate(req); msg != "" {
		httpx.Error(w, http.StatusBadRequest, "validation", msg)
		return
	}
	params := db.UpdateMenuRecipeParams{
		ID:          id,
		Name:        req.Name,
		Description: req.Description,
		Strength:    req.Strength,
		Price:       req.Price,
		Rating:      req.Rating,
		Tags:        req.Tags,
		Badge:       req.Badge,
		Kind:        req.Kind,
		Category:    req.Category,
		SortOrder:   req.SortOrder,
		ImageSlug:   req.ImageSlug,
	}
	if req.Available != nil {
		params.Available = pgtype.Bool{Bool: *req.Available, Valid: true}
	}
	if req.Components != nil {
		compBytes, err := json.Marshal(req.Components)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "validation", "invalid components")
			return
		}
		params.Components = compBytes
	}
	m, err := h.q.UpdateMenuRecipe(r.Context(), params)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "not_found", "menu recipe not found")
		return
	}
	if err != nil {
		writeDBError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, toView(m))
}

// Reorder godoc
//
//	@Summary	Reorder menu positions (sort_order = index in ids array)
//	@Tags		menu
//	@Accept		json
//	@Param		body	body	ReorderMenuRequest	true	"Ordered ids"
//	@Success	204		{object}	nil
//	@Router		/menu/reorder [post]
func (h *Handler) Reorder(w http.ResponseWriter, r *http.Request) {
	var req ReorderMenuRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if len(req.IDs) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err := h.q.ReorderMenuRecipes(r.Context(), req.IDs); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
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

func validateCreate(in MenuRecipeInput, kind string) string {
	if in.Name == "" {
		return "name is required"
	}
	if kind != "hookah" && kind != "kitchen" {
		return "kind must be 'hookah' or 'kitchen'"
	}
	if in.Price < 0 {
		return "price must be >= 0"
	}
	if kind == "kitchen" {
		// Kitchen positions carry no strength / flavour tags.
		return ""
	}
	if in.Strength < 1 || in.Strength > 10 {
		return "strength must be between 1 and 10"
	}
	if len(in.Tags) != 3 {
		return "tags must contain exactly 3 items"
	}
	return ""
}

func validateUpdate(in UpdateMenuRecipeInput) string {
	if in.Name != nil && *in.Name == "" {
		return "name must not be empty"
	}
	if in.Price != nil && *in.Price < 0 {
		return "price must be >= 0"
	}
	if in.Kind != nil && *in.Kind != "hookah" && *in.Kind != "kitchen" {
		return "kind must be 'hookah' or 'kitchen'"
	}
	// strength / tags rules are enforced by the DB check constraint (kind-aware);
	// a violation is mapped to a 400 in writeDBError.
	return ""
}

func toView(m db.MenuRecipe) MenuRecipeView {
	comps := []Component{}
	if len(m.Components) > 0 {
		_ = json.Unmarshal(m.Components, &comps)
		if comps == nil {
			comps = []Component{}
		}
	}
	tags := m.Tags
	if tags == nil {
		tags = []string{}
	}
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
		Tags:             tags,
		Kind:             m.Kind,
		Category:         m.Category,
		Available:        m.Available,
		SortOrder:        m.SortOrder,
		ImageSlug:        m.ImageSlug,
		Components:       comps,
		CreatedAt:        m.CreatedAt,
	}
}

func toViews(rows []db.MenuRecipe) []MenuRecipeView {
	out := make([]MenuRecipeView, 0, len(rows))
	for _, m := range rows {
		out = append(out, toView(m))
	}
	return out
}

func decodeRestaurantID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	var req ListMenuRequest
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

func parseID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid menu recipe id")
		return uuid.Nil, false
	}
	return id, true
}

// writeDBError maps common Postgres integrity errors to 400s, defaulting to 500.
func writeDBError(w http.ResponseWriter, err error) {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23503": // foreign_key_violation
			httpx.Error(w, http.StatusBadRequest, "invalid_reference", "restaurant or author does not exist")
			return
		case "23514": // check_violation
			httpx.Error(w, http.StatusBadRequest, "validation", "value violates a menu constraint (strength/kind)")
			return
		}
	}
	httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
}
