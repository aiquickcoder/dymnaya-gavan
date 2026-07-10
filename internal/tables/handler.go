// Package tables implements the floor-map domain ("Карта зала"): zone + table
// configuration (CRUD, drag-move) and a live per-table state snapshot. There is
// no stored table status — occupancy is derived from the open order linked to the
// table's label via orders/table_assignments. Order mutations (add mix, close)
// reuse the orders domain's queries. Routes are flat under /tables (POST-with-body
// for the restaurant-scoped lists) so they don't collide with the /restaurants
// subtree owned by the employees handler.
package tables

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"mixmaster/internal/db"
	"mixmaster/internal/httpx"
)

// Handler groups the /tables endpoints.
type Handler struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

// New creates a tables Handler.
func New(pool *pgxpool.Pool, q *db.Queries) *Handler {
	return &Handler{pool: pool, q: q}
}

// Routes mounts the tables subtree (called via r.Route("/tables", …)).
func (h *Handler) Routes(r chi.Router) {
	r.Post("/", h.Create)
	r.Post("/list", h.List)
	r.Post("/zones", h.Zones)
	r.Post("/states", h.States)
	r.Patch("/{id}", h.Update)
	r.Delete("/{id}", h.Delete)
	r.Post("/{id}/move", h.Move)
	r.Post("/{id}/mix", h.AddMix)
	r.Post("/{id}/custom-mix", h.AddCustomMix)
	r.Post("/{id}/close", h.Close)
}

// ---- DTOs ----

// TableResponse is the floor-map view of a table (camelCase; mirrors the web
// TableView type). Live fields come from the open order; total/guests are not
// tracked on orders yet, so they are always null (deferred to the analytics wave).
type TableResponse struct {
	ID           uuid.UUID `json:"id"`
	RestaurantID uuid.UUID `json:"restaurantId"`
	Label        string    `json:"label"`
	X            float64   `json:"x"`
	Y            float64   `json:"y"`
	Seats        int32     `json:"seats"`
	Shape        string    `json:"shape"`
	Zone         string    `json:"zone"`
	Status       string    `json:"status"`
	OrderID      *string   `json:"orderId"`
	OpenedAt     *string   `json:"openedAt"`
	Minutes      *int32    `json:"minutes"`
	Total        *float64  `json:"total"`
	Guests       *int32    `json:"guests"`
}

func tableFromRow(row db.ListTablesFullRow) TableResponse {
	occupied := row.OpenedAt != nil && row.OrderID != nil
	t := TableResponse{
		ID:           row.ID,
		RestaurantID: row.RestaurantID,
		Label:        row.Label,
		X:            row.X,
		Y:            row.Y,
		Seats:        row.Seats,
		Shape:        row.Shape,
		Zone:         zoneStr(row.ZoneID),
		Status:       "free",
	}
	if occupied {
		t.Status = "occupied"
		oid := row.OrderID.String()
		t.OrderID = &oid
		iso := row.OpenedAt.Format(time.RFC3339)
		t.OpenedAt = &iso
		m := minutesSince(*row.OpenedAt)
		t.Minutes = &m
	}
	return t
}

// ZoneResponse mirrors the web Zone type.
type ZoneResponse struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
}

// MixView is one mix currently on a table.
type MixView struct {
	Name   string  `json:"name"`
	Master *string `json:"master"`
}

// CallView mirrors the web Call type (same shape as calls.CallResponse), so the
// table-state feed and the standalone /calls list agree field-for-field.
type CallView struct {
	ID           uuid.UUID  `json:"id"`
	RestaurantID uuid.UUID  `json:"restaurantId"`
	TableID      string     `json:"tableId"`
	TableLabel   *string    `json:"tableLabel"`
	Type         string     `json:"type"`
	Status       string     `json:"status"`
	CreatedAt    time.Time  `json:"createdAt"`
	AckedAt      *time.Time `json:"ackedAt"`
	DoneAt       *time.Time `json:"doneAt"`
}

