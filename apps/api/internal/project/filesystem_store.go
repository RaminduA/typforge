package project

import (
	"archive/zip"
	"context"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type FileSystemStore struct {
	ProjectsRoot string
	BuildsRoot   string
	Syncer       *S3Syncer
}

func NewFileSystemStore(projectsRoot string, buildsRoot string) (*FileSystemStore, error) {
	store := &FileSystemStore{ProjectsRoot: projectsRoot, BuildsRoot: buildsRoot}

	if err := os.MkdirAll(projectsRoot, 0755); err != nil {
		return nil, err
	}

	if err := os.MkdirAll(buildsRoot, 0755); err != nil {
		return nil, err
	}

	return store, nil
}

func (s *FileSystemStore) ProjectDir(projectID string) string {
	return filepath.Join(s.ProjectsRoot, projectID)
}

func (s *FileSystemStore) BuildDir(buildID string) string {
	return filepath.Join(s.BuildsRoot, buildID)
}

func (s *FileSystemStore) metadataPath(projectID string) string {
	return filepath.Join(s.ProjectDir(projectID), ".typforge", "project.json")
}

func (s *FileSystemStore) versionsDir(projectID string) string {
	return filepath.Join(s.ProjectDir(projectID), ".typforge", "versions")
}

func (s *FileSystemStore) CreateProject(ctx context.Context, name string) (*Project, error) {
	if strings.TrimSpace(name) == "" {
		name = "Untitled Project"
	}

	now := time.Now().UTC()
	projectID := NewID("prj")
	projectDir := s.ProjectDir(projectID)

	if err := os.MkdirAll(filepath.Join(projectDir, ".typforge"), 0755); err != nil {
		return nil, err
	}

	project := &Project{ID: projectID, Name: name, EntryFile: "main.typ", CreatedAt: now, UpdatedAt: now}

	defaultContent :=
		`#set page(width: 8.5in, height: 11in, margin: 1in)
#set text(font: "Linux Libertine", size: 11pt)

= Welcome to Typforge

This PDF was compiled from Typst using Docker.

Edit this file, click Compile, and preview the generated PDF.
`

	if err := os.WriteFile(filepath.Join(projectDir, "main.typ"), []byte(defaultContent), 0644); err != nil {
		return nil, err
	}

	if err := s.saveProject(project); err != nil {
		return nil, err
	}

	return project, nil
}

func (s *FileSystemStore) ListProjects(ctx context.Context) ([]Project, error) {
	entries, err := os.ReadDir(s.ProjectsRoot)
	if err != nil {
		return nil, err
	}

	projects := make([]Project, 0)

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		project, err := s.GetProject(ctx, entry.Name())
		if err == nil {
			projects = append(projects, *project)
		}
	}

	sort.Slice(projects, func(i, j int) bool {
		return projects[i].UpdatedAt.After(projects[j].UpdatedAt)
	})

	return projects, nil
}

func (s *FileSystemStore) GetProject(ctx context.Context, projectID string) (*Project, error) {
	data, err := os.ReadFile(s.metadataPath(projectID))
	if err != nil {
		return nil, errors.New("project not found")
	}

	var project Project
	if err := json.Unmarshal(data, &project); err != nil {
		return nil, err
	}

	return &project, nil
}

func (s *FileSystemStore) UpdateProject(ctx context.Context, projectID string, name string) (*Project, error) {
	project, err := s.GetProject(ctx, projectID)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(name) == "" {
		return nil, errors.New("project name cannot be empty")
	}

	project.Name = strings.TrimSpace(name)
	project.UpdatedAt = time.Now().UTC()

	if err := s.saveProject(project); err != nil {
		return nil, err
	}

	return project, nil
}

func (s *FileSystemStore) DeleteProject(ctx context.Context, projectID string) error {
	projectDir := s.ProjectDir(projectID)

	if _, err := os.Stat(projectDir); err != nil {
		return errors.New("project not found")
	}

	return os.RemoveAll(projectDir)
}

