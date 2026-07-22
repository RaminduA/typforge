package compiler

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type TypstBinaryCompiler struct {
	Bin     string
	Timeout time.Duration
}

func NewTypstBinaryCompiler(bin string, timeout time.Duration) *TypstBinaryCompiler {
	if strings.TrimSpace(bin) == "" {
		bin = "typst"
	}

	return &TypstBinaryCompiler{
		Bin:     bin,
		Timeout: timeout,
	}
}

func (c *TypstBinaryCompiler) Compile(ctx context.Context, req CompileRequest) (*CompileOutput, error) {
	if req.ProjectDir == "" {
		return nil, errors.New("project directory is required")
	}

	if req.EntryFile == "" {
		return nil, errors.New("entry file is required")
	}

	timeout := c.Timeout
	if timeout <= 0 {
		timeout = 60 * time.Second
	}

	compileCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	start := time.Now()

	outputFile := req.OutputFile
	if strings.TrimSpace(outputFile) == "" {
		outputFile = filepath.Join(req.ProjectDir, "output.pdf")
	}

	if !filepath.IsAbs(outputFile) {
		outputFile = filepath.Join(req.ProjectDir, outputFile)
	}

	if err := os.MkdirAll(filepath.Dir(outputFile), 0755); err != nil {
		return nil, err
	}

	args := []string{"compile"}

	fontDir := strings.TrimSpace(os.Getenv("TYPST_FONT_DIR"))
	if fontDir != "" {
		if err := os.MkdirAll(fontDir, 0755); err != nil {
			return nil, err
		}

		args = append(args, "--font-path", fontDir)
	}

	args = append(
		args,
		filepath.ToSlash(req.EntryFile),
		outputFile,
	)

	cmd := exec.CommandContext(compileCtx, c.Bin, args...)
	cmd.Dir = req.ProjectDir
	cmd.Env = os.Environ()

	packageCacheDir := strings.TrimSpace(os.Getenv("TYPST_PACKAGE_CACHE_DIR"))
	if packageCacheDir != "" {
		if err := os.MkdirAll(packageCacheDir, 0755); err != nil {
			return nil, err
		}

		cmd.Env = append(cmd.Env, "TYPST_PACKAGE_CACHE_PATH="+packageCacheDir)
	}

	output, runErr := cmd.CombinedOutput()
	timedOut := compileCtx.Err() == context.DeadlineExceeded

	logs := formatCompilerLogs(cmd.Args, output, runErr, timedOut)
	diagnostics := ParseDiagnostics(string(output))

	result := &CompileOutput{
		OK:          runErr == nil && !timedOut,
		Logs:        logs,
		DurationMs:  time.Since(start).Milliseconds(),
		Diagnostics: diagnostics,
	}

	if timedOut {
		appendCompilerError(result, "compile timed out")
		return result, nil
	}

	if runErr != nil {
		result.OK = false

		if len(result.Diagnostics) == 0 {
			result.Diagnostics = append(result.Diagnostics, Diagnostic{
				Severity: "error",
				Message:  runErr.Error(),
			})
		}

		return result, nil
	}

	if _, err := os.Stat(outputFile); err != nil {
		appendCompilerError(
			result,
			"compiled PDF was not created at expected path: "+outputFile,
		)

		return result, nil
	}

	return result, nil
}
