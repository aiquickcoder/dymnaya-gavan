// Package push delivers guest-call notifications to staff devices (staff mobile
// app). It exposes a Sender interface with a NoopSender (used when FCM is not
// configured) and an FCM HTTP v1 implementation (see fcm.go) built on stdlib only.
package push

import (
	"context"
	"log"
)

// CallNotification is the payload of a guest-call push.
type CallNotification struct {
	CallID       string
	RestaurantID string
	TableID      string
	Type         string // master | coals | waiter | bill
}

// Sender delivers a guest-call push to the given device tokens.
type Sender interface {
	SendCall(ctx context.Context, tokens []string, n CallNotification) error
}

// NoopSender logs instead of sending — used when FCM credentials are absent so
// the rest of the pipeline (device registry, fan-out) still works in dev.
type NoopSender struct{}

// SendCall logs the intended fan-out.
func (NoopSender) SendCall(_ context.Context, tokens []string, n CallNotification) error {
	log.Printf("[push] noop: call=%s type=%s table=%s → %d device(s)", n.CallID, n.Type, n.TableID, len(tokens))
	return nil
}

// bodyByType maps a call type to a human notification body.
var bodyByType = map[string]string{
	"master": "Позвать мастера",
	"coals":  "Сменить угли",
	"waiter": "Позвать официанта",
	"bill":   "Попросить счёт",
}

// Title is the push title ("Стол 7").
func Title(tableID string) string { return "Стол " + tableID }

// Body is the push body for a call type.
func Body(callType string) string {
	if b, ok := bodyByType[callType]; ok {
		return b
	}
	return "Вызов от гостя"
}