func (s *FileSystemStore) saveProject(project *Project) error {
	if err := os.MkdirAll(filepath.Dir(s.metadataPath(project.ID)), 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(project, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(s.metadataPath(project.ID), data, 0644)
}

func (s *FileSystemStore) GetTree(ctx context.Context, projectID string) (*FileNode, error) {
	projectDir := s.ProjectDir(projectID)

	if _, err := os.Stat(projectDir); err != nil {
		return nil, errors.New("project not found")
	}

	return buildTree(projectDir, projectDir)
}

func buildTree(root string, current string) (*FileNode, error) {
	info, err := os.Stat(current)
	if err != nil {
		return nil, err
	}

	relative, err := filepath.Rel(root, current)
	if err != nil {
		return nil, err
	}

	nodePath := filepath.ToSlash(relative)
	if nodePath == "." {
		nodePath = ""
	}

	node := &FileNode{Name: info.Name(), Path: nodePath, Type: "file", Size: info.Size()}

	if info.IsDir() {
		node.Type = "folder"
		node.Size = 0

		entries, err := os.ReadDir(current)
		if err != nil {
			return nil, err
		}

		for _, entry := range entries {
			if entry.Name() == ".typforge" {
				continue
			}

			child, err := buildTree(root, filepath.Join(current, entry.Name()))
			if err != nil {
				return nil, err
			}

			node.Children = append(node.Children, *child)
		}

		sort.Slice(node.Children, func(i, j int) bool {
			if node.Children[i].Type != node.Children[j].Type {
				return node.Children[i].Type == "folder"
			}
			return node.Children[i].Name < node.Children[j].Name
		})
	}

	return node, nil
}

func (s *FileSystemStore) projectFilePath(projectID string, projectPath string) (string, error) {
	normalized, err := NormalizeProjectPath(projectPath)
	if err != nil {
		return "", err
	}

	projectDir := s.ProjectDir(projectID)
	target := filepath.Join(projectDir, filepath.FromSlash(normalized))

	relative, err := filepath.Rel(projectDir, target)
	if err != nil {
		return "", err
	}

	if strings.HasPrefix(relative, "..") || filepath.IsAbs(relative) {
		return "", ErrInvalidPath
	}

	return target, nil
}

func (s *FileSystemStore) ReadFile(ctx context.Context, projectID string, projectPath string) ([]byte, error) {
	target, err := s.projectFilePath(projectID, projectPath)
	if err != nil {
		return nil, err
	}

	return os.ReadFile(target)
}

func (s *FileSystemStore) WriteFile(ctx context.Context, projectID string, projectPath string, content []byte) error {
	target, err := s.projectFilePath(projectID, projectPath)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return err
	}

	return os.WriteFile(target, content, 0644)
}

func (s *FileSystemStore) CreateFile(ctx context.Context, projectID string, projectPath string, content []byte) error {
	target, err := s.projectFilePath(projectID, projectPath)
	if err != nil {
		return err
	}

	if _, err := os.Stat(target); err == nil {
		return errors.New("file already exists")
	}

	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		return err
	}

	return os.WriteFile(target, content, 0644)
}

func (s *FileSystemStore) DeleteFile(ctx context.Context, projectID string, projectPath string) error {
	target, err := s.projectFilePath(projectID, projectPath)
	if err != nil {
		return err
	}

	info, err := os.Stat(target)
	if err != nil {
		return err
	}

	if info.IsDir() {
		return errors.New("path is a folder, not a file")
	}

	return os.Remove(target)
}

func (s *FileSystemStore) CreateFolder(ctx context.Context, projectID string, folderPath string) error {
	target, err := s.projectFilePath(projectID, folderPath)
	if err != nil {
		return err
	}

	return os.MkdirAll(target, 0755)
}

func (s *FileSystemStore) DeleteFolder(ctx context.Context, projectID string, folderPath string) error {
	target, err := s.projectFilePath(projectID, folderPath)
	if err != nil {
		return err
	}

	info, err := os.Stat(target)
	if err != nil {
		return err
	}

	if !info.IsDir() {
		return errors.New("path is a file, not a folder")
	}

	return os.RemoveAll(target)
}

func (s *FileSystemStore) CreateBuildDir(buildID string) (string, error) {
	buildDir := s.BuildDir(buildID)
	return buildDir, os.MkdirAll(buildDir, 0755)
}

func (s *FileSystemStore) GetBuildPDFPath(buildID string) (string, error) {
	pdfPath := filepath.Join(s.BuildDir(buildID), "output.pdf")
	if _, err := os.Stat(pdfPath); err != nil {
		return "", errors.New("build PDF not found")
	}
	return pdfPath, nil
}

