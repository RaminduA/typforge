package v1

import (
	"github.com/go-chi/chi/v5"

	"typforge/apps/api/internal/project"
)

type Handlers struct {
	Health  *HealthHandler
	Project *ProjectsHandler
	Files   *FilesHandler
	Builds  *BuildsHandler
	Version *VersionsHandler
}

func NewHandlers(projectService *project.Service) *Handlers {
	return &Handlers{
		Health:  &HealthHandler{},
		Project: &ProjectsHandler{Projects: projectService},
		Files:   &FilesHandler{Projects: projectService},
		Builds:  &BuildsHandler{Projects: projectService},
		Version: &VersionsHandler{Projects: projectService},
	}
}

func RegisterRoutes(r chi.Router, h *Handlers) {
	r.Get("/health", h.Health.Get)

	r.Route("/projects", func(r chi.Router) {
		r.Get("/", h.Project.List)
		r.Post("/", h.Project.Create)

		r.Route("/{projectId}", func(r chi.Router) {
			r.Get("/", h.Project.Get)
			r.Patch("/", h.Project.Update)
			r.Delete("/", h.Project.Delete)

			r.Get("/tree", h.Files.GetTree)

			r.Get("/files", h.Files.GetFile)
			r.Post("/files", h.Files.CreateFile)
			r.Put("/files", h.Files.UpdateFile)
			r.Delete("/files", h.Files.DeleteFile)
			r.Get("/files/download", h.Files.DownloadFile)

			r.Post("/folders", h.Files.CreateFolder)
			r.Delete("/folders", h.Files.DeleteFolder)

			r.Patch("/entries/rename", h.Files.RenameEntry)

			r.Post("/uploads", h.Files.UploadEntries)

			r.Post("/upload-zip", h.Files.UploadZip)

			r.Post("/compile", h.Project.Compile)

			r.Get("/versions", h.Version.List)
			r.Post("/versions", h.Version.Create)
			r.Post("/versions/{versionId}/restore", h.Version.Restore)

			r.Post("/duplicate", h.Project.Duplicate)
			r.Get("/export", h.Project.Export)
		})
	})

	r.Route("/builds/{buildId}", func(r chi.Router) {
		r.Get("/pdf", h.Builds.GetPDF)
		r.Get("/download", h.Builds.DownloadPDF)
		r.Get("/logs", h.Builds.GetLogs)
	})
}
