#!/usr/bin/env bash
# Preview the site locally: serves the repo from the dev container on http://localhost:${PORT:-8000}
source "$(dirname "${BASH_SOURCE[0]}")/_docker.sh"
PORT="${PORT:-8000}"
build dev
PORTS="$PORT" run_mounted dev node scripts/serve.mjs "$PORT"
