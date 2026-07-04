// Package orders implements the order / table lifecycle domain.
//
// Lifecycle rules (see docs/ARCHITECTURE.md):
//   - R3.1/R3.2 active order is tracked only via TableAssignment, unique per (restaurant, table)
//   - R3.3 opening a table is idempotent (get-or-create)
//   - R3.4 a closed order is immutable
//   - R3.5 resetting a table = delete TableAssignment + set closed_at, one transaction
//   - R3.8 removing/replacing a recipe is soft (removed_at)
package orders

import (
	"context"
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

// Handler wires the order endpoints to the data layer.
type Handler struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

// New creates an orders Handler. pool is needed for multi-statement transactions.
func New(pool *pgxpool.Pool, q *db.Queries) *Handler {
	return &Handler{pool: pool, q: q}
}

// Routes mounts the /orders subtree.
func (h *Handler) Routes(r chi.Router) {
	r.Post("/open", h.Open)
	r.Post("/{id}/recipes", h.AttachRecipe)
	r.Delete("/{id}/recipes/{orderRecipeId}", h.RemoveRecipe)
	r.Post("/{id}/close", h.Close)
}

// ---- DTOs ----

// OpenRequest opens (or fetches) the active order for a table.
type OpenRequest struct {
	RestaurantID uuid.UUID  `json:"restaurantId"`
	TableID      string     `json:"tableId" example:"12"`
	UserID       *uuid.UUID `json:"userId,omitempty"`
}

// ComponentView is one component of a recipe.
type ComponentView struct {
	Brand   string `json:"brand"`
	Flavour string `json:"flavour"`
	Percent int32  `json:"percent"`
}

// OrderRecipeView is a recipe on the order with author and composition.
type OrderRecipeView struct {
	OrderRecipeID  uuid.UUID       `json:"orderRecipeId"`
	RecipeID       uuid.UUID       `json:"recipeId"`
	RecipeName     *string         `json:"recipeName,omitempty"`
	Strength       *int32          `json:"strength,omitempty"`
	IsSecret       bool            `json:"isSecret"`
	AuthorFullName string          `json:"authorFullName"`
	AuthorShort    string          `json:"authorShortName"`
	Components     []ComponentView `json:"components"`
}

// OrderResponse is the order with its active recipes.
type OrderResponse struct {
	ID           uuid.UUID         `json:"id"`
	TableID      string            `json:"tableId"`
	RestaurantID uuid.UUID         `json:"restaurantId"`
	UserID       *uuid.UUID        `json:"userId,omitempty"`
	CreatedAt    time.Time         `json:"createdAt"`
	ClosedAt     *time.Time        `json:"closedAt,omitempty"`
	Recipes      []OrderRecipeView `json:"recipes"`
}

// AttachRecipeRequest attaches a recipe (made by an employee) to an order.
type AttachRecipeRequest struct {
	RecipeID   uuid.UUID `json:"recipeId"`
	EmployeeID uuid.UUID `json:"employeeId"`
}

// ---- Handlers ----

// Open godoc
//
//	@Summary	Open a table order (get-or-create, idempotent)
//	@Tags		orders
//	@Accept		json
//	@Produce	json
//	@Param		body	body		OpenRequest	true	"Restaurant + table"
//	@Success	200		{object}	httpx.Envelope{data=orders.OrderResponse}	"existing order"
//	@Success	201		{object}	httpx.Envelope{data=orders.OrderResponse}	"new order"
//	@Failure	400		{object}	httpx.Envelope
//	@Router		/orders/open [post]
func (h *Handler) Open(w http.ResponseWriter, r *http.Request) {
	var req OpenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if req.RestaurantID == uuid.Nil || req.TableID == "" {
		httpx.Error(w, http.StatusBadRequest, "validation", "restaurantId and tableId are required")
		return
	}

	order, created, err := h.openTable(r.Context(), req)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	recipes, err := h.loadRecipes(r.Context(), order.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	httpx.JSON(w, status, toOrderResponse(order, recipes))
}

// openTable returns the active order for a table, creating it (and its
// TableAssignment) if none exists. Idempotent; retries once on the race where a
// concurrent request wins the unique (restaurant, table) assignment (R3.2/R3.3).
func (h *Handler) openTable(ctx context.Context, req OpenRequest) (db.Order, bool, error) {
	for attempt := 0; attempt < 2; attempt++ {
		order, created, err := h.tryOpen(ctx, req)
		if err == nil {
			return order, created, nil
		}
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation on assignment
			continue // another request opened the table first; retry the get path
		}
		return db.Order{}, false, err
	}
	return db.Order{}, false, errors.New("could not open table after retry")
}

func (h *Handler) tryOpen(ctx context.Context, req OpenRequest) (db.Order, bool, error) {
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		return db.Order{}, false, err
	}
	defer tx.Rollback(ctx)
	qtx := h.q.WithTx(tx)

	a, err := qtx.GetTableAssignment(ctx, db.GetTableAssignmentParams{
		RestaurantID: req.RestaurantID,
		TableID:      req.TableID,
	})
	switch {
	case err == nil: // table already has an active order
		order, gerr := qtx.GetOrder(ctx, a.OrderID)
		if gerr != nil {
			return db.Order{}, false, gerr
		}
		if cerr := tx.Commit(ctx); cerr != nil {
			return db.Order{}, false, cerr
		}
		return order, false, nil
	case errors.Is(err, pgx.ErrNoRows): // free table → create order + assignment
		order, cerr := qtx.CreateOrder(ctx, db.CreateOrderParams{
			TableID:      req.TableID,
			RestaurantID: req.RestaurantID,
			UserID:       req.UserID,
		})
		if cerr != nil {
			return db.Order{}, false, cerr
		}
		if _, aerr := qtx.CreateTableAssignment(ctx, db.CreateTableAssignmentParams{
			RestaurantID: req.RestaurantID,
			TableID:      req.TableID,
			OrderID:      order.ID,
		}); aerr != nil {
			return db.Order{}, false, aerr // may be unique_violation → caller retries
		}
		if commitErr := tx.Commit(ctx); commitErr != nil {
			return db.Order{}, false, commitErr
		}
		return order, true, nil
	default:
		return db.Order{}, false, err
	}
}

