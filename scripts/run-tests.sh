#!/usr/bin/env bash
# In-container test runner (called by scripts/test.sh, the devcontainer, or CI).
# Args are passed to pytest.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "== python (pytest) =="
pytest "$@"

echo "== node (node --test) =="
node --test 'tests/**/*.test.mjs'

echo "== site build (figures, citations) =="
node site/build.mjs >/dev/null && echo "site builds"
