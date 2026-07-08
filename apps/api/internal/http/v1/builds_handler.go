package v1

import (
	"net/http"
	"path/filepath"

	"github.com/go-chi/chi/v5"

	httpjson "typforge/apps/api/internal/httpjson"
	"typforge/apps/api/internal/project"
)

type BuildsHandler struct {
	Projects *project.Service
}

func (h *BuildsHandler) GetPDF(w http.ResponseWriter, r *http.Request) {
	buildID := chi.URLParam(r, "buildId")

	pdfPath, err := h.Projects.GetBuildPDFPath(r.Context(), buildID)
	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, httpjson.ErrCodeNotFound, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "inline; filename=\""+filepath.Base(pdfPath)+"\"")
	http.ServeFile(w, r, pdfPath)
}

func (h *BuildsHandler) DownloadPDF(w http.ResponseWriter, r *http.Request) {
	buildID := chi.URLParam(r, "buildId")

	pdfPath, err := h.Projects.GetBuildPDFPath(r.Context(), buildID)
	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, httpjson.ErrCodeNotFound, err.Error())
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", "attachment; filename=\"typforge-output.pdf\"")
	http.ServeFile(w, r, pdfPath)
}

func (h *BuildsHandler) GetLogs(w http.ResponseWriter, r *http.Request) {
	buildID := chi.URLParam(r, "buildId")

	logs, err := h.Projects.GetBuildLogs(r.Context(), buildID)
	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, httpjson.ErrCodeNotFound, err.Error())
		return
	}

	httpjson.WriteData(w, http.StatusOK, map[string]string{
		"buildId": buildID,
		"logs":    logs,
	})
}
