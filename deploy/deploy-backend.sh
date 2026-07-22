#!/usr/bin/env bash

set -euo pipefail

APP_ROOT="/opt/typforge"
DEPLOY_DIR="${APP_ROOT}/deploy"
STORAGE_DIR="${APP_ROOT}/storage"

required_env() {
  local name="$1"

  if [[ -z "${!name:-}" ]]; then
    echo "Missing required environment variable: ${name}" >&2
    exit 1
  fi
}

required_env "TYPFORGE_API_IMAGE"
required_env "TYPFORGE_TYPST_IMAGE"
required_env "API_DOMAIN"

CORS_ORIGIN="${CORS_ORIGIN:-*}"
TYPST_ALLOW_NETWORK="${TYPST_ALLOW_NETWORK:-true}"

DOCKER="docker"

if ! docker info >/dev/null 2>&1; then
  DOCKER="sudo docker"
fi

mkdir -p "${DEPLOY_DIR}"
mkdir -p "${STORAGE_DIR}/projects"
mkdir -p "${STORAGE_DIR}/builds"
mkdir -p "${STORAGE_DIR}/typst-fonts"
mkdir -p "${STORAGE_DIR}/typst-package-cache"

if [[ -n "${GHCR_USERNAME:-}" && -n "${GHCR_TOKEN:-}" ]]; then
  echo "${GHCR_TOKEN}" | ${DOCKER} login ghcr.io -u "${GHCR_USERNAME}" --password-stdin
fi

cat > "${DEPLOY_DIR}/.env" <<EOF
TYPFORGE_API_IMAGE=${TYPFORGE_API_IMAGE}
TYPFORGE_TYPST_IMAGE=${TYPFORGE_TYPST_IMAGE}

PORT=8080
STORAGE_ROOT=/opt/typforge/storage
TYPST_ALLOW_NETWORK=${TYPST_ALLOW_NETWORK}
TYPST_PACKAGE_CACHE_DIR=/opt/typforge/storage/typst-package-cache
TYPST_FONT_DIR=/opt/typforge/storage/typst-fonts

API_DOMAIN=${API_DOMAIN}
CORS_ORIGIN=${CORS_ORIGIN}
ACME_EMAIL=${ACME_EMAIL:-}
EOF

${DOCKER} pull "${TYPFORGE_API_IMAGE}"
${DOCKER} pull "${TYPFORGE_TYPST_IMAGE}"

${DOCKER} compose \
  --env-file "${DEPLOY_DIR}/.env" \
  -f "${DEPLOY_DIR}/docker-compose.prod.yml" \
  up -d --remove-orphans

${DOCKER} image prune -f

echo "Typforge backend deployed."
echo "API URL: https://${API_DOMAIN}/api/v1"