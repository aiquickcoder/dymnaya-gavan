// Package employees implements the employee & restaurant domain:
// creating restaurants (with a secret code), registering employees against a
// restaurant by that code, attaching them to more restaurants, editing, batch
// fetch, and listing a restaurant's employees by code (for login).
package employees

import (
	"crypto/rand"
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
	"mixmaster/internal/users"
)

// Handler groups employee and restaurant endpoints.
type Handler struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

// New creates an employees Handler.
func New(pool *pgxpool.Pool, q *db.Queries) *Handler {
	return &Handler{pool: pool, q: q}
}

// Mount registers both /employees and /restaurants subtrees.
func (h *Handler) Mount(r chi.Router) {
	r.Route("/employees", func(r chi.Router) {
		r.Post("/", h.Register)
		r.Post("/batch", h.Batch)
		r.Patch("/{id}", h.Update)
		r.Post("/{id}/restaurants", h.AttachRestaurant)
		r.Post("/{id}/ratings", h.RateEmployee)          // rate a master (1..5)
		r.Get("/{id}/rating", h.GetEmployeeRating)       // aggregate rating
		r.Get("/{id}/ratings", h.ListEmployeeRatingsH)   // ratings given to the master
		r.Get("/{id}/recipe-feedback", h.RecipeFeedback) // reviews/scores on his recipes
		r.Get("/{id}/tip-url", h.TipUrl)                 // personal tips link (Нетмонет)
		r.Post("/{id}/schedule", h.SetScheduleDay)       // toggle one shift-schedule day
	})
	r.Route("/restaurants", func(r chi.Router) {
		r.Post("/", h.CreateRestaurant)
		r.Post("/employees", h.ListByCode)
		r.Post("/shift", h.SetShift)                           // set today's roster (by code)
		r.Get("/{restaurantId}/shift", h.GetShift)             // today's masters on shift
		r.Post("/{restaurantId}/shift", h.SetShiftByID)        // set today's roster (by id)
		r.Get("/{restaurantId}/employees-full", h.ListFull)    // full admin roster
		r.Post("/{restaurantId}/employees-full", h.CreateFull) // create a master
		r.Get("/{restaurantId}/schedule", h.Schedule)          // shift-schedule grid
		r.Get("/{restaurantId}/guests", h.ListGuests)          // venue guests (admin)
	})
}

// ---- DTOs ----

// CreateRestaurantRequest creates a restaurant.
type CreateRestaurantRequest struct {
	Name string `json:"name" example:"Bar One"`
}

// RestaurantResponse is a restaurant with its secret code (shown once, to its owner).
type RestaurantResponse struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	Code string    `json:"code"`
}

// EmployeeResponse is the public view of an employee.
// Position is set only where a restaurant context exists (login list, shift).
type EmployeeResponse struct {
	ID         uuid.UUID `json:"id"`
	FirstName  string    `json:"firstName"`
	LastName   string    `json:"lastName"`
	MiddleName string    `json:"middleName"`
	ShortName  string    `json:"shortName"`
	Position   *string   `json:"position,omitempty"`
}

// RegisterEmployeeRequest registers an employee at a restaurant identified by code.
type RegisterEmployeeRequest struct {
	FirstName  string  `json:"firstName"`
	LastName   string  `json:"lastName"`
	MiddleName string  `json:"middleName"`
	ShortName  string  `json:"shortName"`
	Position   *string `json:"position,omitempty" example:"Старший мастер"`
	Code       string  `json:"code" example:"SECRET123"`
}

// RegisterEmployeeResponse returns the new employee and the restaurant it joined.
type RegisterEmployeeResponse struct {
	Employee     EmployeeResponse `json:"employee"`
	RestaurantID uuid.UUID        `json:"restaurantId"`
}

// AttachRestaurantRequest links an existing employee to another restaurant by code.
type AttachRestaurantRequest struct {
	Code     string  `json:"code"`
	Position *string `json:"position,omitempty"`
}

// UpdateEmployeeRequest is a partial update of a master. Names/phone/photoSlug/
// tipUrl land on employees; position/status on the employee_restaurants link
// (scoped by restaurantId when present, else all of the master's venues).
type UpdateEmployeeRequest struct {
	FirstName    *string    `json:"firstName,omitempty"`
	LastName     *string    `json:"lastName,omitempty"`
	MiddleName   *string    `json:"middleName,omitempty"`
	ShortName    *string    `json:"shortName,omitempty"`
	Phone        *string    `json:"phone,omitempty"`
	PhotoSlug    *string    `json:"photoSlug,omitempty"`
	TipUrl       *string    `json:"tipUrl,omitempty"`
	Position     *string    `json:"position,omitempty"`
	Status       *string    `json:"status,omitempty"`
	RestaurantID *uuid.UUID `json:"restaurantId,omitempty"`
}