// TableStateResponse is a live snapshot of one table (mirrors the web TableState).
type TableStateResponse struct {
	TableID    string     `json:"tableId"`
	Label      string     `json:"label"`
	Zone       *string    `json:"zone"`
	Occupied   bool       `json:"occupied"`
	SinceISO   *string    `json:"sinceISO"`
	Minutes    *int32     `json:"minutes"`
	Guests     *int32     `json:"guests"`
	MasterName *string    `json:"masterName"`
	WaiterName *string    `json:"waiterName"`
	Mixes      []MixView  `json:"mixes"`
	Calls      []CallView `json:"calls"`
	Total      *float64   `json:"total"`
}

// ---- list endpoints (restaurant-scoped, POST + body) ----

// ridBody is the shared body of the restaurant-scoped list endpoints.
type ridBody struct {
	RestaurantID uuid.UUID `json:"restaurantId"`
}

// List godoc
//
//	@Summary	List a venue's tables with live status
//	@Tags		tables
//	@Accept		json
//	@Produce	json
//	@Param		body	body		tables.ridBody	true	"restaurantId"
//	@Success	200		{object}	httpx.Envelope{data=[]tables.TableResponse}
//	@Router		/tables/list [post]
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	rid, ok := decodeRID(w, r)
	if !ok {
		return
	}
	rows, err := h.q.ListTablesFull(r.Context(), rid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	out := make([]TableResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, tableFromRow(row))
	}
	httpx.JSON(w, http.StatusOK, out)
}

