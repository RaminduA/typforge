package httpapi

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	v1 "typforge/apps/api/internal/http/v1"
	"typforge/apps/api/internal/project"
)

func NewRouter(projectService *project.Service) http.Handler {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(CORS)
	r.Use(MaxBodyBytes(64 << 20))

	handlers := v1.NewHandlers(projectService)

	r.Route("/api/v1", func(r chi.Router) {
		v1.RegisterRoutes(r, handlers)
	})

	return r
}
