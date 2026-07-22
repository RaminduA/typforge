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

func envBool(name string) bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv(name)))

	return value == "1" || value == "true" || value == "yes" || value == "on"
}

func dockerVolumeMountArg(hostPath string, containerPath string) (string, error) {
	absoluteHostPath, err := filepath.Abs(hostPath)
	if err != nil {
		return "", err
	}

	return absoluteHostPath + ":" + containerPath, nil
}

func formatCompilerLogs(command []string, output []byte, runErr error, timedOut bool) string {
	var builder strings.Builder

	builder.WriteString("$ ")
	builder.WriteString(strings.Join(command, " "))
	builder.WriteString("\n\n")

	if len(output) > 0 {
		builder.Write(output)

		if !strings.HasSuffix(builder.String(), "\n") {
			builder.WriteString("\n")
		}
	} else {
		builder.WriteString("Typst compiler produced no stdout/stderr output.\n")
	}

	if timedOut {
		builder.WriteString("\nCompiler process timed out.\n")
	}

	if runErr != nil {
		builder.WriteString("\nCompiler process exited with error:\n")
		builder.WriteString(runErr.Error())
		builder.WriteString("\n")
	}

	return builder.String()
}

func appendCompilerError(result *CompileOutput, message string) {
	result.OK = false
	result.Logs += "\n" + message + "\n"
	result.Diagnostics = append(result.Diagnostics, Diagnostic{
		Severity: "error",
		Message:  message,
	})
}

func prepareOutputMount(outputFile string) (hostOutputFile string, containerOutputFile string, outputMountArgs []string, err error) {
	if outputFile == "" {
		outputFile = "output.pdf"
	}

	if !filepath.IsAbs(outputFile) {
		return outputFile, filepath.ToSlash(outputFile), nil, nil
	}

	hostOutputFile, err = filepath.Abs(outputFile)
	if err != nil {
		return "", "", nil, err
	}

	outputDir := filepath.Dir(hostOutputFile)
	outputName := filepath.Base(hostOutputFile)

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return "", "", nil, err
	}

	outputMount, err := dockerVolumeMountArg(outputDir, "/out")
	if err != nil {
		return "", "", nil, err
	}

	return hostOutputFile, "/out/" + outputName, []string{"-v", outputMount}, nil
}

func (c *TypstDockerCompiler) Compile(ctx context.Context, req CompileRequest) (*CompileOutput, error) {
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

	allowNetwork := envBool("TYPST_ALLOW_NETWORK")
	packageCacheDir := strings.TrimSpace(os.Getenv("TYPST_PACKAGE_CACHE_DIR"))
	fontDir := strings.TrimSpace(os.Getenv("TYPST_FONT_DIR"))

	hostOutputFile, containerOutputFile, outputMountArgs, err := prepareOutputMount(req.OutputFile)
	if err != nil {
		return nil, err
	}

	args := []string{"run", "--rm"}

	if !allowNetwork {
		args = append(args, "--network", "none")
	}

	if packageCacheDir != "" {
		if err := os.MkdirAll(packageCacheDir, 0755); err != nil {
			return nil, err
		}

		cacheMount, err := dockerVolumeMountArg(
			packageCacheDir,
			"/typst-package-cache",
		)
		if err != nil {
			return nil, err
		}

		args = append(
			args,
			"-v",
			cacheMount,
			"-e",
			"TYPST_PACKAGE_CACHE_PATH=/typst-package-cache",
		)
	}

	if fontDir != "" {
		if err := os.MkdirAll(fontDir, 0755); err != nil {
			return nil, err
		}

		fontMount, err := dockerVolumeMountArg(fontDir, "/typst-fonts")
		if err != nil {
			return nil, err
		}

		args = append(args, "-v", fontMount)
	}

	args = append(args, outputMountArgs...)

	args = append(
		args,
		"-v",
		DockerVolumeArg(req.ProjectDir),
		"-w",
		"/work",
		c.Image,
		"compile",
	)

	if fontDir != "" {
		args = append(args, "--font-path", "/typst-fonts")
	}

	args = append(
		args,
		filepath.ToSlash(req.EntryFile),
		containerOutputFile,
	)

	cmd := exec.CommandContext(compileCtx, "docker", args...)

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

	if hostOutputFile != "" {
		if _, err := os.Stat(hostOutputFile); err != nil {
			appendCompilerError(
				result,
				"compiled PDF was not created at expected path: "+hostOutputFile,
			)
			return result, nil
		}
	}

	return result, nil
}
