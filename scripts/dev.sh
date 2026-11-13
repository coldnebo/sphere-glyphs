#!/usr/bin/env bash
# Dev container with the repo bind-mounted: edits on the host are live inside.
#
#   scripts/dev.sh                          interactive shell
#   scripts/dev.sh <cmd...>                 run one command, e.g.
#   scripts/dev.sh node src/render.mjs penrose/tammes-glyph.domain \
#       examples/glyphs/glyph-0000.substance penrose/styles/brush.style out/g.svg
#   scripts/dev.sh scripts/build-examples.sh
#
# The image is rebuilt (from cache) on every call, so dependency changes are picked up automatically.
source "$(dirname "${BASH_SOURCE[0]}")/_docker.sh"

build dev
if [[ $# -eq 0 ]]; then set -- bash; fi
run_mounted dev "$@"
