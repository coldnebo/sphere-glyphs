# Development

Everything runs in one Docker image (Node 22 + Python 3.11). Nothing needs to be installed on the
host except Docker and bash. On Windows, Git Bash works.

## How the container is laid out

```
/workspace/
  node_modules/        npm deps, baked into the image (from package-lock.json)
  sphere-glyphs/       your repo: bind-mounted (dev) or copied (test)
/opt/venv/             Python deps, baked into the image (from requirements.txt)
```

The repo is mounted one level below the dependencies. Node resolves imports by walking up parent
directories, so `src/*.mjs` finds `/workspace/node_modules`, and nothing is installed into your
working tree. Edits on the host show up in the container immediately, with no rebuild needed.

The [Dockerfile](../Dockerfile) has three targets:

| target | used by | source |
|---|---|---|
| `base` | the other two | none, dependencies only |
| `dev`  | `scripts/dev.sh`, `scripts/test.sh`, the devcontainer | bind-mounted |
| `test` | `scripts/test.sh --ci` | copied in, self-contained |

## Shell scripts

```sh
scripts/dev.sh                        # interactive shell
scripts/dev.sh <cmd...>               # run one command in the dev container
scripts/test.sh                       # pytest + node --test against your working tree
scripts/test.sh -k glyph_counts       # extra args go to pytest
scripts/test.sh --ci                  # build the `test` image (source copied in) and run it
```

Each call runs `docker build` first. It is cached, so it's near-instant unless `Dockerfile`,
`package*.json` or `requirements.txt` changed, and then the image updates on its own.

The scripts handle platform details for you:
- **Git Bash on Windows:** sets `MSYS_NO_PATHCONV` and passes Windows-style host paths to Docker.
- **Linux:** runs as your UID/GID, so files written into the mount are owned by you.
- A TTY is attached only when one is available, so the scripts also work in CI and pipes.

Set `IMAGE=name` to change the image name. The default is `sphere-glyphs`, tagged with the target.

## VS Code devcontainer

Install the **Dev Containers** extension and run **Dev Containers: Reopen in Container**.
[.devcontainer/devcontainer.json](../.devcontainer/devcontainer.json) builds the same `dev` target
and mounts the repo at `/workspace/sphere-glyphs`. Inside it:

- The integrated terminal is the container shell. Run `scripts/run-tests.sh`, `node src/render.mjs …`
  and so on directly.
- The Python test explorer uses `/opt/venv` and finds `tests/`.
- The SVG extension previews renders in `out/`.

## Everyday loops

Inside the container (`scripts/dev.sh` or the devcontainer terminal):

```sh
# edit a style, re-render one glyph, open out/g.svg in VS Code
node src/render.mjs penrose/tammes-glyph.domain examples/glyphs/glyph-0000.substance \
    penrose/styles/glass.style out/g.svg

# contact sheet of a few glyphs in one style
node src/sheet.mjs --cols 3 penrose/tammes-glyph.domain penrose/styles/brush.style out/sheet.png \
    examples/glyphs/glyph-0000.substance examples/glyphs/glyph-0012.substance examples/glyphs/glyph-0014.substance

# render all examples (SVGs + sheets) into out/
scripts/build-examples.sh               # render only
scripts/build-examples.sh --regen       # re-run glyphs.py + stars.py first
scripts/build-examples.sh --solve       # re-solve Tammes(13) first (~40 s)

# tests
scripts/run-tests.sh
```

`out/` is git-ignored. To update the README images, copy them from `out/sheets/` into `docs/images/`.

## Tests

| file | what it checks |
|---|---|
| `tests/test_tammes.py`  | The solver recovers N=4 (tetrahedron) and N=6 (octahedron). The committed 13-point solution has 57.1367°, 24 contact edges, and degrees 3×4 and 4×9. |
| `tests/test_glyphs.py`  | The orientation frame. 3,120 paths, 8 symmetries, 199 glyphs. Every step is a contact edge. Regenerating `examples/glyphs` gives byte-identical files. |
| `tests/test_stars.py`   | The star cycles are permutations. k and 13−k are reverses. Regenerating `examples/stars` gives byte-identical files. |
| `tests/render.test.mjs` | Every style compiles, optimizes and renders through Penrose. PNG rasterization works. |

The byte-identical tests are a regression net. If you change `glyphs.py` or `stars.py` on
purpose, run `scripts/build-examples.sh --regen` and commit the regenerated examples.

## Dependencies

- **Node:** `@penrose/core` 3.3.1 (pinned, because the styles were written against it), `jsdom`
  (Penrose needs a DOM), and `@resvg/resvg-js` (SVG to PNG). After editing `package.json`, refresh
  the lockfile with `scripts/dev.sh npm install --package-lock-only`. The next script run rebuilds
  the image.
- **Python:** `numpy`, `scipy` and `pytest`, pinned in `requirements.txt`.
