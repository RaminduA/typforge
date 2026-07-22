# syntax=docker/dockerfile:1.7

FROM golang:1.25-bookworm AS builder

WORKDIR /src

COPY go.work ./
COPY apps/api/go.mod apps/api/go.sum ./apps/api/

WORKDIR /src/apps/api
RUN go mod download

WORKDIR /src
COPY apps/api ./apps/api

WORKDIR /src/apps/api
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/typforge-api ./cmd/server


FROM debian:bookworm-slim AS runtime

ARG TYPST_VERSION=0.15.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    tzdata \
    xz-utils \
  && arch="$(dpkg --print-architecture)" \
  && case "$arch" in \
      amd64) typst_target="x86_64-unknown-linux-musl" ;; \
      arm64) typst_target="aarch64-unknown-linux-musl" ;; \
      *) echo "Unsupported architecture: $arch" && exit 1 ;; \
    esac \
  && curl -fsSL "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-${typst_target}.tar.xz" -o /tmp/typst.tar.xz \
  && tar -xJf /tmp/typst.tar.xz -C /tmp \
  && cp "/tmp/typst-${typst_target}/typst" /usr/local/bin/typst \
  && chmod +x /usr/local/bin/typst \
  && typst --version \
  && rm -rf /tmp/typst* \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /out/typforge-api /usr/local/bin/typforge-api

ENV PORT=8080
ENV STORAGE_ROOT=/tmp/typforge/storage
ENV STORAGE_DRIVER=s3

ENV TYPST_COMPILER=binary
ENV TYPST_BIN=/usr/local/bin/typst
ENV TYPST_PACKAGE_CACHE_DIR=/tmp/typforge/typst-package-cache
ENV TYPST_FONT_DIR=/tmp/typforge/typst-fonts

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8080/api/v1/health || exit 1

CMD ["typforge-api"]