// EmployeeFull is the full admin view of a master in a venue context
// (matches the web EmployeeFull type; camelCase).
type EmployeeFull struct {
	ID          uuid.UUID `json:"id"`
	FirstName   string    `json:"firstName"`
	LastName    string    `json:"lastName"`
	MiddleName  string    `json:"middleName"`
	ShortName   string    `json:"shortName"`
	Position    string    `json:"position"`
	Phone       *string   `json:"phone,omitempty"`
	PhotoSlug   *string   `json:"photoSlug,omitempty"`
	TipUrl      *string   `json:"tipUrl,omitempty"`
	Rating      float64   `json:"rating"`
	RatingCount int32     `json:"ratingCount"`
	OnShift     bool      `json:"onShift"`
	Status      string    `json:"status"`
}

// UpsertEmployeeBody creates a master (POST) — firstName/lastName required.
type UpsertEmployeeBody struct {
	FirstName  string  `json:"firstName"`
	LastName   string  `json:"lastName"`
	MiddleName string  `json:"middleName"`
	ShortName  string  `json:"shortName"`
	Position   *string `json:"position,omitempty"`
	Phone      *string `json:"phone,omitempty"`
	PhotoSlug  *string `json:"photoSlug,omitempty"`
	TipUrl     *string `json:"tipUrl,omitempty"`
	Status     *string `json:"status,omitempty"`
}

// BatchRequest is a list of employee ids.
type BatchRequest struct {
	IDs []uuid.UUID `json:"ids"`
}

// ListByCodeRequest identifies a restaurant by its code.
type ListByCodeRequest struct {
	Code string `json:"code"`
}

// RestaurantBrief is the public (codeless) view of a restaurant.
type RestaurantBrief struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}

// LoginResponse is the restaurant context plus its employees (for staff login).
type LoginResponse struct {
	Restaurant RestaurantBrief    `json:"restaurant"`
	Employees  []EmployeeResponse `json:"employees"`
}

// ---- Handlers ----

// CreateRestaurant godoc
//
//	@Summary	Create a restaurant and get its code
//	@Tags		restaurants
//	@Accept		json
//	@Produce	json
//	@Param		body	body		CreateRestaurantRequest	true	"Restaurant name"
//	@Success	201		{object}	httpx.Envelope{data=employees.RestaurantResponse}
//	@Router		/restaurants [post]
func (h *Handler) CreateRestaurant(w http.ResponseWriter, r *http.Request) {
	var req CreateRestaurantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if req.Name == "" {
		httpx.Error(w, http.StatusBadRequest, "validation", "name is required")
		return
	}

	// Retry on the (rare) chance of a code collision.
	for attempt := 0; attempt < 3; attempt++ {
		rest, err := h.q.CreateRestaurant(r.Context(), db.CreateRestaurantParams{
			Name: req.Name,
			Code: genCode(8),
		})
		if err == nil {
			httpx.JSON(w, http.StatusCreated, RestaurantResponse{ID: rest.ID, Name: rest.Name, Code: rest.Code})
			return
		}
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			continue
		}
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.Error(w, http.StatusInternalServerError, "code_collision", "could not allocate a unique code")
}

