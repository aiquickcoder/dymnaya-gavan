// Package health exposes a liveness endpoint.
package health

import (
	"net/http"

	"mixmaster/internal/httpx"
)

// Status is the health response payload.
type Status struct {
	Status string `json:"status" example:"ok"`
}

// Check godoc
//
//	@Summary	Liveness probe
//	@Tags		health
//	@Produce	json
//	@Success	200	{object}	httpx.Envelope{data=health.Status}
//	@Router		/health [get]
func Check(w http.ResponseWriter, _ *http.Request) {
	httpx.JSON(w, http.StatusOK, Status{Status: "ok"})
}
