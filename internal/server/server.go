// Package server assembles the HTTP router and mounts all domain routes.
package server

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	httpSwagger "github.com/swaggo/http-swagger/v2"

	"mixmaster/internal/db"
	"mixmaster/internal/employees"
	"mixmaster/internal/health"
	"mixmaster/internal/menu"
	"mixmaster/internal/orders"
	"mixmaster/internal/recipes"
	"mixmaster/internal/users"

	_ "mixmaster/api" // generated swagger docs
)

// New builds the application HTTP handler with all routes mounted.
func New(pool *pgxpool.Pool) http.Handler {
	queries := db.New(pool)
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(15 * time.Second))

	// Dev-friendly CORS so the Vite web app (different port) can call the API.
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type"},
		MaxAge:         300,
	}))

	r.Get("/health", health.Check)
	r.Get("/swagger/*", httpSwagger.Handler(httpSwagger.URL("/swagger/doc.json")))

	usersH := users.New(queries)
	employeesH := employees.New(pool, queries)
	recipesH := recipes.New(pool, queries)
	ordersH := orders.New(pool, queries)
	menuH := menu.New(pool, queries)

	r.Route("/users", usersH.Routes)
	r.Route("/recipes", recipesH.Routes)
	r.Route("/orders", ordersH.Routes)
	r.Route("/order-recipes", ordersH.OrderRecipeRoutes)
	r.Route("/menu", menuH.Routes)
	employeesH.Mount(r) // mounts /employees and /restaurants

	return r
}
