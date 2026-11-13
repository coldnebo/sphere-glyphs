# Shared helpers for dev.sh / test.sh. Sourced, not executed.
set -euo pipefail

IMAGE="${IMAGE:-sphere-glyphs}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=/workspace/sphere-glyphs

# Git Bash / MSYS on Windows: stop it rewriting /workspace/... into C:/Program Files/Git/...,
# and hand Docker a Windows-style host path for the bind mount.
HOST_ROOT="$ROOT"
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    export MSYS_NO_PATHCONV=1
    HOST_ROOT="$(cd "$ROOT" && pwd -W)"
    ;;
esac

# On a Linux host, run as the calling user so files written to the mount aren't owned by uid 1000.
USER_ARGS=()
if [[ "$(uname -s)" == Linux && "$(id -u)" != 0 ]]; then
  USER_ARGS=(--user "$(id -u):$(id -g)" -e HOME=/tmp)
fi

TTY_ARGS=(-i)   # keep stdin open so heredocs and pipes reach the container
if [[ -t 0 && -t 1 ]]; then TTY_ARGS=(-it); fi

build() {  # build <target>   (cached layers make this ~instant after the first time)
  docker build --quiet --target "$1" -t "$IMAGE:$1" "$HOST_ROOT" >/dev/null
}

run_mounted() {  # run_mounted <target> <cmd...>     (PORTS="8000 ..." publishes ports)
  local target="$1"; shift
  local port_args=()
  for p in ${PORTS:-}; do port_args+=(-p "$p:$p"); done
  docker run --rm "${TTY_ARGS[@]}" "${USER_ARGS[@]}" "${port_args[@]}" \
    -v "$HOST_ROOT:$WORKDIR" -w "$WORKDIR" \
    "$IMAGE:$target" "$@"
}