// AttachRecipe godoc
//
//	@Summary	Attach a recipe to an order
//	@Tags		orders
//	@Accept		json
//	@Produce	json
//	@Param		id		path		string				true	"Order ID"
//	@Param		body	body		AttachRecipeRequest	true	"Recipe + author"
//	@Success	201		{object}	httpx.Envelope{data=db.OrderRecipe}
//	@Failure	404		{object}	httpx.Envelope
//	@Failure	409		{object}	httpx.Envelope	"order is closed"
//	@Router		/orders/{id}/recipes [post]
func (h *Handler) AttachRecipe(w http.ResponseWriter, r *http.Request) {
	orderID, ok := parseID(w, r, "id")
	if !ok {
		return
	}
	var req AttachRecipeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}

	order, err := h.q.GetOrder(r.Context(), orderID)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "not_found", "order not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	if order.ClosedAt != nil { // R3.4 closed order is immutable
		httpx.Error(w, http.StatusConflict, "order_closed", "order is closed")
		return
	}

	or, err := h.q.AttachRecipe(r.Context(), db.AttachRecipeParams{
		OrderID:    orderID,
		RecipeID:   req.RecipeID,
		EmployeeID: req.EmployeeID,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" { // foreign_key_violation
			httpx.Error(w, http.StatusBadRequest, "invalid_reference", "recipe or employee does not exist")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, or)
}

