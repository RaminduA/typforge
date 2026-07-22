package project

import (
	"time"

	"typforge/apps/api/internal/compiler"
)

type Project struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	EntryFile string    `json:"entryFile"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type FileNode struct {
	Name     string     `json:"name"`
	Path     string     `json:"path"`
	Type     string     `json:"type"`
	Size     int64      `json:"size,omitempty"`
	Children []FileNode `json:"children,omitempty"`
}

type CompileResult struct {
	OK          bool                  `json:"ok"`
	BuildID     string                `json:"buildId"`
	PDFURL      string                `json:"pdfUrl,omitempty"`
	DownloadURL string                `json:"downloadUrl,omitempty"`
	LogsURL     string                `json:"logsUrl"`
	DurationMs  int64                 `json:"durationMs"`
	Diagnostics []compiler.Diagnostic `json:"diagnostics,omitempty"`
}

type VersionSnapshot struct {
	ID        string    `json:"id"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"createdAt"`
}
