// Package httpx provides the shared API response envelope and helpers.
package httpx

import (
	"encoding/json"
	"net/http"
)

// Envelope is the single response shape for the whole API: { data, error } (rule R1.3).
type Envelope struct {
	Data  any       `json:"data,omitempty"`
	Error *APIError `json:"error,omitempty"`
}

// APIError describes a failure in a machine-readable way.
type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// JSON writes a successful payload wrapped in the envelope.
func JSON(w http.ResponseWriter, status int, data any) {
	write(w, status, Envelope{Data: data})
}

// Error writes a failure wrapped in the envelope.
func Error(w http.ResponseWriter, status int, code, message string) {
	write(w, status, Envelope{Error: &APIError{Code: code, Message: message}})
}

func write(w http.ResponseWriter, status int, body Envelope) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
