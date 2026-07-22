package v1

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	httpjson "typforge/apps/api/internal/httpjson"
	"typforge/apps/api/internal/project"
)

type VersionsHandler struct {
	Projects *project.Service
}

type createVersionRequest struct {
	Message string `json:"message"`
}

func (h *VersionsHandler) List(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")

	versions, err := h.Projects.ListVersions(r.Context(), projectID)
	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, httpjson.ErrCodeNotFound, err.Error())
		return
	}

	httpjson.WriteData(w, http.StatusOK, versions)
}

func (h *VersionsHandler) Create(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")

	var req createVersionRequest
	if err := httpjson.DecodeJSON(r, &req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, "Invalid JSON body")
		return
	}

	version, err := h.Projects.CreateVersion(r.Context(), projectID, req.Message)
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, err.Error())
		return
	}

	httpjson.WriteData(w, http.StatusCreated, version)
}

func (h *VersionsHandler) Restore(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")
	versionID := chi.URLParam(r, "versionId")

	if err := h.Projects.RestoreVersion(r.Context(), projectID, versionID); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, err.Error())
		return
	}

	httpjson.WriteData(w, http.StatusOK, map[string]string{
		"projectId": projectID,
		"versionId": versionID,
		"status":    "restored",
	})
}
