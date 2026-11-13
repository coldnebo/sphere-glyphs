#!/usr/bin/env bash
# Run the test suite in a container.
#
#   scripts/test.sh               against the bind-mounted working tree (fast edit/test loop)
#   scripts/test.sh -k stars      extra args go to pytest
#   scripts/test.sh --ci          build the self-contained `test` image (source copied in) and run it
source "$(dirname "${BASH_SOURCE[0]}")/_docker.sh"

if [[ "${1:-}" == --ci ]]; then
  shift
  build test
  docker run --rm "$IMAGE:test" scripts/run-tests.sh "$@"
else
  build dev
  run_mounted dev scripts/run-tests.sh "$@"
fi
