package v1

import (
	"net/http"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"

	httpjson "typforge/apps/api/internal/httpjson"
	"typforge/apps/api/internal/project"
)

type FilesHandler struct {
	Projects *project.Service
}

type fileContentRequest struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type folderRequest struct {
	Path string `json:"path"`
}

type renameEntryRequest struct {
	Path    string `json:"path"`
	NewName string `json:"newName"`
}

func (h *FilesHandler) GetTree(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")

	tree, err := h.Projects.GetTree(r.Context(), projectID)
	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, httpjson.ErrCodeNotFound, err.Error())
		return
	}

	httpjson.WriteData(w, http.StatusOK, tree)
}

func (h *FilesHandler) GetFile(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")
	filePath := r.URL.Query().Get("path")

	content, err := h.Projects.ReadFile(r.Context(), projectID, filePath)
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, err.Error())
		return
	}

	httpjson.WriteData(w, http.StatusOK, map[string]string{
		"path":    filePath,
		"content": string(content),
	})
}

func (h *FilesHandler) CreateFile(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")

	var req fileContentRequest
	if err := httpjson.DecodeJSON(r, &req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, "Invalid JSON body")
		return
	}

	if err := h.Projects.CreateFile(r.Context(), projectID, req.Path, []byte(req.Content)); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, err.Error())
		return
	}

	httpjson.WriteData(w, http.StatusCreated, map[string]string{
		"path": req.Path,
	})
}

func (h *FilesHandler) UpdateFile(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")
	filePath := r.URL.Query().Get("path")

	var req fileContentRequest
	if err := httpjson.DecodeJSON(r, &req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, "Invalid JSON body")
		return
	}

	if filePath == "" {
		filePath = req.Path
	}

	if err := h.Projects.WriteFile(r.Context(), projectID, filePath, []byte(req.Content)); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, err.Error())
		return
	}

	httpjson.WriteData(w, http.StatusOK, map[string]string{
		"path": filePath,
	})
}

func (h *FilesHandler) DeleteFile(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")
	filePath := r.URL.Query().Get("path")

	if err := h.Projects.DeleteFile(r.Context(), projectID, filePath); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *FilesHandler) CreateFolder(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")

	var req folderRequest
	if err := httpjson.DecodeJSON(r, &req); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, "Invalid JSON body")
		return
	}

	if err := h.Projects.CreateFolder(r.Context(), projectID, req.Path); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, err.Error())
		return
	}

	httpjson.WriteData(w, http.StatusCreated, map[string]string{
		"path": req.Path,
	})
}

func (h *FilesHandler) DeleteFolder(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")
	folderPath := r.URL.Query().Get("path")

	if err := h.Projects.DeleteFolder(r.Context(), projectID, folderPath); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, err.Error())
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *FilesHandler) UploadZip(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, "Invalid multipart upload")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, "Missing ZIP file field named 'file'")
		return
	}
	defer file.Close()

	uploaded, err := h.Projects.UploadZip(r.Context(), projectID, file, header.Size)
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, err.Error())
		return
	}

	httpjson.WriteData(w, http.StatusOK, map[string]interface{}{
		"files": uploaded,
	})
}

func (h *FilesHandler) RenameEntry(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")

	var request renameEntryRequest

	if err := httpjson.DecodeJSON(r, &request); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, "Invalid JSON body")
		return
	}

	newPath, err := h.Projects.RenameEntry(r.Context(), projectID, request.Path, request.NewName)
	if err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, err.Error())
		return
	}

	httpjson.WriteData(w, http.StatusOK, map[string]string{"path": newPath})
}

func (h *FilesHandler) UploadEntries(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")

	if err := r.ParseMultipartForm(64 << 20); err != nil {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, "Invalid multipart upload")
		return
	}

	form := r.MultipartForm

	files := form.File["files"]
	paths := form.Value["paths"]

	if len(files) == 0 {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, "No files were uploaded")
		return
	}

	if len(files) != len(paths) {
		httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, "Every uploaded file must have a destination path")
		return
	}

	uploadedPaths := make([]string, 0, len(files))

	for index, fileHeader := range files {
		source, err := fileHeader.Open()

		if err != nil {
			httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, err.Error())
			return
		}

		uploadErr := h.Projects.UploadFile(r.Context(), projectID, paths[index], source, fileHeader.Size)

		closeErr := source.Close()

		if uploadErr != nil {
			httpjson.WriteError(w, http.StatusBadRequest, httpjson.ErrCodeBadRequest, uploadErr.Error())
			return
		}

		if closeErr != nil {
			httpjson.WriteError(w, http.StatusInternalServerError, httpjson.ErrCodeInternal, closeErr.Error())
			return
		}

		uploadedPaths = append(uploadedPaths, paths[index])
	}

	httpjson.WriteData(w, http.StatusCreated, map[string]interface{}{"paths": uploadedPaths})
}

func (h *FilesHandler) DownloadFile(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "projectId")

	filePath := r.URL.Query().Get("path")

	target, err := h.Projects.GetProjectFilePath(r.Context(), projectID, filePath)

	if err != nil {
		httpjson.WriteError(w, http.StatusNotFound, httpjson.ErrCodeNotFound, err.Error())
		return
	}

	fileName := filepath.Base(target)

	fileName = strings.ReplaceAll(fileName, `"`, "_")

	w.Header().Set("Content-Disposition", `attachment; filename="`+fileName+`"`)

	http.ServeFile(w, r, target)
}
