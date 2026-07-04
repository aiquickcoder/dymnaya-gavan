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
	})
	r.Route("/restaurants", func(r chi.Router) {
		r.Post("/", h.CreateRestaurant)
		r.Post("/employees", h.ListByCode)
		r.Post("/shift", h.SetShift)               // set today's roster (by code)
		r.Get("/{restaurantId}/shift", h.GetShift) // today's masters on shift
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

// UpdateEmployeeRequest is a partial update of an employee's names.
type UpdateEmployeeRequest struct {
	FirstName  *string `json:"firstName,omitempty"`
	LastName   *string `json:"lastName,omitempty"`
	MiddleName *string `json:"middleName,omitempty"`
	ShortName  *string `json:"shortName,omitempty"`
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

	emp, err := h.q.UpdateEmployee(r.Context(), db.UpdateEmployeeParams{
		ID:         id,
		FirstName:  req.FirstName,
		LastName:   req.LastName,
		MiddleName: req.MiddleName,
		ShortName:  req.ShortName,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "not_found", "employee not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusOK, toEmployeeResponse(emp))
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

// ---- helpers ----

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
