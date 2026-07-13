package zipupload

import (
	"path"
	"path/filepath"
	"strings"
)

var allowedExtensions = map[string]bool{
	".typ":  true,
	".bib":  true,
	".png":  true,
	".jpg":  true,
	".jpeg": true,
	".svg":  true,
	".pdf":  true,
	".txt":  true,
	".csv":  true,
	".json": true,
	".toml": true,
}

func ValidateEntry(name string, isDir bool, uncompressedSize uint64) (string, error) {
	cleanName := strings.TrimSpace(name)
	cleanName = strings.ReplaceAll(cleanName, "\\", "/")

	if cleanName == "" || strings.Contains(cleanName, "\x00") {
		return "", ErrInvalidPath
	}

	if strings.HasPrefix(cleanName, "/") || strings.Contains(cleanName, ":") {
		return "", ErrInvalidPath
	}

	if strings.HasPrefix(cleanName, "__MACOSX/") || strings.HasSuffix(cleanName, ".DS_Store") {
		return "", nil
	}

	cleaned := path.Clean(cleanName)

	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", ErrInvalidPath
	}

	parts := strings.Split(cleaned, "/")
	if len(parts) > MaxDepth {
		return "", ErrInvalidPath
	}

	for _, part := range parts {
		if part == "" || part == "." || part == ".." {
			return "", ErrInvalidPath
		}
	}

	if isDir {
		return cleaned, nil
	}

	if uncompressedSize > MaxSingleFileBytes {
		return "", ErrFileTooLarge
	}

	ext := strings.ToLower(filepath.Ext(cleaned))
	if !allowedExtensions[ext] {
		return "", ErrUnsupportedFile
	}

	return cleaned, nil
}

func ValidateUploadedFile(
	name string,
	uncompressedSize uint64,
) (string, error) {
	return ValidateEntry(
		name,
		false,
		uncompressedSize,
	)
}
