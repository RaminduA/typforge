package project

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"path"
	"path/filepath"
	"strings"
)

var (
	ErrInvalidPath  = errors.New("invalid project path")
	ErrInvalidEntry = errors.New("entry file must be a .typ file")
)

func NormalizeProjectPath(input string) (string, error) {
	value := strings.TrimSpace(input)
	value = strings.ReplaceAll(value, "\\", "/")

	if value == "" {
		return "", ErrInvalidPath
	}

	if strings.Contains(value, "\x00") {
		return "", ErrInvalidPath
	}

	if strings.Contains(value, ":") {
		return "", ErrInvalidPath
	}

	if strings.HasPrefix(value, "/") {
		return "", ErrInvalidPath
	}

	cleaned := path.Clean(value)
	if cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, "../") {
		return "", ErrInvalidPath
	}

	if len(cleaned) > 240 {
		return "", ErrInvalidPath
	}

	parts := strings.Split(cleaned, "/")
	if len(parts) > 0 && parts[0] == ".typforge" {
		return "", ErrInvalidPath
	}

	if len(parts) > 12 {
		return "", ErrInvalidPath
	}

	for _, part := range parts {
		if part == "" || part == "." || part == ".." {
			return "", ErrInvalidPath
		}
	}

	return cleaned, nil
}

func ValidateEntryFile(entry string) (string, error) {
	normalized, err := NormalizeProjectPath(entry)
	if err != nil {
		return "", err
	}

	if strings.ToLower(filepath.Ext(normalized)) != ".typ" {
		return "", ErrInvalidEntry
	}

	return normalized, nil
}

func NewID(prefix string) string {
	var buf [8]byte
	_, err := rand.Read(buf[:])
	if err != nil {
		return prefix + "_fallback"
	}

	return prefix + "_" + hex.EncodeToString(buf[:])
}
