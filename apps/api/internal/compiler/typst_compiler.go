package compiler

import (
	"context"
	"errors"
	"os/exec"
	"path/filepath"
	"time"
)

type CompileRequest struct {
	ProjectDir string
	EntryFile  string
	OutputFile string
}

type CompileOutput struct {
	OK          bool
	Logs        string
	DurationMs  int64
	Diagnostics []Diagnostic
}

type Compiler interface {
	Compile(ctx context.Context, req CompileRequest) (*CompileOutput, error)
}

type TypstDockerCompiler struct {
	Image   string
	Timeout time.Duration
}

func NewTypstDockerCompiler(image string, timeout time.Duration) *TypstDockerCompiler {
	return &TypstDockerCompiler{
		Image:   image,
		Timeout: timeout,
	}
}

func (c *TypstDockerCompiler) Compile(ctx context.Context, req CompileRequest) (*CompileOutput, error) {
	if req.ProjectDir == "" {
		return nil, errors.New("project directory is required")
	}

	if req.EntryFile == "" {
		return nil, errors.New("entry file is required")
	}

	if req.OutputFile == "" {
		req.OutputFile = "output.pdf"
	}

	timeout := c.Timeout
	if timeout <= 0 {
		timeout = 15 * time.Second
	}

	compileCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	start := time.Now()

	args := []string{
		"run",
		"--rm",
		"--network",
		"none",
		"-v",
		DockerVolumeArg(req.ProjectDir),
		"-w",
		"/work",
		c.Image,
		"compile",
		filepath.ToSlash(req.EntryFile),
		filepath.ToSlash(req.OutputFile),
	}

	cmd := exec.CommandContext(compileCtx, "docker", args...)

	output, err := cmd.CombinedOutput()
	logs := string(output)

	result := &CompileOutput{
		OK:          err == nil,
		Logs:        logs,
		DurationMs:  time.Since(start).Milliseconds(),
		Diagnostics: ParseDiagnostics(logs),
	}

	if compileCtx.Err() == context.DeadlineExceeded {
		result.OK = false
		result.Diagnostics = append(result.Diagnostics, Diagnostic{
			Severity: "error",
			Message:  "compile timed out",
		})
		return result, nil
	}

	return result, nil
}