// Register godoc
//
//	@Summary	Register an employee at a restaurant (by code)
//	@Tags		employees
//	@Accept		json
//	@Produce	json
//	@Param		body	body		RegisterEmployeeRequest	true	"Employee data + restaurant code"
//	@Success	201		{object}	httpx.Envelope{data=employees.RegisterEmployeeResponse}
//	@Failure	404		{object}	httpx.Envelope	"unknown code"
//	@Router		/employees [post]
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterEmployeeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if req.FirstName == "" || req.LastName == "" || req.Code == "" {
		httpx.Error(w, http.StatusBadRequest, "validation", "firstName, lastName and code are required")
		return
	}

	ctx := r.Context()
	rest, err := h.q.GetRestaurantByCode(ctx, req.Code)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "restaurant_not_found", "no restaurant for this code")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	tx, err := h.pool.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	defer tx.Rollback(ctx)
	qtx := h.q.WithTx(tx)

	emp, err := qtx.CreateEmployee(ctx, db.CreateEmployeeParams{
		FirstName:  req.FirstName,
		LastName:   req.LastName,
		MiddleName: req.MiddleName,
		ShortName:  req.ShortName,
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	if err := qtx.LinkEmployeeRestaurant(ctx, db.LinkEmployeeRestaurantParams{
		EmployeeID:   emp.ID,
		RestaurantID: rest.ID,
		Position:     req.Position,
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	httpx.JSON(w, http.StatusCreated, RegisterEmployeeResponse{
		Employee:     toEmployeeResponse(emp),
		RestaurantID: rest.ID,
	})
}

// AttachRestaurant godoc
//
//	@Summary	Attach an employee to another restaurant (by code)
//	@Tags		employees
//	@Accept		json
//	@Produce	json
//	@Param		id		path		string					true	"Employee ID"
//	@Param		body	body		AttachRestaurantRequest	true	"Restaurant code"
//	@Success	204		{object}	nil
//	@Failure	404		{object}	httpx.Envelope
//	@Router		/employees/{id}/restaurants [post]
func (h *Handler) AttachRestaurant(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var req AttachRestaurantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}

	ctx := r.Context()
	rest, err := h.q.GetRestaurantByCode(ctx, req.Code)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "restaurant_not_found", "no restaurant for this code")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	if err := h.q.LinkEmployeeRestaurant(ctx, db.LinkEmployeeRestaurantParams{
		EmployeeID:   id,
		RestaurantID: rest.ID,
		Position:     req.Position,
	}); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" { // employee does not exist
			httpx.Error(w, http.StatusNotFound, "employee_not_found", "employee does not exist")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Update godoc
//
//	@Summary	Update an employee (partial)
//	@Tags		employees
//	@Accept		json
//	@Produce	json
//	@Param		id		path		string					true	"Employee ID"
//	@Param		body	body		UpdateEmployeeRequest	true	"Fields to change"
//	@Success	200		{object}	httpx.Envelope{data=employees.EmployeeResponse}
//	@Failure	404		{object}	httpx.Envelope
//	@Router		/employees/{id} [patch]
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var req UpdateEmployeeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}

	ctx := r.Context()
	emp, err := h.q.UpdateEmployee(ctx, db.UpdateEmployeeParams{
		ID:         id,
		FirstName:  req.FirstName,
		LastName:   req.LastName,
		MiddleName: req.MiddleName,
		ShortName:  req.ShortName,
		Phone:      req.Phone,
		PhotoSlug:  req.PhotoSlug,
		TipUrl:     req.TipUrl,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "not_found", "employee not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	// position/status live on the per-restaurant link.
	if req.Position != nil || req.Status != nil {
		if err := h.q.UpdateEmployeeRestaurant(ctx, db.UpdateEmployeeRestaurantParams{
			EmployeeID:   id,
			Position:     req.Position,
			Status:       req.Status,
			RestaurantID: req.RestaurantID,
		}); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
			return
		}
	}

	// Echo back the full row in a venue context. Prefer the given restaurant;
	// fall back to any venue the master is linked to.
	rid := uuid.Nil
	if req.RestaurantID != nil {
		rid = *req.RestaurantID
	} else if any, err := h.q.GetEmployeeAnyRestaurant(ctx, id); err == nil {
		rid = any
	}
	if rid != uuid.Nil {
		full, err := h.q.GetEmployeeFull(ctx, db.GetEmployeeFullParams{EmployeeID: id, RestaurantID: rid})
		if err == nil {
			httpx.JSON(w, http.StatusOK, employeeFullFromGet(full))
			return
		}
	}
	// No venue context: return a minimal full view from the employee row.
	httpx.JSON(w, http.StatusOK, EmployeeFull{
		ID:         emp.ID,
		FirstName:  emp.FirstName,
		LastName:   emp.LastName,
		MiddleName: emp.MiddleName,
		ShortName:  emp.ShortName,
		Phone:      emp.Phone,
		PhotoSlug:  emp.PhotoSlug,
		TipUrl:     emp.TipUrl,
		Status:     "active",
	})
}

// Batch godoc
//
//	@Summary	Get employees by ids (batch)
//	@Tags		employees
//	@Accept		json
//	@Produce	json
//	@Param		body	body		BatchRequest	true	"Employee ids"
//	@Success	200		{object}	httpx.Envelope{data=[]employees.EmployeeResponse}
//	@Router		/employees/batch [post]
func (h *Handler) Batch(w http.ResponseWriter, r *http.Request) {
	var req BatchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if len(req.IDs) == 0 {
		httpx.JSON(w, http.StatusOK, []EmployeeResponse{})
		return
	}
	emps, err := h.q.GetEmployeesByIDs(r.Context(), req.IDs)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, toEmployeeResponses(emps))
}

