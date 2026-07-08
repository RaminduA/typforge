package project

import (
	"context"
	"io"
	"os"
	"path/filepath"
	"time"

	"typforge/apps/api/internal/compiler"
	"typforge/apps/api/internal/zipupload"
)

type Service struct {
	Store    *FileSystemStore
	Compiler compiler.Compiler
}

func NewService(store *FileSystemStore, typstCompiler compiler.Compiler) *Service {
	return &Service{
		Store:    store,
		Compiler: typstCompiler,
	}
}

func (s *Service) CreateProject(ctx context.Context, name string) (*Project, error) {
	return s.Store.CreateProject(ctx, name)
}

func (s *Service) ListProjects(ctx context.Context) ([]Project, error) {
	return s.Store.ListProjects(ctx)
}

func (s *Service) GetProject(ctx context.Context, projectID string) (*Project, error) {
	return s.Store.GetProject(ctx, projectID)
}

func (s *Service) UpdateProject(ctx context.Context, projectID string, name string) (*Project, error) {
	return s.Store.UpdateProject(ctx, projectID, name)
}

func (s *Service) DeleteProject(ctx context.Context, projectID string) error {
	return s.Store.DeleteProject(ctx, projectID)
}

func (s *Service) GetTree(ctx context.Context, projectID string) (*FileNode, error) {
	return s.Store.GetTree(ctx, projectID)
}

func (s *Service) ReadFile(ctx context.Context, projectID string, projectPath string) ([]byte, error) {
	return s.Store.ReadFile(ctx, projectID, projectPath)
}

func (s *Service) WriteFile(ctx context.Context, projectID string, projectPath string, content []byte) error {
	return s.Store.WriteFile(ctx, projectID, projectPath, content)
}

func (s *Service) CreateFile(ctx context.Context, projectID string, projectPath string, content []byte) error {
	return s.Store.CreateFile(ctx, projectID, projectPath, content)
}

func (s *Service) DeleteFile(ctx context.Context, projectID string, projectPath string) error {
	return s.Store.DeleteFile(ctx, projectID, projectPath)
}

func (s *Service) CreateFolder(ctx context.Context, projectID string, folderPath string) error {
	return s.Store.CreateFolder(ctx, projectID, folderPath)
}

func (s *Service) DeleteFolder(ctx context.Context, projectID string, folderPath string) error {
	return s.Store.DeleteFolder(ctx, projectID, folderPath)
}

func (s *Service) UploadZip(ctx context.Context, projectID string, reader io.ReaderAt, size int64) ([]string, error) {
	projectDir := s.Store.ProjectDir(projectID)

	if _, err := os.Stat(projectDir); err != nil {
		return nil, err
	}

	return zipupload.Extract(reader, size, projectDir)
}

func (s *Service) CompileProject(ctx context.Context, projectID string, entry string) (*CompileResult, error) {
	entry, err := ValidateEntryFile(entry)
	if err != nil {
		return nil, err
	}

	projectDir := s.Store.ProjectDir(projectID)
	if _, err := os.Stat(filepath.Join(projectDir, filepath.FromSlash(entry))); err != nil {
		return nil, err
	}

	buildID := NewID("bld")
	buildDir, err := s.Store.CreateBuildDir(buildID)
	if err != nil {
		return nil, err
	}

	outputName := ".typforge-output.pdf"
	hostOutputPath := filepath.Join(projectDir, outputName)
	_ = os.Remove(hostOutputPath)
	defer os.Remove(hostOutputPath)

	start := time.Now()

	compileResult, err := s.Compiler.Compile(ctx, compiler.CompileRequest{
		ProjectDir: projectDir,
		EntryFile:  entry,
		OutputFile: outputName,
	})
	if err != nil {
		return nil, err
	}

	durationMs := time.Since(start).Milliseconds()

	logPath := filepath.Join(buildDir, "compile.log")
	if err := os.WriteFile(logPath, []byte(compileResult.Logs), 0644); err != nil {
		return nil, err
	}

	result := &CompileResult{
		OK:          compileResult.OK,
		BuildID:     buildID,
		LogsURL:     "/api/v1/builds/" + buildID + "/logs",
		DurationMs:  durationMs,
		Diagnostics: compileResult.Diagnostics,
	}

	if compileResult.OK {
		pdfBytes, err := os.ReadFile(hostOutputPath)
		if err != nil {
			result.OK = false
			result.Diagnostics = append(result.Diagnostics, compiler.Diagnostic{
				Severity: "error",
				Message:  "Typst reported success, but output PDF was not found",
			})
			return result, nil
		}

		outputPDF := filepath.Join(buildDir, "output.pdf")
		if err := os.WriteFile(outputPDF, pdfBytes, 0644); err != nil {
			return nil, err
		}

		result.PDFURL = "/api/v1/builds/" + buildID + "/pdf"
		result.DownloadURL = "/api/v1/builds/" + buildID + "/download"
	}

	return result, nil
}

func (s *Service) GetBuildPDFPath(ctx context.Context, buildID string) (string, error) {
	return s.Store.GetBuildPDFPath(buildID)
}

func (s *Service) GetBuildLogs(ctx context.Context, buildID string) (string, error) {
	return s.Store.GetBuildLogs(buildID)
}

func (s *Service) ListVersions(ctx context.Context, projectID string) ([]VersionSnapshot, error) {
	return s.Store.ListVersions(ctx, projectID)
}

func (s *Service) CreateVersion(ctx context.Context, projectID string, message string) (*VersionSnapshot, error) {
	return s.Store.CreateVersion(ctx, projectID, message)
}

func (s *Service) RestoreVersion(ctx context.Context, projectID string, versionID string) error {
	return s.Store.RestoreVersion(ctx, projectID, versionID)
}