// RemoveRecipe godoc
//
//	@Summary	Remove/replace a recipe on an order (soft, removed_at)
//	@Tags		orders
//	@Produce	json
//	@Param		id				path	string	true	"Order ID"
//	@Param		orderRecipeId	path	string	true	"OrderRecipe ID"
//	@Success	204				{object}	nil
//	@Failure	404				{object}	httpx.Envelope
//	@Router		/orders/{id}/recipes/{orderRecipeId} [delete]
func (h *Handler) RemoveRecipe(w http.ResponseWriter, r *http.Request) {
	orderID, ok := parseID(w, r, "id")
	if !ok {
		return
	}
	orID, ok := parseID(w, r, "orderRecipeId")
	if !ok {
		return
	}
	_, err := h.q.SoftRemoveOrderRecipe(r.Context(), db.SoftRemoveOrderRecipeParams{
		ID:      orID,
		OrderID: orderID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "not_found", "active recipe not found on this order")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Close godoc
//
//	@Summary	Reset table (delete TableAssignment + set closed_at)
//	@Tags		orders
//	@Produce	json
//	@Param		id	path		string	true	"Order ID"
//	@Success	200	{object}	httpx.Envelope{data=orders.OrderResponse}
//	@Failure	404	{object}	httpx.Envelope
//	@Router		/orders/{id}/close [post]
func (h *Handler) Close(w http.ResponseWriter, r *http.Request) {
	orderID, ok := parseID(w, r, "id")
	if !ok {
		return
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	defer tx.Rollback(r.Context())
	qtx := h.q.WithTx(tx)

	// Free the table regardless of order state (R3.5).
	if err := qtx.DeleteTableAssignmentByOrder(r.Context(), orderID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	order, err := qtx.CloseOrder(r.Context(), orderID)
	if errors.Is(err, pgx.ErrNoRows) { // already closed → return current state
		order, err = qtx.GetOrder(r.Context(), orderID)
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, http.StatusNotFound, "not_found", "order not found")
			return
		}
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, toOrderResponse(order, nil))
}

// OrderRecipeRoutes mounts the /order-recipes subtree (guest rating & review).
func (h *Handler) OrderRecipeRoutes(r chi.Router) {
	r.Post("/{orderRecipeId}/rating", h.RateOrderRecipe)
	r.Post("/{orderRecipeId}/review", h.ReviewOrderRecipe)
}

// RateOrderRecipeRequest is a guest's 1..5 score for an order recipe.
type RateOrderRecipeRequest struct {
	UserID uuid.UUID `json:"userId"`
	Score  int32     `json:"score" example:"5"`
}

// ReviewOrderRecipeRequest is a guest's text review of an order recipe.
type ReviewOrderRecipeRequest struct {
	UserID uuid.UUID `json:"userId"`
	Review string    `json:"review"`
}

// FeedbackView is the guest's current score/review for an order recipe.
type FeedbackView struct {
	OrderRecipeID uuid.UUID `json:"orderRecipeId"`
	Score         *int32    `json:"score,omitempty"`
	Review        *string   `json:"review,omitempty"`
}

// RateOrderRecipe godoc
//
//	@Summary	Rate an order recipe (1..5)
//	@Tags		orders
//	@Accept		json
//	@Produce	json
//	@Param		orderRecipeId	path		string					true	"OrderRecipe ID"
//	@Param		body			body		RateOrderRecipeRequest	true	"User + score"
//	@Success	200				{object}	httpx.Envelope{data=orders.FeedbackView}
//	@Failure	400				{object}	httpx.Envelope
//	@Router		/order-recipes/{orderRecipeId}/rating [post]
func (h *Handler) RateOrderRecipe(w http.ResponseWriter, r *http.Request) {
	orID, ok := parseID(w, r, "orderRecipeId")
	if !ok {
		return
	}
	var req RateOrderRecipeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if req.Score < 1 || req.Score > 5 {
		httpx.Error(w, http.StatusBadRequest, "validation", "score must be between 1 and 5")
		return
	}
	score := req.Score
	fb, err := h.q.UpsertOrderRecipeRating(r.Context(), db.UpsertOrderRecipeRatingParams{
		OrderRecipeID: orID,
		UserID:        req.UserID,
		Score:         &score,
	})
	if err != nil {
		h.feedbackError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, FeedbackView{OrderRecipeID: fb.OrderRecipeID, Score: fb.Score, Review: fb.Review})
}

// ReviewOrderRecipe godoc
//
//	@Summary	Leave a text review on an order recipe
//	@Tags		orders
//	@Accept		json
//	@Produce	json
//	@Param		orderRecipeId	path		string						true	"OrderRecipe ID"
//	@Param		body			body		ReviewOrderRecipeRequest	true	"User + review"
//	@Success	200				{object}	httpx.Envelope{data=orders.FeedbackView}
//	@Failure	400				{object}	httpx.Envelope
//	@Router		/order-recipes/{orderRecipeId}/review [post]
func (h *Handler) ReviewOrderRecipe(w http.ResponseWriter, r *http.Request) {
	orID, ok := parseID(w, r, "orderRecipeId")
	if !ok {
		return
	}
	var req ReviewOrderRecipeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if req.Review == "" {
		httpx.Error(w, http.StatusBadRequest, "validation", "review is required")
		return
	}
	review := req.Review
	fb, err := h.q.UpsertOrderRecipeReview(r.Context(), db.UpsertOrderRecipeReviewParams{
		OrderRecipeID: orID,
		UserID:        req.UserID,
		Review:        &review,
	})
	if err != nil {
		h.feedbackError(w, err)
		return
	}
	httpx.JSON(w, http.StatusOK, FeedbackView{OrderRecipeID: fb.OrderRecipeID, Score: fb.Score, Review: fb.Review})
}

func (h *Handler) feedbackError(w http.ResponseWriter, err error) {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" {
		httpx.Error(w, http.StatusBadRequest, "invalid_reference", "order recipe or user does not exist")
		return
	}
	httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
}

// ---- helpers ----

func (h *Handler) loadRecipes(ctx context.Context, orderID uuid.UUID) ([]OrderRecipeView, error) {
	rows, err := h.q.ListActiveOrderRecipes(ctx, orderID)
	if err != nil {
		return nil, err
	}
	out := make([]OrderRecipeView, 0, len(rows))
	for _, row := range rows {
		comps, err := h.q.ListComponentsByRecipeID(ctx, row.RecipeID)
		if err != nil {
			return nil, err
		}
		cv := make([]ComponentView, 0, len(comps))
		for _, c := range comps {
			cv = append(cv, ComponentView{Brand: c.Brand, Flavour: c.Flavour, Percent: c.Percent})
		}
		out = append(out, OrderRecipeView{
			OrderRecipeID:  row.OrderRecipeID,
			RecipeID:       row.RecipeID,
			RecipeName:     row.RecipeName,
			Strength:       row.RecipeStrength,
			IsSecret:       row.RecipeIsSecret,
			AuthorFullName: fullName(row.LastName, row.FirstName, row.MiddleName),
			AuthorShort:    row.ShortName,
			Components:     cv,
		})
	}
	return out, nil
}

func toOrderResponse(o db.Order, recipes []OrderRecipeView) OrderResponse {
	if recipes == nil {
		recipes = []OrderRecipeView{}
	}
	return OrderResponse{
		ID:           o.ID,
		TableID:      o.TableID,
		RestaurantID: o.RestaurantID,
		UserID:       o.UserID,
		CreatedAt:    o.CreatedAt,
		ClosedAt:     o.ClosedAt,
		Recipes:      recipes,
	}
}

func parseID(w http.ResponseWriter, r *http.Request, name string) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid "+name)
		return uuid.Nil, false
	}
	return id, true
}

func fullName(last, first, middle string) string {
	s := last + " " + first
	if middle != "" {
		s += " " + middle
	}
	return s
}