// ListByCode godoc
//
//	@Summary	List restaurant employees by code (for login)
//	@Tags		restaurants
//	@Accept		json
//	@Produce	json
//	@Param		body	body		ListByCodeRequest	true	"Restaurant code"
//	@Success	200		{object}	httpx.Envelope{data=employees.LoginResponse}
//	@Failure	404		{object}	httpx.Envelope
//	@Router		/restaurants/employees [post]
func (h *Handler) ListByCode(w http.ResponseWriter, r *http.Request) {
	var req ListByCodeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	ctx := r.Context()
	rest, err := h.q.GetRestaurantByCode(ctx, req.Code)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "restaurant_not_found", "no restaurant for this code")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	emps, err := h.q.ListEmployeesByRestaurant(ctx, rest.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	list := make([]EmployeeResponse, 0, len(emps))
	for _, e := range emps {
		list = append(list, EmployeeResponse{
			ID:         e.ID,
			FirstName:  e.FirstName,
			LastName:   e.LastName,
			MiddleName: e.MiddleName,
			ShortName:  e.ShortName,
			Position:   e.Position,
		})
	}
	httpx.JSON(w, http.StatusOK, LoginResponse{
		Restaurant: RestaurantBrief{ID: rest.ID, Name: rest.Name},
		Employees:  list,
	})
}

// ---- ratings, feedback, shifts ----

// RateEmployeeRequest is a guest's 1..5 rating of a master.
type RateEmployeeRequest struct {
	UserID uuid.UUID `json:"userId"`
	Score  int32     `json:"score" example:"5"`
}

// RatingAgg is a master's aggregate rating.
type RatingAgg struct {
	Average float64 `json:"average"`
	Count   int32   `json:"count"`
}

// RateEmployee godoc
//
//	@Summary	Rate a master (1..5)
//	@Tags		employees
//	@Accept		json
//	@Produce	json
//	@Param		id		path		string				true	"Employee ID"
//	@Param		body	body		RateEmployeeRequest	true	"User + score"
//	@Success	200		{object}	httpx.Envelope{data=employees.RatingAgg}
//	@Failure	400		{object}	httpx.Envelope
//	@Router		/employees/{id}/ratings [post]
func (h *Handler) RateEmployee(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var req RateEmployeeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if req.Score < 1 || req.Score > 5 {
		httpx.Error(w, http.StatusBadRequest, "validation", "score must be between 1 and 5")
		return
	}
	if _, err := h.q.UpsertEmployeeRating(r.Context(), db.UpsertEmployeeRatingParams{
		EmployeeID: id,
		UserID:     req.UserID,
		Score:      req.Score,
	}); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			httpx.Error(w, http.StatusBadRequest, "invalid_reference", "employee or user does not exist")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	h.writeRatingAgg(w, r, id)
}

// GetEmployeeRating godoc
//
//	@Summary	Get a master's aggregate rating
//	@Tags		employees
//	@Produce	json
//	@Param		id	path		string	true	"Employee ID"
//	@Success	200	{object}	httpx.Envelope{data=employees.RatingAgg}
//	@Router		/employees/{id}/rating [get]
func (h *Handler) GetEmployeeRating(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	h.writeRatingAgg(w, r, id)
}

func (h *Handler) writeRatingAgg(w http.ResponseWriter, r *http.Request, id uuid.UUID) {
	agg, err := h.q.GetEmployeeRatingAgg(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, RatingAgg{Average: agg.Average, Count: agg.Count})
}

