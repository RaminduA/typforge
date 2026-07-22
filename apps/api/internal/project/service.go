package project

import (
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"typforge/apps/api/internal/compiler"
	"typforge/apps/api/internal/zipupload"
)

type Service struct {
	Store    *FileSystemStore
	Compiler compiler.Compiler
}

func NewService(store *FileSystemStore, typstCompiler compiler.Compiler) *Service {
	return &Service{Store: store, Compiler: typstCompiler}
}

func (s *Service) CreateProject(ctx context.Context, name string) (*Project, error) {
	project, err := s.Store.CreateProject(ctx, name)
	if err != nil {
		return nil, err
	}

	if err := s.Store.SyncProject(ctx, project.ID); err != nil {
		return nil, err
	}

	return project, nil
}

func (s *Service) ListProjects(ctx context.Context) ([]Project, error) {
	return s.Store.ListProjects(ctx)
}

func (s *Service) GetProject(ctx context.Context, projectID string) (*Project, error) {
	return s.Store.GetProject(ctx, projectID)
}

func (s *Service) UpdateProject(ctx context.Context, projectID string, name string) (*Project, error) {
	project, err := s.Store.UpdateProject(ctx, projectID, name)
	if err != nil {
		return nil, err
	}

	if err := s.Store.SyncProject(ctx, projectID); err != nil {
		return nil, err
	}

	return project, nil
}

func (s *Service) DeleteProject(ctx context.Context, projectID string) error {
	if err := s.Store.DeleteProject(ctx, projectID); err != nil {
		return err
	}

	return s.Store.DeleteRemoteProject(ctx, projectID)
}

func (s *Service) GetTree(ctx context.Context, projectID string) (*FileNode, error) {
	return s.Store.GetTree(ctx, projectID)
}

func (s *Service) ReadFile(ctx context.Context, projectID string, projectPath string) ([]byte, error) {
	return s.Store.ReadFile(ctx, projectID, projectPath)
}

func (s *Service) WriteFile(ctx context.Context, projectID string, projectPath string, content []byte) error {
	if err := s.Store.WriteFile(ctx, projectID, projectPath, content); err != nil {
		return err
	}

	return s.Store.SyncProject(ctx, projectID)
}

func (s *Service) CreateFile(ctx context.Context, projectID string, projectPath string, content []byte) error {
	if err := s.Store.CreateFile(ctx, projectID, projectPath, content); err != nil {
		return err
	}

	return s.Store.SyncProject(ctx, projectID)
}

func (s *Service) DeleteFile(ctx context.Context, projectID string, projectPath string) error {
	normalized, err := NormalizeProjectPath(projectPath)
	if err != nil {
		return err
	}

	currentProject, err := s.Store.GetProject(ctx, projectID)
	if err != nil {
		return err
	}

	if currentProject.EntryFile == normalized {
		return errors.New("the project entry file cannot be deleted")
	}

	if err := s.Store.DeleteFile(ctx, projectID, normalized); err != nil {
		return err
	}

	return s.Store.SyncProject(ctx, projectID)
}

func (s *Service) CreateFolder(ctx context.Context, projectID string, folderPath string) error {
	if err := s.Store.CreateFolder(ctx, projectID, folderPath); err != nil {
		return err
	}

	return s.Store.SyncProject(ctx, projectID)
}

func (s *Service) DeleteFolder(ctx context.Context, projectID string, folderPath string) error {
	normalized, err := NormalizeProjectPath(folderPath)
	if err != nil {
		return err
	}

	currentProject, err := s.Store.GetProject(ctx, projectID)
	if err != nil {
		return err
	}

	containsEntryFile := currentProject.EntryFile == normalized || strings.HasPrefix(currentProject.EntryFile, normalized+"/")
	if containsEntryFile {
		return errors.New("the directory containing the project entry file cannot be deleted")
	}

	if err := s.Store.DeleteFolder(ctx, projectID, normalized); err != nil {
		return err
	}

	return s.Store.SyncProject(ctx, projectID)
}

