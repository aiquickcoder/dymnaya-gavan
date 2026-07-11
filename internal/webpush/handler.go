package webpush

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"mixmaster/internal/httpx"
)

// Handler exposes the Web Push subscription API and fans out notifications.
type Handler struct {
	pool   *pgxpool.Pool
	sender *Sender
}

// New builds the handler. sender may be nil (Web Push disabled) — endpoints then
// respond gracefully so the frontend degrades to in-app sound only.
func New(pool *pgxpool.Pool, sender *Sender) *Handler {
	return &Handler{pool: pool, sender: sender}
}

// Enabled reports whether a VAPID sender is configured.
func (h *Handler) Enabled() bool { return h.sender != nil }

// Routes mounts the webpush subtree (called via r.Route("/webpush", …)).
func (h *Handler) Routes(r chi.Router) {
	r.Get("/vapid", h.Vapid)
	r.Post("/subscribe", h.Subscribe)
	r.Post("/unsubscribe", h.Unsubscribe)
	r.Post("/test", h.Test)
}

// Vapid returns the public application server key for PushManager.subscribe().
func (h *Handler) Vapid(w http.ResponseWriter, r *http.Request) {
	key := ""
	if h.sender != nil {
		key = h.sender.PublicKey()
	}
	httpx.JSON(w, http.StatusOK, map[string]any{"publicKey": key, "enabled": h.sender != nil})
}

type subscribeReq struct {
	RestaurantID *uuid.UUID `json:"restaurantId"`
	Endpoint     string     `json:"endpoint"`
	Keys         struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

// Subscribe stores (or refreshes) a browser subscription.
func (h *Handler) Subscribe(w http.ResponseWriter, r *http.Request) {
	var req subscribeReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil ||
		req.Endpoint == "" || req.Keys.P256dh == "" || req.Keys.Auth == "" {
		httpx.Error(w, http.StatusBadRequest, "bad_request", "endpoint and keys are required")
		return
	}
	_, err := h.pool.Exec(r.Context(),
		`insert into webpush_subscriptions (restaurant_id, endpoint, p256dh, auth)
		 values ($1,$2,$3,$4)
		 on conflict (endpoint) do update
		   set p256dh = excluded.p256dh, auth = excluded.auth, restaurant_id = excluded.restaurant_id`,
		req.RestaurantID, req.Endpoint, req.Keys.P256dh, req.Keys.Auth)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]bool{"ok": true})
}

type unsubReq struct {
	Endpoint string `json:"endpoint"`
}

// Unsubscribe drops a subscription by endpoint.
func (h *Handler) Unsubscribe(w http.ResponseWriter, r *http.Request) {
	var req unsubReq
	_ = json.NewDecoder(r.Body).Decode(&req)
	if req.Endpoint != "" {
		_, _ = h.pool.Exec(r.Context(), `delete from webpush_subscriptions where endpoint = $1`, req.Endpoint)
	}
	httpx.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// Test sends a sample call notification to every subscription (demo trigger).
func (h *Handler) Test(w http.ResponseWriter, r *http.Request) {
	if h.sender == nil {
		httpx.Error(w, http.StatusServiceUnavailable, "disabled", "web push is not configured")
		return
	}
	sent := h.Broadcast(r.Context(), Notification{
		Title: "Стол 7 · VIP",
		Body:  "Гость зовёт мастера",
		URL:   "/admin/calls",
		Tag:   "call-test",
	})
	httpx.JSON(w, http.StatusOK, map[string]int{"sent": sent})
}

// Notify is the primitive-typed entry point used by the calls module (avoids
// importing this package's types into calls).
func (h *Handler) Notify(ctx context.Context, title, body, targetURL, tag string) {
	if h.sender == nil {
		return
	}
	h.Broadcast(ctx, Notification{Title: title, Body: body, URL: targetURL, Tag: tag})
}

// Broadcast sends n to all stored subscriptions, pruning any the push service
// reports as gone (404/410). Returns how many were delivered (2xx).
func (h *Handler) Broadcast(ctx context.Context, n Notification) int {
	if h.sender == nil {
		return 0
	}
	rows, err := h.pool.Query(ctx, `select endpoint, p256dh, auth from webpush_subscriptions`)
	if err != nil {
		log.Printf("[webpush] list: %v", err)
		return 0
	}
	var subs []Subscription
	for rows.Next() {
		var s Subscription
		if err := rows.Scan(&s.Endpoint, &s.P256dh, &s.Auth); err == nil {
			subs = append(subs, s)
		}
	}
	rows.Close()

	sent := 0
	for _, s := range subs {
		status, err := h.sender.Send(ctx, s, n)
		if err != nil {
			log.Printf("[webpush] send: %v", err)
			continue
		}
		switch {
		case status == http.StatusNotFound || status == http.StatusGone:
			_, _ = h.pool.Exec(ctx, `delete from webpush_subscriptions where endpoint = $1`, s.Endpoint)
		case status >= 200 && status < 300:
			sent++
		default:
			log.Printf("[webpush] endpoint returned %d", status)
		}
	}
	return sent
}
