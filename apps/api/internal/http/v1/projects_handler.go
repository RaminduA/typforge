package v1

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	httpjson "typforge/apps/api/internal/httpjson"
	"typforge/apps/api/internal/project"
)

type ProjectsHandler struct {
	Projects *project.Service
}

type createProjectRequest struct {
	Name string `json:"name"`
}

type updateProjectRequest struct {
	Name string `json:"name"`
}

type compileProjectRequest struct {
	Entry string `json:"entry"`
}

func (h *ProjectsHandler) List(w http.ResponseWriter, r *http.Request) {
	projects, err := h.Projects.ListProjects(r.Context())
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, httpjson.ErrCodeInternal, err.Error())
		return
	}

	httpjson.WriteData(w, http.StatusOK, projects)
}

func (h *ProjectsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createProjectRequest
	if err := httpjson.DecodeJSON(r, &req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, "Invalid JSON body")
		return
	}

	created, err := h.Projects.CreateProject(r.Context(), req.Name)
	if err != nil {
		httpjson.WriteError(w, http.StatusInternalServerError, httpjson.ErrCodeInternal, err.Error())
		return
	}

	httpjson.WriteData(w, http.StatusCreated, created)
}

func (h *ProjectsHandler) Get(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")

	found, err := h.Projects.GetProject(r.Context(), projectID)
	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, httpjson.ErrCodeNotFound, err.Error())
		return
	}

	httpjson.WriteData(w, http.StatusOK, found)
}

func (h *ProjectsHandler) Update(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")

	var req updateProjectRequest
	if err := httpjson.DecodeJSON(r, &req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, "Invalid JSON body")
		return
	}

	updated, err := h.Projects.UpdateProject(r.Context(), projectID, req.Name)
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, err.Error())
		return
	}

	httpjson.WriteData(w, http.StatusOK, updated)
}

func (h *ProjectsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")

	if err := h.Projects.DeleteProject(r.Context(), projectID); err != nil {
		httpjson.WriteError(w, http.StatusNotFound, httpjson.ErrCodeNotFound, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *ProjectsHandler) Compile(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")

	var req compileProjectRequest
	if err := httpjson.DecodeJSON(r, &req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, "Invalid JSON body")
		return
	}

	if req.Entry == "" {
		req.Entry = "main.typ"
	}

	result, err := h.Projects.CompileProject(r.Context(), projectID, req.Entry)
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, err.Error())
		return
	}

	status := http.StatusOK
	if !result.OK {
		status = http.StatusUnprocessableEntity
	}

	httpjson.WriteData(w, status, result)
}

func (h *ProjectsHandler) Duplicate(
	w http.ResponseWriter,
	r *http.Request,
) {
	projectID := chi.URLParam(
		r,
		"projectId",
	)

	duplicate, err :=
		h.Projects.DuplicateProject(
			r.Context(),
			projectID,
		)

	if err != nil {
		httpjson.WriteError(
			w,
			http.StatusBadRequest,
			httpjson.ErrCodeBadRequest,
			err.Error(),
		)
		return
	}

	httpjson.WriteData(
		w,
		http.StatusCreated,
		duplicate,
	)
}

func (h *ProjectsHandler) Export(
	w http.ResponseWriter,
	r *http.Request,
) {
	projectID := chi.URLParam(
		r,
		"projectId",
	)

	currentProject, err :=
		h.Projects.GetProject(
			r.Context(),
			projectID,
		)

	if err != nil {
		httpjson.WriteError(
			w,
			http.StatusNotFound,
			httpjson.ErrCodeNotFound,
			err.Error(),
		)
		return
	}

	fileName := strings.TrimSpace(
		currentProject.Name,
	)

	fileName = strings.ReplaceAll(
		fileName,
		`"`,
		"_",
	)

	if fileName == "" {
		fileName = "typforge-project"
	}

	w.Header().Set(
		"Content-Type",
		"application/zip",
	)

	w.Header().Set(
		"Content-Disposition",
		`attachment; filename="`+
			fileName+
			`.zip"`,
	)

	if err := h.Projects.ExportProjectZIP(
		r.Context(),
		projectID,
		w,
	); err != nil {
		return
	}
}
