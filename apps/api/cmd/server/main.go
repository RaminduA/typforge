package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"

	"typforge/apps/api/internal/compiler"
	httpapi "typforge/apps/api/internal/http"
	"typforge/apps/api/internal/project"
)

func envString(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func envInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return parsed
}

func main() {
	_ = godotenv.Load()

	ctx := context.Background()

	port := envString("PORT", "8080")
	storageRoot := envString("STORAGE_ROOT", "/tmp/typforge/storage")
	timeoutSeconds := envInt("COMPILE_TIMEOUT_SECONDS", 60)

	absoluteStorageRoot, err := filepath.Abs(storageRoot)
	if err != nil {
		log.Fatalf("failed to resolve storage root: %v", err)
	}

	store, err := project.NewFileSystemStore(
		filepath.Join(absoluteStorageRoot, "projects"),
		filepath.Join(absoluteStorageRoot, "builds"),
	)
	if err != nil {
		log.Fatalf("failed to initialize filesystem store: %v", err)
	}

	storageDriver := strings.ToLower(strings.TrimSpace(envString("STORAGE_DRIVER", "filesystem")))

	if storageDriver == "s3" {
		syncer, err := project.NewS3Syncer(
			ctx,
			envString("AWS_REGION", ""),
			envString("S3_BUCKET", ""),
			envString("S3_PREFIX", "typforge"),
		)
		if err != nil {
			log.Fatalf("failed to initialize S3 syncer: %v", err)
		}

		store.SetSyncer(syncer)

		if err := store.RestoreFromRemote(ctx); err != nil {
			log.Fatalf("failed to restore storage from S3: %v", err)
		}

		log.Printf("S3 storage sync enabled for bucket=%s prefix=%s", syncer.Bucket, syncer.Prefix)
	}

	compilerMode := strings.ToLower(strings.TrimSpace(envString("TYPST_COMPILER", "docker")))

	var typstCompiler compiler.Compiler

	switch compilerMode {
	case "binary", "direct", "typst":
		typstCompiler = compiler.NewTypstBinaryCompiler(
			envString("TYPST_BIN", "typst"),
			time.Duration(timeoutSeconds)*time.Second,
		)
	default:
		typstCompiler = compiler.NewTypstDockerCompiler(
			envString("TYPST_DOCKER_IMAGE", "ghcr.io/typst/typst:latest"),
			time.Duration(timeoutSeconds)*time.Second,
		)
	}

	projectService := project.NewService(store, typstCompiler)
	router := httpapi.NewRouter(projectService)

	log.Printf("Typforge API listening on http://localhost:%s/api/v1", port)

	if err := http.ListenAndServe(":"+port, router); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