// Zones godoc
//
//	@Summary	List a venue's zones
//	@Tags		tables
//	@Accept		json
//	@Produce	json
//	@Param		body	body		tables.ridBody	true	"restaurantId"
//	@Success	200		{object}	httpx.Envelope{data=[]tables.ZoneResponse}
//	@Router		/tables/zones [post]
func (h *Handler) Zones(w http.ResponseWriter, r *http.Request) {
	rid, ok := decodeRID(w, r)
	if !ok {
		return
	}
	rows, err := h.q.ListZones(r.Context(), rid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	out := make([]ZoneResponse, 0, len(rows))
	for _, z := range rows {
		out = append(out, ZoneResponse{ID: z.ID, Name: z.Name})
	}
	httpx.JSON(w, http.StatusOK, out)
}

// States godoc
//
//	@Summary	Live per-table state (occupancy, master, mixes, active calls)
//	@Tags		tables
//	@Accept		json
//	@Produce	json
//	@Param		body	body		tables.ridBody	true	"restaurantId"
//	@Success	200		{object}	httpx.Envelope{data=[]tables.TableStateResponse}
//	@Router		/tables/states [post]
func (h *Handler) States(w http.ResponseWriter, r *http.Request) {
	rid, ok := decodeRID(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	rows, err := h.q.ListTablesFull(ctx, rid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	// Active calls grouped by table label (calls store the label as table_id).
	callRows, err := h.q.ListActiveCalls(ctx, rid)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	callsByLabel := make(map[string][]CallView)
	for _, c := range callRows {
		callsByLabel[c.TableID] = append(callsByLabel[c.TableID], callView(c))
	}

	out := make([]TableStateResponse, 0, len(rows))
	for _, row := range rows {
		occupied := row.OpenedAt != nil && row.OrderID != nil
		st := TableStateResponse{
			TableID:  row.ID.String(),
			Label:    row.Label,
			Zone:     zonePtr(row.ZoneID),
			Occupied: occupied,
			Mixes:    []MixView{},
			Calls:    callsByLabel[row.Label],
		}
		if st.Calls == nil {
			st.Calls = []CallView{}
		}
		if occupied {
			iso := row.OpenedAt.Format(time.RFC3339)
			st.SinceISO = &iso
			m := minutesSince(*row.OpenedAt)
			st.Minutes = &m

			recs, err := h.q.ListActiveOrderRecipes(ctx, *row.OrderID)
			if err != nil {
				httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
				return
			}
			for _, rec := range recs {
				name := "Микс"
				if rec.RecipeName != nil && *rec.RecipeName != "" {
					name = *rec.RecipeName
				}
				master := rec.ShortName
				st.Mixes = append(st.Mixes, MixView{Name: name, Master: &master})
			}
			if len(recs) > 0 {
				master := recs[0].ShortName
				st.MasterName = &master
			}
		}
		out = append(out, st)
	}
	httpx.JSON(w, http.StatusOK, out)
}

// ---- table CRUD ----

// CreateTableBody creates a table. Only restaurantId is required; the rest default
// (label auto-numbers, shape=round, seats=4, x/y=50) like the demo.
type CreateTableBody struct {
	RestaurantID uuid.UUID `json:"restaurantId"`
	Label        string    `json:"label"`
	X            float64   `json:"x"`
	Y            float64   `json:"y"`
	Seats        int32     `json:"seats"`
	Shape        string    `json:"shape"`
	Zone         string    `json:"zone"`
}

// Create godoc
//
//	@Summary	Create a table
//	@Tags		tables
//	@Accept		json
//	@Produce	json
//	@Param		body	body		tables.CreateTableBody	true	"Table"
//	@Success	201		{object}	httpx.Envelope{data=tables.TableResponse}
//	@Router		/tables [post]
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateTableBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if req.RestaurantID == uuid.Nil {
		httpx.Error(w, http.StatusBadRequest, "validation", "restaurantId is required")
		return
	}
	ctx := r.Context()
	count, err := h.q.CountTables(ctx, req.RestaurantID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	shape := req.Shape
	if shape == "" {
		shape = "round"
	}
	seats := req.Seats
	if seats <= 0 {
		seats = 4
	}
	x, y := req.X, req.Y
	if x == 0 {
		x = 50
	}
	if y == 0 {
		y = 50
	}
	label := req.Label
	if label == "" {
		label = strconv.FormatInt(count+1, 10)
	}
	created, err := h.q.CreateTable(ctx, db.CreateTableParams{
		RestaurantID: req.RestaurantID,
		Label:        label,
		X:            x,
		Y:            y,
		Seats:        seats,
		Shape:        shape,
		ZoneID:       parseZone(req.Zone),
		SortOrder:    int32(count),
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23514" {
			httpx.Error(w, http.StatusBadRequest, "validation", "shape must be round, square or rect")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	h.writeLiveTable(w, ctx, req.RestaurantID, created.ID, http.StatusCreated)
}

// UpdateTableBody is a partial table edit; only non-null fields change.
type UpdateTableBody struct {
	Label *string  `json:"label"`
	X     *float64 `json:"x"`
	Y     *float64 `json:"y"`
	Seats *int32   `json:"seats"`
	Shape *string  `json:"shape"`
	Zone  *string  `json:"zone"`
}

// Update godoc
//
//	@Summary	Update a table (partial)
//	@Tags		tables
//	@Accept		json
//	@Produce	json
//	@Param		id		path		string					true	"Table ID"
//	@Param		body	body		tables.UpdateTableBody	true	"Fields to change"
//	@Success	200		{object}	httpx.Envelope{data=tables.TableResponse}
//	@Failure	404		{object}	httpx.Envelope
//	@Router		/tables/{id} [patch]
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var req UpdateTableBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	ctx := r.Context()
	existing, err := h.q.GetTableByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "not_found", "table not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	var zone *uuid.UUID
	if req.Zone != nil {
		zone = parseZone(*req.Zone)
	}
	if _, err := h.q.UpdateTable(ctx, db.UpdateTableParams{
		ID:     id,
		Label:  req.Label,
		X:      req.X,
		Y:      req.Y,
		Seats:  req.Seats,
		Shape:  req.Shape,
		ZoneID: zone,
	}); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23514" {
			httpx.Error(w, http.StatusBadRequest, "validation", "shape must be round, square or rect")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	h.writeLiveTable(w, ctx, existing.RestaurantID, id, http.StatusOK)
}

// MoveBody carries a drag-drop position (percent of the floor canvas).
type MoveBody struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// Move godoc
//
//	@Summary	Move a table (drag-drop position)
//	@Tags		tables
//	@Accept		json
//	@Produce	json
//	@Param		id		path	string			true	"Table ID"
//	@Param		body	body	tables.MoveBody	true	"x/y percent"
//	@Success	204		{object}	nil
//	@Router		/tables/{id}/move [post]
func (h *Handler) Move(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var req MoveBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	if err := h.q.MoveTable(r.Context(), db.MoveTableParams{ID: id, X: req.X, Y: req.Y}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Delete godoc
//
//	@Summary	Delete a table
//	@Tags		tables
//	@Produce	json
//	@Param		id	path		string	true	"Table ID"
//	@Success	204	{object}	nil
//	@Router		/tables/{id} [delete]
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	if err := h.q.DeleteTable(r.Context(), id); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- order mutations on a table (reuse the orders domain queries) ----

// AddMixBody adds a menu position to the table's order as a made mix.
type AddMixBody struct {
	MenuID     uuid.UUID `json:"menuId"`
	EmployeeID uuid.UUID `json:"employeeId"`
}

// AddMix godoc
//
//	@Summary	Add a menu mix to a table (opens the order if needed)
//	@Tags		tables
//	@Accept		json
//	@Produce	json
//	@Param		id		path	string				true	"Table ID"
//	@Param		body	body	tables.AddMixBody	true	"menuId + employeeId"
//	@Success	204		{object}	nil
//	@Failure	404		{object}	httpx.Envelope
//	@Router		/tables/{id}/mix [post]
func (h *Handler) AddMix(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var req AddMixBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	ctx := r.Context()
	tbl, err := h.q.GetTableByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "not_found", "table not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	menuItem, err := h.q.GetMenuRecipe(ctx, req.MenuID)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "not_found", "menu item not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	strength := menuItem.Strength
	h.addRecipe(w, ctx, tbl, req.EmployeeID, menuItem.Name, &strength)
}

// AddCustomMixBody adds a free-text one-off mix (master types a name).
type AddCustomMixBody struct {
	Name       string    `json:"name"`
	EmployeeID uuid.UUID `json:"employeeId"`
}

// AddCustomMix godoc
//
//	@Summary	Add a free-text mix to a table (opens the order if needed)
//	@Tags		tables
//	@Accept		json
//	@Produce	json
//	@Param		id		path	string					true	"Table ID"
//	@Param		body	body	tables.AddCustomMixBody	true	"name + employeeId"
//	@Success	204		{object}	nil
//	@Router		/tables/{id}/custom-mix [post]
func (h *Handler) AddCustomMix(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var req AddCustomMixBody
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid json body")
		return
	}
	ctx := r.Context()
	tbl, err := h.q.GetTableByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "not_found", "table not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	name := req.Name
	if name == "" {
		name = "Свой микс"
	}
	h.addRecipe(w, ctx, tbl, req.EmployeeID, name, nil)
}

// addRecipe ensures the table has an open order, creates a recipe row from the
// given name/strength, and attaches it to the order — all in one transaction.
func (h *Handler) addRecipe(w http.ResponseWriter, ctx context.Context, tbl db.VenueTable, employeeID uuid.UUID, name string, strength *int32) {
	tx, err := h.pool.Begin(ctx)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	defer tx.Rollback(ctx)
	qtx := h.q.WithTx(tx)

	orderID, err := ensureOpenOrder(ctx, qtx, tbl.RestaurantID, tbl.Label)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	recipe, err := qtx.CreateRecipe(ctx, db.CreateRecipeParams{Name: &name, Strength: strength, IsSecret: false})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	if _, err := qtx.AttachRecipe(ctx, db.AttachRecipeParams{OrderID: orderID, RecipeID: recipe.ID, EmployeeID: employeeID}); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			httpx.Error(w, http.StatusBadRequest, "invalid_reference", "employee does not exist")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Close godoc
//
//	@Summary	Close a table's order (free the table)
//	@Tags		tables
//	@Produce	json
//	@Param		id	path		string	true	"Table ID"
//	@Success	204	{object}	nil
//	@Router		/tables/{id}/close [post]
func (h *Handler) Close(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	tbl, err := h.q.GetTableByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		httpx.Error(w, http.StatusNotFound, "not_found", "table not found")
		return
	}
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	a, err := h.q.GetTableAssignment(ctx, db.GetTableAssignmentParams{RestaurantID: tbl.RestaurantID, TableID: tbl.Label})
	if errors.Is(err, pgx.ErrNoRows) {
		w.WriteHeader(http.StatusNoContent) // already free
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
	if err := qtx.DeleteTableAssignmentByOrder(ctx, a.OrderID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	if _, err := qtx.CloseOrder(ctx, a.OrderID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	if err := tx.Commit(ctx); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---- helpers ----

// ensureOpenOrder returns the id of the table's open order, creating an order and
// table_assignment if none exists (mirrors the orders domain openTable).
func ensureOpenOrder(ctx context.Context, qtx *db.Queries, restaurantID uuid.UUID, label string) (uuid.UUID, error) {
	a, err := qtx.GetTableAssignment(ctx, db.GetTableAssignmentParams{RestaurantID: restaurantID, TableID: label})
	if err == nil {
		return a.OrderID, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, err
	}
	order, err := qtx.CreateOrder(ctx, db.CreateOrderParams{TableID: label, RestaurantID: restaurantID})
	if err != nil {
		return uuid.Nil, err
	}
	if _, err := qtx.CreateTableAssignment(ctx, db.CreateTableAssignmentParams{
		RestaurantID: restaurantID,
		TableID:      label,
		OrderID:      order.ID,
	}); err != nil {
		return uuid.Nil, err
	}
	return order.ID, nil
}

// writeLiveTable re-reads the table with its live status and writes it.
func (h *Handler) writeLiveTable(w http.ResponseWriter, ctx context.Context, restaurantID, id uuid.UUID, status int) {
	rows, err := h.q.ListTablesFull(ctx, restaurantID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	for _, row := range rows {
		if row.ID == id {
			httpx.JSON(w, status, tableFromRow(row))
			return
		}
	}
	httpx.Error(w, http.StatusInternalServerError, "db_error", "table vanished after write")
}

func callView(c db.Call) CallView {
	label := c.TableID
	return CallView{
		ID:           c.ID,
		RestaurantID: c.RestaurantID,
		TableID:      c.TableID,
		TableLabel:   &label,
		Type:         c.Type,
		Status:       c.Status,
		CreatedAt:    c.CreatedAt,
		AckedAt:      c.AckedAt,
		DoneAt:       c.DoneAt,
	}
}

func minutesSince(t time.Time) int32 {
	m := int32(time.Since(t).Minutes())
	if m < 0 {
		m = 0
	}
	return m
}

func zoneStr(id *uuid.UUID) string {
	if id == nil {
		return ""
	}
	return id.String()
}

func zonePtr(id *uuid.UUID) *string {
	if id == nil {
		return nil
	}
	s := id.String()
	return &s
}

func parseZone(s string) *uuid.UUID {
	if s == "" {
		return nil
	}
	z, err := uuid.Parse(s)
	if err != nil {
		return nil
	}
	return &z
}

func decodeRID(w http.ResponseWriter, r *http.Request) (uuid.UUID, bool) {
	var req ridBody
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
		httpx.Error(w, http.StatusBadRequest, "bad_request", "invalid table id")
		return uuid.Nil, false
	}
	return id, true
}
