package httpjson

type APIError struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

type ErrorEnvelope struct {
	Error APIError `json:"error"`
}

const (
	ErrCodeBadRequest       = "BAD_REQUEST"
	ErrCodeNotFound         = "NOT_FOUND"
	ErrCodeValidation       = "VALIDATION_ERROR"
	ErrCodeInternal         = "INTERNAL_ERROR"
	ErrCodeCompileFailed    = "COMPILE_FAILED"
	ErrCodeUnsupportedMedia = "UNSUPPORTED_MEDIA_TYPE"
)
