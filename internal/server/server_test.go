package server

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRoutesServe(t *testing.T) {
	// queries is nil: /health and /swagger don't touch the data layer.
	srv := New(nil)

	cases := []struct {
		path     string
		wantCode int
		contains string
	}{
		{"/health", http.StatusOK, `"status":"ok"`},
		{"/swagger/doc.json", http.StatusOK, "mixMaster API"},
		{"/users/not-a-uuid", http.StatusBadRequest, "invalid user id"},
		{"/recipes", http.StatusMethodNotAllowed, ""},
	}

	for _, c := range cases {
		method := http.MethodGet
		req := httptest.NewRequest(method, c.path, nil)
		rec := httptest.NewRecorder()
		srv.ServeHTTP(rec, req)

		if rec.Code != c.wantCode {
			t.Errorf("%s: got %d, want %d (body: %s)", c.path, rec.Code, c.wantCode, rec.Body.String())
		}
		if c.contains != "" && !strings.Contains(rec.Body.String(), c.contains) {
			t.Errorf("%s: body %q does not contain %q", c.path, rec.Body.String(), c.contains)
		}
	}
}
