# Typforge Typst Runner

This image wraps the official Typst runtime and gives Typforge a stable image name for CI/CD deployments.

The API service invokes this image when compiling user projects.

## Build locally

```bash
docker build -f docker/typst-runner/Dockerfile -t typforge/typst-runner:local .
```