func (s *FileSystemStore) GetBuildLogs(buildID string) (string, error) {
	logPath := filepath.Join(s.BuildDir(buildID), "compile.log")
	data, err := os.ReadFile(logPath)
	if err != nil {
		return "", errors.New("build logs not found")
	}
	return string(data), nil
}

func (s *FileSystemStore) CreateVersion(ctx context.Context, projectID string, message string) (*VersionSnapshot, error) {
	projectDir := s.ProjectDir(projectID)
	if _, err := os.Stat(projectDir); err != nil {
		return nil, errors.New("project not found")
	}

	if strings.TrimSpace(message) == "" {
		message = "Manual snapshot"
	}

	version := &VersionSnapshot{ID: NewID("ver"), Message: message, CreatedAt: time.Now().UTC()}

	versionDir := filepath.Join(s.versionsDir(projectID), version.ID)

	if err := os.MkdirAll(versionDir, 0755); err != nil {
		return nil, err
	}

	if err := copyDir(projectDir, versionDir, true); err != nil {
		return nil, err
	}

	data, err := json.MarshalIndent(version, "", "  ")
	if err != nil {
		return nil, err
	}

	if err := os.WriteFile(filepath.Join(versionDir, "version.json"), data, 0644); err != nil {
		return nil, err
	}

	return version, nil
}

func (s *FileSystemStore) ListVersions(ctx context.Context, projectID string) ([]VersionSnapshot, error) {
	versionsDir := s.versionsDir(projectID)

	entries, err := os.ReadDir(versionsDir)
	if os.IsNotExist(err) {
		return []VersionSnapshot{}, nil
	}
	if err != nil {
		return nil, err
	}

	versions := make([]VersionSnapshot, 0)

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		data, err := os.ReadFile(filepath.Join(versionsDir, entry.Name(), "version.json"))
		if err != nil {
			continue
		}

		var version VersionSnapshot
		if err := json.Unmarshal(data, &version); err == nil {
			versions = append(versions, version)
		}
	}

	sort.Slice(versions, func(i, j int) bool {
		return versions[i].CreatedAt.After(versions[j].CreatedAt)
	})

	return versions, nil
}

func (s *FileSystemStore) RestoreVersion(ctx context.Context, projectID string, versionID string) error {
	projectDir := s.ProjectDir(projectID)
	versionDir := filepath.Join(s.versionsDir(projectID), versionID)

	if _, err := os.Stat(versionDir); err != nil {
		return errors.New("version not found")
	}

	entries, err := os.ReadDir(projectDir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		if entry.Name() == ".typforge" {
			continue
		}
		if err := os.RemoveAll(filepath.Join(projectDir, entry.Name())); err != nil {
			return err
		}
	}

	return copyDir(versionDir, projectDir, false)
}

func copyDir(src string, dest string, skipTypforge bool) error {
	return filepath.WalkDir(src, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		relative, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}

		if relative == "." {
			return nil
		}

		if skipTypforge && strings.Split(filepath.ToSlash(relative), "/")[0] == ".typforge" {
			if entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		if filepath.Base(path) == "version.json" && filepath.Dir(path) == src {
			return nil
		}

		target := filepath.Join(dest, relative)

		if entry.IsDir() {
			return os.MkdirAll(target, 0755)
		}

		sourceFile, err := os.Open(path)
		if err != nil {
			return err
		}
		defer sourceFile.Close()

		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return err
		}

		targetFile, err := os.Create(target)
		if err != nil {
			return err
		}
		defer targetFile.Close()

		_, err = io.Copy(targetFile, sourceFile)
		return err
	})
}

