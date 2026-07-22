package zipupload

import "errors"

var (
	ErrZipTooLarge        = errors.New("ZIP file is too large")
	ErrProjectTooLarge    = errors.New("extracted project is too large")
	ErrTooManyFiles       = errors.New("ZIP contains too many files")
	ErrInvalidPath        = errors.New("ZIP contains an unsafe path")
	ErrUnsupportedFile    = errors.New("ZIP contains an unsupported file type")
	ErrFileTooLarge       = errors.New("ZIP contains a file that is too large")
	ErrSymlinkUnsupported = errors.New("ZIP symlinks are not supported")
)
