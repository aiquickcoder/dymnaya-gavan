// Package recipes implements the recipe domain.
//
// Rules: recipes are immutable after creation (R5.2); the components of a recipe
// must sum to exactly 100 percent (R2.7).
package recipes

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"mixmaster/internal/db"
	"mixmaster/internal/httpx"
)

// Handler wires the recipe endpoints to the data layer.
type Handler struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

// New creates a recipes Handler. pool is needed to persist a recipe and its
// components atomically.
func New(pool *pgxpool.Pool, q *db.Queries) *Handler {
	return &Handler{pool: pool, q: q}
}

// Routes mounts the /recipes subtree.
func (h *Handler) Routes(r chi.Router) {
	r.Post("/", h.Create)
	r.Post("/batch", h.Batch)
}

// ---- DTOs ----

// ComponentInput is one component when creating a recipe.
type ComponentInput struct {
	Brand   string `json:"brand" example:"DS"`
	Flavour string `json:"flavour" example:"apple"`
	Percent int32  `json:"percent" example:"20"`
}

// CreateRecipeRequest creates a recipe with its components (must sum to 100%).
type CreateRecipeRequest struct {
	Name       *string          `json:"name,omitempty" example:"Apple Mix"`
	Strength   int32            `json:"strength" example:"6"`
	IsSecret   bool             `json:"isSecret"`
	Components []ComponentInput `json:"components"`
}

// ComponentView is one component of a recipe.
type ComponentView struct {
	Brand   string `json:"brand"`
	Flavour string `json:"flavour"`
	Percent int32  `json:"percent"`
}

// RecipeView is a recipe with its components.
type RecipeView struct {
	ID         uuid.UUID       `json:"id"`
	Name       *string         `json:"name,omitempty"`
	Strength   *int32          `json:"strength,omitempty"`
	IsSecret   bool            `json:"isSecret"`
	Components []ComponentView `json:"components"`
}

// BatchRequest is a list of recipe ids to fetch.
type BatchRequest struct {
	IDs []uuid.UUID `json:"ids"`
}

// ---- Handlers ----

// Create godoc
//
//	@Summary	Create a recipe with components (must sum to 100%)
//	@Tags		recipes
//	@Accept		json
//	@Produce	json
//	@Param		body	body		CreateRecipeRequest	true	"Recipe + components"
//	@Success	201		{object}	httpx.Envelope{data=recipes.RecipeView}
//	@Failure	400		{object}	httpx.Envelope	"validation (e.g. percent != 100)"
//	@Router		/recipes [post]
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateRecipeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if req.Strength < 1 || req.Strength > 10 {
		httpx.Error(w, http.StatusBadRequest, "validation", "strength must be between 1 and 10")
		return
	}
	if msg := validateComponents(req.Components); msg != "" {
		httpx.Error(w, http.StatusBadRequest, "validation", msg)
		return
	}

	ctx := r.Context()
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	defer tx.Rollback(ctx)
	qtx := h.q.WithTx(tx)

	strength := req.Strength
	recipe, err := qtx.CreateRecipe(ctx, db.CreateRecipeParams{
		Name:     req.Name,
		Strength: &strength,
		IsSecret: req.IsSecret,
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	comps := make([]ComponentView, 0, len(req.Components))
	for _, c := range req.Components {
		created, err := qtx.CreateComponent(ctx, db.CreateComponentParams{
			RecipeID: recipe.ID,
			Brand:    c.Brand,
			Flavour:  c.Flavour,
			Percent:  c.Percent,
		})
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
			return
		}
		comps = append(comps, ComponentView{Brand: created.Brand, Flavour: created.Flavour, Percent: created.Percent})
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, RecipeView{
		ID:         recipe.ID,
		Name:       recipe.Name,
		Strength:   recipe.Strength,
		IsSecret:   recipe.IsSecret,
		Components: comps,
	})
}

// Batch godoc
//
//	@Summary	Get recipes by ids (batch), components included
//	@Tags		recipes
//	@Accept		json
//	@Produce	json
//	@Param		body	body		BatchRequest	true	"Recipe ids"
//	@Success	200		{object}	httpx.Envelope{data=[]recipes.RecipeView}
//	@Router		/recipes/batch [post]
func (h *Handler) Batch(w http.ResponseWriter, r *http.Request) {
	var req BatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if len(req.IDs) == 0 {
		httpx.JSON(w, http.StatusOK, []RecipeView{})
		return
	}

	ctx := r.Context()
	recipeRows, err := h.q.GetRecipesByIDs(ctx, req.IDs)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	compRows, err := h.q.ListComponentsByRecipeIDs(ctx, req.IDs)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	byRecipe := make(map[uuid.UUID][]ComponentView, len(recipeRows))
	for _, c := range compRows {
		byRecipe[c.RecipeID] = append(byRecipe[c.RecipeID], ComponentView{Brand: c.Brand, Flavour: c.Flavour, Percent: c.Percent})
	}

	out := make([]RecipeView, 0, len(recipeRows))
	for _, rec := range recipeRows {
		comps := byRecipe[rec.ID]
		if comps == nil {
			comps = []ComponentView{}
		}
		out = append(out, RecipeView{
			ID:         rec.ID,
			Name:       rec.Name,
			Strength:   rec.Strength,
			IsSecret:   rec.IsSecret,
			Components: comps,
		})
	}
	httpx.JSON(w, http.StatusOK, out)
}

// validateComponents enforces R2.7: at least one component, each > 0, sum == 100.
func validateComponents(cs []ComponentInput) string {
	if len(cs) == 0 {
		return "at least one component is required"
	}
	var sum int32
	for _, c := range cs {
		if c.Brand == "" || c.Flavour == "" {
			return "each component needs brand and flavour"
		}
		if c.Percent <= 0 {
			return "each component percent must be > 0"
		}
		sum += c.Percent
	}
	if sum != 100 {
		return "components percent must sum to exactly 100"
	}
	return ""
}
