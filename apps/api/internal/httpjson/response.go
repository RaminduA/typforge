package httpjson

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

type DataEnvelope struct {
	Data interface{} `json:"data"`
}

func WriteJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func WriteData(w http.ResponseWriter, status int, data interface{}) {
	WriteJSON(w, status, DataEnvelope{Data: data})
}

func WriteError(w http.ResponseWriter, status int, code string, message string) {
	WriteJSON(w, status, ErrorEnvelope{Error: APIError{Code: code, Message: message}})
}

func WriteErrorDetails(w http.ResponseWriter, status int, code string, message string, details interface{}) {
	WriteJSON(w, status, ErrorEnvelope{Error: APIError{Code: code, Message: message, Details: details}})
}

func DecodeJSON(r *http.Request, target interface{}) error {
	if r.Body == nil {
		return nil
	}

	defer r.Body.Close()

	err := json.NewDecoder(r.Body).Decode(target)
	if errors.Is(err, io.EOF) {
		return nil
	}

	return err
}