// RatingItem is one rating given to a master.
type RatingItem struct {
	Score     int32     `json:"score"`
	UserID    uuid.UUID `json:"userId"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// ListEmployeeRatingsH godoc
//
//	@Summary	List ratings given to a master (as an employee)
//	@Tags		employees
//	@Produce	json
//	@Param		id	path		string	true	"Employee ID"
//	@Success	200	{object}	httpx.Envelope{data=[]employees.RatingItem}
//	@Router		/employees/{id}/ratings [get]
func (h *Handler) ListEmployeeRatingsH(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	rows, err := h.q.ListEmployeeRatings(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	out := make([]RatingItem, 0, len(rows))
	for _, row := range rows {
		out = append(out, RatingItem{Score: row.Score, UserID: row.UserID, UpdatedAt: row.UpdatedAt})
	}
	httpx.JSON(w, http.StatusOK, out)
}

// ComponentView is one component of a recipe.
type ComponentView struct {
	Brand   string `json:"brand"`
	Flavour string `json:"flavour"`
	Percent int32  `json:"percent"`
}

// RecipeFeedbackItem is one review/score on a master's recipe.
type RecipeFeedbackItem struct {
	OrderRecipeID uuid.UUID       `json:"orderRecipeId"`
	RecipeID      uuid.UUID       `json:"recipeId"`
	RecipeName    *string         `json:"recipeName,omitempty"`
	Strength      *int32          `json:"strength,omitempty"`
	Score         *int32          `json:"score,omitempty"`
	Review        *string         `json:"review,omitempty"`
	UpdatedAt     time.Time       `json:"updatedAt"`
	Components    []ComponentView `json:"components"`
}

// RecipeFeedback godoc
//
//	@Summary	Reviews & scores on a master's recipes (with components)
//	@Tags		employees
//	@Produce	json
//	@Param		id	path		string	true	"Employee ID"
//	@Success	200	{object}	httpx.Envelope{data=[]employees.RecipeFeedbackItem}
//	@Router		/employees/{id}/recipe-feedback [get]
func (h *Handler) RecipeFeedback(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	rows, err := h.q.ListEmployeeRecipeFeedback(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	out := make([]RecipeFeedbackItem, 0, len(rows))
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
		out = append(out, RecipeFeedbackItem{
			OrderRecipeID: row.OrderRecipeID,
			RecipeID:      row.RecipeID,
			RecipeName:    row.RecipeName,
			Strength:      row.RecipeStrength,
			Score:         row.Score,
			Review:        row.Review,
			UpdatedAt:     row.UpdatedAt,
			Components:    cv,
		})
	}
	httpx.JSON(w, http.StatusOK, out)
}

// SetShiftRequest replaces today's roster for a restaurant (by code).
type SetShiftRequest struct {
	Code        string      `json:"code"`
	EmployeeIDs []uuid.UUID `json:"employeeIds"`
}

// ShiftMaster is a master on shift with their aggregate rating.
type ShiftMaster struct {
	ID          uuid.UUID `json:"id"`
	FirstName   string    `json:"firstName"`
	LastName    string    `json:"lastName"`
	MiddleName  string    `json:"middleName"`
	ShortName   string    `json:"shortName"`
	Position    *string   `json:"position,omitempty"`
	Rating      float64   `json:"rating"`
	RatingCount int32     `json:"ratingCount"`
}

// SetShift godoc
//
//	@Summary	Set today's masters on shift (by restaurant code)
//	@Tags		restaurants
//	@Accept		json
//	@Produce	json
//	@Param		body	body		SetShiftRequest	true	"Code + employee ids"
//	@Success	200		{object}	httpx.Envelope{data=[]employees.ShiftMaster}
//	@Failure	404		{object}	httpx.Envelope
//	@Router		/restaurants/shift [post]
func (h *Handler) SetShift(w http.ResponseWriter, r *http.Request) {
	var req SetShiftRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	ctx := r.Context()
	rest, err := h.q.GetRestaurantByCode(ctx, req.Code)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "restaurant_not_found", "no restaurant for this code")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	tx, err := h.pool.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	defer tx.Rollback(ctx)
	qtx := h.q.WithTx(tx)

	if err := qtx.DeleteShiftsToday(ctx, rest.ID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	for _, empID := range req.EmployeeIDs {
		if err := qtx.AddShiftToday(ctx, db.AddShiftTodayParams{RestaurantID: rest.ID, EmployeeID: empID}); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23503" {
				httpx.Error(w, http.StatusBadRequest, "invalid_reference", "employee does not exist: "+empID.String())
				return
			}
			httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	h.writeShift(w, r, rest.ID)
}

// GetShift godoc
//
//	@Summary	Today's masters on shift in a restaurant
//	@Tags		restaurants
//	@Produce	json
//	@Param		restaurantId	path	string	true	"Restaurant ID"
//	@Success	200	{object}	httpx.Envelope{data=[]employees.ShiftMaster}
//	@Router		/restaurants/{restaurantId}/shift [get]
func (h *Handler) GetShift(w http.ResponseWriter, r *http.Request) {
	rid, err := uuid.Parse(chi.URLParam(r, "restaurantId"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid restaurant id")
		return
	}
	h.writeShift(w, r, rid)
}

func (h *Handler) writeShift(w http.ResponseWriter, r *http.Request, restaurantID uuid.UUID) {
	rows, err := h.q.ListShiftToday(r.Context(), restaurantID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	out := make([]ShiftMaster, 0, len(rows))
	for _, row := range rows {
		out = append(out, ShiftMaster{
			ID:          row.ID,
			FirstName:   row.FirstName,
			LastName:    row.LastName,
			MiddleName:  row.MiddleName,
			ShortName:   row.ShortName,
			Position:    row.Position,
			Rating:      row.Rating,
			RatingCount: row.RatingCount,
		})
	}
	httpx.JSON(w, http.StatusOK, out)
}

// ---- full roster (admin) ----

// ListFull godoc
//
//	@Summary	Full admin roster for a venue (profile + position/status + rating + shift)
//	@Tags		restaurants
//	@Produce	json
//	@Param		restaurantId	path	string	true	"Restaurant ID"
//	@Success	200	{object}	httpx.Envelope{data=[]employees.EmployeeFull}
//	@Router		/restaurants/{restaurantId}/employees-full [get]
func (h *Handler) ListFull(w http.ResponseWriter, r *http.Request) {
	rid, ok := parseRestaurantID(w, r)
	if !ok {
		return
	}
	rows, err := h.q.ListEmployeesFullByRestaurant(r.Context(), rid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	out := make([]EmployeeFull, 0, len(rows))
	for _, row := range rows {
		out = append(out, employeeFullFromList(row))
	}
	httpx.JSON(w, http.StatusOK, out)
}

// CreateFull godoc
//
//	@Summary	Create a master at a venue (admin)
//	@Tags		restaurants
//	@Accept		json
//	@Produce	json
//	@Param		restaurantId	path	string					true	"Restaurant ID"
//	@Param		body			body	employees.UpsertEmployeeBody	true	"Master data"
//	@Success	201	{object}	httpx.Envelope{data=employees.EmployeeFull}
//	@Failure	400	{object}	httpx.Envelope
//	@Router		/restaurants/{restaurantId}/employees-full [post]
func (h *Handler) CreateFull(w http.ResponseWriter, r *http.Request) {
	rid, ok := parseRestaurantID(w, r)
	if !ok {
		return
	}
	var req UpsertEmployeeBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if req.FirstName == "" || req.LastName == "" {
		httpx.Error(w, http.StatusBadRequest, "validation", "firstName and lastName are required")
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

	emp, err := qtx.CreateEmployee(ctx, db.CreateEmployeeParams{
		FirstName:  req.FirstName,
		LastName:   req.LastName,
		MiddleName: req.MiddleName,
		ShortName:  req.ShortName,
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	// Profile extras (phone/photo/tip) go on the employees row.
	if req.Phone != nil || req.PhotoSlug != nil || req.TipUrl != nil {
		if _, err := qtx.UpdateEmployee(ctx, db.UpdateEmployeeParams{
			ID:        emp.ID,
			Phone:     req.Phone,
			PhotoSlug: req.PhotoSlug,
			TipUrl:    req.TipUrl,
		}); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
			return
		}
	}
	if err := qtx.LinkEmployeeRestaurant(ctx, db.LinkEmployeeRestaurantParams{
		EmployeeID:   emp.ID,
		RestaurantID: rid,
		Position:     req.Position,
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	if req.Status != nil {
		if err := qtx.UpdateEmployeeRestaurant(ctx, db.UpdateEmployeeRestaurantParams{
			EmployeeID:   emp.ID,
			Status:       req.Status,
			RestaurantID: &rid,
		}); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
			return
		}
	}
	full, err := qtx.GetEmployeeFull(ctx, db.GetEmployeeFullParams{EmployeeID: emp.ID, RestaurantID: rid})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, employeeFullFromGet(full))
}

// TipUrl godoc
//
//	@Summary	A master's personal tips link (Нетмонет)
//	@Tags		employees
//	@Produce	json
//	@Param		id	path		string	true	"Employee ID"
//	@Success	200	{object}	httpx.Envelope{data=string}	"url or null"
//	@Failure	404	{object}	httpx.Envelope
//	@Router		/employees/{id}/tip-url [get]
func (h *Handler) TipUrl(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	url, err := h.q.GetEmployeeTipUrl(r.Context(), id)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "not_found", "employee not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, url) // *string → data: "…" or null
}

// SetShiftByIDRequest sets today's roster for a venue identified by id.
type SetShiftByIDRequest struct {
	EmployeeIDs []uuid.UUID `json:"employeeIds"`
}

// SetShiftByID godoc
//
//	@Summary	Set today's masters on shift (by restaurant id)
//	@Tags		restaurants
//	@Accept		json
//	@Produce	json
//	@Param		restaurantId	path	string							true	"Restaurant ID"
//	@Param		body			body	employees.SetShiftByIDRequest	true	"Employee ids"
//	@Success	200	{object}	httpx.Envelope{data=[]employees.ShiftMaster}
//	@Router		/restaurants/{restaurantId}/shift [post]
func (h *Handler) SetShiftByID(w http.ResponseWriter, r *http.Request) {
	rid, ok := parseRestaurantID(w, r)
	if !ok {
		return
	}
	var req SetShiftByIDRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
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

	if err := qtx.DeleteShiftsToday(ctx, rid); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	for _, empID := range req.EmployeeIDs {
		if err := qtx.AddShiftToday(ctx, db.AddShiftTodayParams{RestaurantID: rid, EmployeeID: empID}); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23503" {
				httpx.Error(w, http.StatusBadRequest, "invalid_reference", "employee does not exist: "+empID.String())
				return
			}
			httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
			return
		}
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	h.writeShift(w, r, rid)
}

// ---- shift schedule ----

// ScheduleRow is one master's row in the schedule grid: a date→on map over the
// requested range (matches the web ScheduleRow type).
type ScheduleRow struct {
	EmployeeID uuid.UUID       `json:"employeeId"`
	ShortName  string          `json:"shortName"`
	Position   string          `json:"position"`
	Days       map[string]bool `json:"days"`
}

const dateLayout = "2006-01-02"

// Schedule godoc
//
//	@Summary	Shift-schedule grid for a venue over [from,to]
//	@Tags		restaurants
//	@Produce	json
//	@Param		restaurantId	path	string	true	"Restaurant ID"
//	@Param		from			query	string	true	"YYYY-MM-DD (inclusive)"
//	@Param		to				query	string	true	"YYYY-MM-DD (inclusive)"
//	@Success	200	{object}	httpx.Envelope{data=[]employees.ScheduleRow}
//	@Router		/restaurants/{restaurantId}/schedule [get]
func (h *Handler) Schedule(w http.ResponseWriter, r *http.Request) {
	rid, ok := parseRestaurantID(w, r)
	if !ok {
		return
	}
	from, err := time.Parse(dateLayout, r.URL.Query().Get("from"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid 'from' date (want YYYY-MM-DD)")
		return
	}
	to, err := time.Parse(dateLayout, r.URL.Query().Get("to"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid 'to' date (want YYYY-MM-DD)")
		return
	}
	ctx := r.Context()

	// Seed one row per active master of the venue, with every day in range = false.
	emps, err := h.q.ListEmployeesFullByRestaurant(ctx, rid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	rows := make([]*ScheduleRow, 0, len(emps))
	byEmp := make(map[uuid.UUID]*ScheduleRow)
	for _, e := range emps {
		if e.Status != "active" {
			continue
		}
		row := &ScheduleRow{
			EmployeeID: e.ID,
			ShortName:  e.ShortName,
			Position:   e.Position,
			Days:       emptyDayMap(from, to),
		}
		rows = append(rows, row)
		byEmp[e.ID] = row
	}

	// Overlay actual scheduled days; add any scheduled master not already listed.
	sch, err := h.q.ListScheduleRange(ctx, db.ListScheduleRangeParams{
		RestaurantID: rid,
		FromDate:     from,
		ToDate:       to,
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	for _, s := range sch {
		row := byEmp[s.EmployeeID]
		if row == nil {
			row = &ScheduleRow{
				EmployeeID: s.EmployeeID,
				ShortName:  s.ShortName,
				Position:   s.Position,
				Days:       emptyDayMap(from, to),
			}
			rows = append(rows, row)
			byEmp[s.EmployeeID] = row
		}
		row.Days[s.WorkDate.Format(dateLayout)] = true
	}

	out := make([]ScheduleRow, 0, len(rows))
	for _, row := range rows {
		out = append(out, *row)
	}
	httpx.JSON(w, http.StatusOK, out)
}

// SetScheduleDayRequest toggles one schedule day for a master.
type SetScheduleDayRequest struct {
	Date         string     `json:"date"` // YYYY-MM-DD
	On           bool       `json:"on"`
	RestaurantID *uuid.UUID `json:"restaurantId,omitempty"`
}

// SetScheduleDay godoc
//
//	@Summary	Toggle a master's shift-schedule day (on=insert, off=delete)
//	@Tags		employees
//	@Accept		json
//	@Produce	json
//	@Param		id		path	string							true	"Employee ID"
//	@Param		body	body	employees.SetScheduleDayRequest	true	"date + on flag"
//	@Success	204		{object}	nil
//	@Failure	404		{object}	httpx.Envelope
//	@Router		/employees/{id}/schedule [post]
func (h *Handler) SetScheduleDay(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var req SetScheduleDayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	day, err := time.Parse(dateLayout, req.Date)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid date (want YYYY-MM-DD)")
		return
	}
	ctx := r.Context()

	// Derive the venue from the request, else from the master's link.
	rid := uuid.Nil
	if req.RestaurantID != nil {
		rid = *req.RestaurantID
	} else {
		got, err := h.q.GetEmployeeAnyRestaurant(ctx, id)
		if errors.Is(err, pgx.ErrNoRows) {
			httpx.Error(w, http.StatusNotFound, "not_found", "employee is not linked to any restaurant")
			return
		}
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
			return
		}
		rid = got
	}

	if req.On {
		if err := h.q.AddSchedule(ctx, db.AddScheduleParams{RestaurantID: rid, EmployeeID: id, WorkDate: day}); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == "23503" {
				httpx.Error(w, http.StatusBadRequest, "invalid_reference", "employee or restaurant does not exist")
				return
			}
			httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
			return
		}
	} else {
		if err := h.q.DeleteSchedule(ctx, db.DeleteScheduleParams{RestaurantID: rid, EmployeeID: id, WorkDate: day}); err != nil {
			httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- guests (admin) ----

// ListGuests godoc
//
//	@Summary	Guests seen at a venue (distinct users via orders, with aggregates)
//	@Tags		restaurants
//	@Produce	json
//	@Param		restaurantId	path	string	true	"Restaurant ID"
//	@Success	200	{object}	httpx.Envelope{data=[]users.GuestSummary}
//	@Router		/restaurants/{restaurantId}/guests [get]
func (h *Handler) ListGuests(w http.ResponseWriter, r *http.Request) {
	rid, ok := parseRestaurantID(w, r)
	if !ok {
		return
	}
	rows, err := h.q.ListGuestsByRestaurant(r.Context(), rid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	out := make([]users.GuestSummary, 0, len(rows))
	for _, g := range rows {
		out = append(out, users.GuestSummaryFromRestaurantRow(g))
	}
	httpx.JSON(w, http.StatusOK, out)
}

// ---- helpers ----

func employeeFullFromList(r db.ListEmployeesFullByRestaurantRow) EmployeeFull {
	return EmployeeFull{
		ID:          r.ID,
		FirstName:   r.FirstName,
		LastName:    r.LastName,
		MiddleName:  r.MiddleName,
		ShortName:   r.ShortName,
		Position:    r.Position,
		Phone:       r.Phone,
		PhotoSlug:   r.PhotoSlug,
		TipUrl:      r.TipUrl,
		Rating:      r.Rating,
		RatingCount: r.RatingCount,
		OnShift:     asBool(r.OnShift),
		Status:      r.Status,
	}
}

func employeeFullFromGet(r db.GetEmployeeFullRow) EmployeeFull {
	return EmployeeFull{
		ID:          r.ID,
		FirstName:   r.FirstName,
		LastName:    r.LastName,
		MiddleName:  r.MiddleName,
		ShortName:   r.ShortName,
		Position:    r.Position,
		Phone:       r.Phone,
		PhotoSlug:   r.PhotoSlug,
		TipUrl:      r.TipUrl,
		Rating:      r.Rating,
		RatingCount: r.RatingCount,
		OnShift:     asBool(r.OnShift),
		Status:      r.Status,
	}
}

// asBool adapts an untyped scan target (bool_or infers as interface{} in sqlc).
func asBool(v interface{}) bool {
	b, _ := v.(bool)
	return b
}

// emptyDayMap builds a date→false map covering [from,to] inclusive.
func emptyDayMap(from, to time.Time) map[string]bool {
	days := make(map[string]bool)
	for d := from; !d.After(to); d = d.AddDate(0, 0, 1) {
		days[d.Format(dateLayout)] = false
	}
	return days
}

func parseRestaurantID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	rid, err := uuid.Parse(chi.URLParam(r, "restaurantId"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid restaurant id")
		return uuid.Nil, false
	}
	return rid, true
}

func toEmployeeResponse(e db.Employee) EmployeeResponse {
	return EmployeeResponse{
		ID:         e.ID,
		FirstName:  e.FirstName,
		LastName:   e.LastName,
		MiddleName: e.MiddleName,
		ShortName:  e.ShortName,
	}
}

func toEmployeeResponses(es []db.Employee) []EmployeeResponse {
	out := make([]EmployeeResponse, 0, len(es))
	for _, e := range es {
		out = append(out, toEmployeeResponse(e))
	}
	return out
}

func parseID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid employee id")
		return uuid.Nil, false
	}
	return id, true
}

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no ambiguous chars

func genCode(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = codeAlphabet[int(b[i])%len(codeAlphabet)]
	}
	return string(b)
}