func (s *FileSystemStore) RenameEntry(ctx context.Context, projectID string, oldPath string, newName string) (string, error) {
	oldNormalized, err := NormalizeProjectPath(oldPath)
	if err != nil {
		return "", err
	}

	newName = strings.TrimSpace(newName)
	newName = strings.ReplaceAll(newName, "\\", "/")

	if newName == "" || newName == "." || newName == ".." || strings.Contains(newName, "/") {
		return "", errors.New("invalid new name")
	}

	oldTarget, err := s.projectFilePath(projectID, oldNormalized)
	if err != nil {
		return "", err
	}

	if _, err := os.Stat(oldTarget); err != nil {
		return "", errors.New("file or directory not found")
	}

	parent := filepath.ToSlash(filepath.Dir(filepath.FromSlash(oldNormalized)))

	if parent == "." {
		parent = ""
	}

	newProjectPath := newName

	if parent != "" {
		newProjectPath = parent + "/" + newName
	}

	newTarget, err := s.projectFilePath(projectID, newProjectPath)
	if err != nil {
		return "", err
	}

	if _, err := os.Stat(newTarget); err == nil {
		return "", errors.New("a file or directory with that name already exists")
	}

	if err := os.Rename(oldTarget, newTarget); err != nil {
		return "", err
	}

	currentProject, err := s.GetProject(ctx, projectID)
	if err != nil {
		_ = os.Rename(newTarget, oldTarget)

		return "", err
	}

	entryWasRenamed := currentProject.EntryFile == oldNormalized || strings.HasPrefix(currentProject.EntryFile, oldNormalized+"/")

	if entryWasRenamed {
		suffix := strings.TrimPrefix(currentProject.EntryFile, oldNormalized)

		currentProject.EntryFile = newProjectPath + suffix

		currentProject.UpdatedAt = time.Now().UTC()

		if err := s.saveProject(currentProject); err != nil {
			_ = os.Rename(newTarget, oldTarget)
			return "", err
		}
	}

	return newProjectPath, nil
}

func (s *FileSystemStore) GetProjectFilePath(projectID string, projectPath string) (string, error) {
	target, err := s.projectFilePath(projectID, projectPath)
	if err != nil {
		return "", err
	}

	info, err := os.Stat(target)
	if err != nil {
		return "", errors.New("file not found")
	}

	if info.IsDir() {
		return "", errors.New("requested path is a directory")
	}

	return target, nil
}

func (s *FileSystemStore) DuplicateProject(ctx context.Context, projectID string) (*Project, error) {
	source, err := s.GetProject(ctx, projectID)
	if err != nil {
		return nil, err
	}

	duplicate, err := s.CreateProject(ctx, "Copy of "+source.Name)
	if err != nil {
		return nil, err
	}

	sourceDir := s.ProjectDir(source.ID)
	duplicateDir := s.ProjectDir(duplicate.ID)

	if err := copyDir(sourceDir, duplicateDir, true); err != nil {
		_ = os.RemoveAll(duplicateDir)
		return nil, err
	}

	duplicate.EntryFile = source.EntryFile
	duplicate.UpdatedAt = time.Now().UTC()

	if err := s.saveProject(duplicate); err != nil {
		return nil, err
	}

	return duplicate, nil
}

func (s *FileSystemStore) WriteProjectZIP(ctx context.Context, projectID string, writer io.Writer) error {
	projectDir := s.ProjectDir(projectID)

	if _, err := os.Stat(projectDir); err != nil {
		return errors.New("project not found")
	}

	zipWriter := zip.NewWriter(writer)

	walkErr := filepath.WalkDir(
		projectDir,
		func(currentPath string, entry os.DirEntry, walkErr error) error {
			if walkErr != nil {
				return walkErr
			}

			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}

			relativePath, err := filepath.Rel(projectDir, currentPath)
			if err != nil {
				return err
			}

			relativePath = filepath.ToSlash(relativePath)

			if relativePath == "." {
				return nil
			}

			if relativePath == ".typforge" {
				return filepath.SkipDir
			}

			if strings.HasPrefix(relativePath, ".typforge/") {
				return nil
			}

			if entry.IsDir() {
				return nil
			}

			info, err := entry.Info()
			if err != nil {
				return err
			}

			header, err := zip.FileInfoHeader(info)
			if err != nil {
				return err
			}

			header.Name = relativePath
			header.Method = zip.Deflate

			zipFile, err := zipWriter.CreateHeader(header)
			if err != nil {
				return err
			}

			sourceFile, err := os.Open(currentPath)
			if err != nil {
				return err
			}

			_, copyErr := io.Copy(zipFile, sourceFile)

			closeErr := sourceFile.Close()

			if copyErr != nil {
				return copyErr
			}

			return closeErr
		},
	)

	if walkErr != nil {
		_ = zipWriter.Close()
		return walkErr
	}

	return zipWriter.Close()
}
