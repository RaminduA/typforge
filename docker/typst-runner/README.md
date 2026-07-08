# Typforge Typst Runner

This Docker image wraps the official Typst compiler image.

Build locally:

```bash
docker build -t typforge/typst-runner:local .
```

Run against a project folder:

```bash
docker run --rm --network none -v "${PWD}:/work" -w /work typforge/typst-runner:local compile main.typ output.pdf
```

For MVP, the Go backend directly uses:

```bash
ghcr.io/typst/typst:latest
```
