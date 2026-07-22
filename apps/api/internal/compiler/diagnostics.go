package compiler

import (
	"regexp"
	"strings"
)

type Diagnostic struct {
	File     string `json:"file,omitempty"`
	Line     int    `json:"line,omitempty"`
	Column   int    `json:"column,omitempty"`
	Severity string `json:"severity"`
	Message  string `json:"message"`
}

var locationPattern = regexp.MustCompile(`([A-Za-z0-9_\-./\\]+\.typ):([0-9]+):([0-9]+)`)
var messagePattern = regexp.MustCompile(`(?m)^(error|warning):\s*(.+)$`)

func ParseDiagnostics(logs string) []Diagnostic {
	diagnostics := make([]Diagnostic, 0)

	messages := messagePattern.FindAllStringSubmatch(logs, -1)
	locations := locationPattern.FindAllStringSubmatch(logs, -1)

	for index, msg := range messages {
		diagnostic := Diagnostic{
			Severity: strings.TrimSpace(msg[1]),
			Message:  strings.TrimSpace(msg[2]),
		}

		if index < len(locations) {
			diagnostic.File = strings.ReplaceAll(locations[index][1], "\\", "/")
			diagnostic.Line = atoiSafe(locations[index][2])
			diagnostic.Column = atoiSafe(locations[index][3])
		}

		diagnostics = append(diagnostics, diagnostic)
	}

	if len(diagnostics) == 0 && strings.TrimSpace(logs) != "" {
		diagnostics = append(diagnostics, Diagnostic{
			Severity: "error",
			Message:  strings.TrimSpace(logs),
		})
	}

	return diagnostics
}

func atoiSafe(value string) int {
	result := 0
	for _, ch := range value {
		if ch < '0' || ch > '9' {
			return result
		}
		result = result*10 + int(ch-'0')
	}
	return result
}