func (s *Service) UploadZip(ctx context.Context, projectID string, reader io.ReaderAt, size int64) ([]string, error) {
	projectDir := s.Store.ProjectDir(projectID)

	if _, err := os.Stat(projectDir); err != nil {
		return nil, err
	}

	uploaded, err := zipupload.Extract(reader, size, projectDir)
	if err != nil {
		return nil, err
	}

	if err := s.Store.SyncProject(ctx, projectID); err != nil {
		return nil, err
	}

	return uploaded, nil
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

	outputPDFPath := filepath.Join(buildDir, "output.pdf")
	_ = os.Remove(outputPDFPath)

	start := time.Now()

	compileResult, err := s.Compiler.Compile(ctx, compiler.CompileRequest{
		ProjectDir: projectDir,
		EntryFile:  entry,
		OutputFile: outputPDFPath,
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
		if _, err := os.Stat(outputPDFPath); err != nil {
			result.OK = false
			result.Diagnostics = append(result.Diagnostics, compiler.Diagnostic{
				Severity: "error",
				Message:  "Typst reported success, but output PDF was not found in the build directory",
			})

			_ = s.Store.SyncBuild(ctx, buildID)

			return result, nil
		}

		result.PDFURL = "/api/v1/builds/" + buildID + "/pdf"
		result.DownloadURL = "/api/v1/builds/" + buildID + "/download"
	}

	if err := s.Store.SyncBuild(ctx, buildID); err != nil {
		return nil, err
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
	version, err := s.Store.CreateVersion(ctx, projectID, message)
	if err != nil {
		return nil, err
	}

	if err := s.Store.SyncProject(ctx, projectID); err != nil {
		return nil, err
	}

	return version, nil
}

func (s *Service) RestoreVersion(ctx context.Context, projectID string, versionID string) error {
	if err := s.Store.RestoreVersion(ctx, projectID, versionID); err != nil {
		return err
	}

	return s.Store.SyncProject(ctx, projectID)
}

func (s *Service) RenameEntry(ctx context.Context, projectID string, oldPath string, newName string) (string, error) {
	newPath, err := s.Store.RenameEntry(ctx, projectID, oldPath, newName)
	if err != nil {
		return "", err
	}

	if err := s.Store.SyncProject(ctx, projectID); err != nil {
		return "", err
	}

	return newPath, nil
}

func (s *Service) UploadFile(ctx context.Context, projectID string, projectPath string, reader io.Reader, size int64) error {
	if size < 0 {
		return errors.New("invalid uploaded file size")
	}

	normalized, err := zipupload.ValidateUploadedFile(projectPath, uint64(size))
	if err != nil {
		return err
	}

	maxSize := int64(zipupload.MaxSingleFileBytes)

	content, err := io.ReadAll(io.LimitReader(reader, maxSize+1))
	if err != nil {
		return err
	}

	if int64(len(content)) > maxSize {
		return zipupload.ErrFileTooLarge
	}

	if err := s.Store.WriteFile(ctx, projectID, normalized, content); err != nil {
		return err
	}

	return s.Store.SyncProject(ctx, projectID)
}

func (s *Service) GetProjectFilePath(ctx context.Context, projectID string, projectPath string) (string, error) {
	return s.Store.GetProjectFilePath(projectID, projectPath)
}

func (s *Service) DuplicateProject(ctx context.Context, projectID string) (*Project, error) {
	duplicate, err := s.Store.DuplicateProject(ctx, projectID)
	if err != nil {
		return nil, err
	}

	if err := s.Store.SyncProject(ctx, duplicate.ID); err != nil {
		return nil, err
	}

	return duplicate, nil
}

func (s *Service) ExportProjectZIP(ctx context.Context, projectID string, writer io.Writer) error {
	return s.Store.WriteProjectZIP(ctx, projectID, writer)
}
