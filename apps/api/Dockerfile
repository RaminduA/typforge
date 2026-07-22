# syntax=docker/dockerfile:1.7

FROM golang:1.23-bookworm AS builder

WORKDIR /src

COPY go.work ./
COPY apps/api/go.mod apps/api/go.sum ./apps/api/

WORKDIR /src/apps/api
RUN go mod download

WORKDIR /src
COPY apps/api ./apps/api

WORKDIR /src/apps/api
RUN CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o /out/typforge-api ./cmd/server


FROM debian:bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    docker.io \
    tzdata \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /out/typforge-api /usr/local/bin/typforge-api

ENV PORT=8080
ENV STORAGE_ROOT=/opt/typforge/storage
ENV TYPST_ALLOW_NETWORK=true
ENV TYPST_PACKAGE_CACHE_DIR=/opt/typforge/storage/typst-package-cache
ENV TYPST_FONT_DIR=/opt/typforge/storage/typst-fonts

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8080/api/v1/health || exit 1

CMD ["typforge-api"]