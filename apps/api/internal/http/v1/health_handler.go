package v1

import (
	"net/http"
	"time"

	httpjson "typforge/apps/api/internal/httpjson"
)

type HealthHandler struct{}

func (h *HealthHandler) Get(w http.ResponseWriter, r *http.Request) {
	httpjson.WriteData(w, http.StatusOK, map[string]interface{}{
		"status":     "ok",
		"service":    "typforge-api",
		"apiVersion": "v1",
		"timestamp":  time.Now().UTC(),
	})
}
