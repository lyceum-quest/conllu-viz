#!/usr/bin/env bash
set -euo pipefail

# Load .env if present
if [ -f .env ]; then
  set -a; source .env; set +a
fi

TARGET_HOST="${TARGET_HOST:?TARGET_HOST is not set (check .env)}"
REMOTE_DIR="${REMOTE_DIR:?REMOTE_DIR is not set (check .env)}"

npm ci
npm run build
rsync -avz --delete dist/ "${TARGET_HOST}:${REMOTE_DIR}/"

echo "Deployed dist/ to ${TARGET_HOST}:${REMOTE_DIR}"
