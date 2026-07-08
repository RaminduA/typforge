package zipupload

import (
	"archive/zip"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func Extract(reader io.ReaderAt, size int64, dest string) ([]string, error) {
	if size > MaxZipSizeBytes {
		return nil, ErrZipTooLarge
	}

	archive, err := zip.NewReader(reader, size)
	if err != nil {
		return nil, err
	}

	uploaded := make([]string, 0)
	var totalSize uint64
	fileCount := 0

	for _, entry := range archive.File {
		if entry.FileInfo().Mode()&os.ModeSymlink != 0 {
			return nil, ErrSymlinkUnsupported
		}

		normalized, err := ValidateEntry(entry.Name, entry.FileInfo().IsDir(), entry.UncompressedSize64)
		if err != nil {
			return nil, err
		}

		if normalized == "" {
			continue
		}

		target := filepath.Join(dest, filepath.FromSlash(normalized))

		relative, err := filepath.Rel(dest, target)
		if err != nil {
			return nil, err
		}

		if strings.HasPrefix(relative, "..") || filepath.IsAbs(relative) {
			return nil, ErrInvalidPath
		}

		if entry.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0755); err != nil {
				return nil, err
			}
			continue
		}

		fileCount++
		if fileCount > MaxFiles {
			return nil, ErrTooManyFiles
		}

		totalSize += entry.UncompressedSize64
		if totalSize > MaxExtractedSizeBytes {
			return nil, ErrProjectTooLarge
		}

		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return nil, err
		}

		source, err := entry.Open()
		if err != nil {
			return nil, err
		}

		targetFile, err := os.Create(target)
		if err != nil {
			source.Close()
			return nil, err
		}

		_, copyErr := io.Copy(targetFile, io.LimitReader(source, int64(MaxSingleFileBytes)+1))

		closeErr := source.Close()
		targetCloseErr := targetFile.Close()

		if copyErr != nil {
			return nil, copyErr
		}

		if closeErr != nil {
			return nil, closeErr
		}

		if targetCloseErr != nil {
			return nil, targetCloseErr
		}

		uploaded = append(uploaded, normalized)
	}

	return uploaded, nil
}
