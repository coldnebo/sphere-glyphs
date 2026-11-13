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
| `tests/test_loops.py`   | There are 3 closed surface loops, all closing along contact edges. They generate 18 distinct loop glyphs. k and 13−k give the same loop. Regenerating `examples/loops` gives byte-identical files. |
| `tests/test_burnside.py` | The invariant-loop search matches brute force on small cases. The exact count for the 13 points is consistent with 12!/2 and the symmetric loops. |
| `tests/test_spells.py`  | The 11-point sphere is the Tammes optimum (63.4349°, 25 contacts, matching the solver). The hub sits at the pole. Arcs, including antipodal ones, are correct. Every spell has the shared base. Every Substance statement has distinct numbers. Regenerating `examples/spells` gives byte-identical files. |
| `tests/render.test.mjs` | Every style compiles, optimizes and renders through Penrose. PNG rasterization works. |

The byte-identical tests are a regression net. If you change `glyphs.py` or `stars.py` on
purpose, run `scripts/build-examples.sh --regen` and commit the regenerated examples.

## Dependencies

- **Node:** `@penrose/core` 3.3.1 (pinned, because the styles were written against it), `jsdom`
  (Penrose needs a DOM), `@resvg/resvg-js` (SVG to PNG), and `three` (the site's 3D views).
  After editing `package.json`, refresh the lockfile from a plain Node container. `dev.sh`
  can't do it, because building the dev image runs `npm ci`, which refuses an outdated lockfile:
  ```sh
  MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W 2>/dev/null || pwd):/w" -w /w \
      node:22-bookworm-slim npm install --package-lock-only
  ```
  The next script run rebuilds the image.

## Site preview

`scripts/serve.sh` serves the repo from the dev container at <http://localhost:8000>, with the
image's `node_modules` mounted at `/node_modules/`. The spike is at
<http://localhost:8000/site/spike/>. In the devcontainer, run `node scripts/serve.mjs`; port
8000 is forwarded.

The spike's data comes from `python3 src/site_data.py examples/glyphs/glyphs.json site/spike/data.json`.
- **Python:** `numpy`, `scipy` and `pytest`, pinned in `requirements.txt`.

## Site build

`node site/build.mjs` (in the container) builds the articles into `_site/`, which git ignores.
Preview with `scripts/serve.sh` at <http://localhost:8000/_site/loops/>.

- Articles are Markdown in `site/articles/`. Each `## Section` becomes a full-screen spread.
  `![caption](fig:name)` places a figure from `site/figures.mjs`. A paragraph starting with
  `**Look further:**` becomes a breakout panel. `text[^key]` cites a `[^key]: …` entry under
  `## Sources`; sources are numbered by first use, and any that aren't cited are listed as further
  reading.
- Figures are rendered at build time. Penrose glyphs become image files; the hand-drawn circle
  diagrams are inlined so their strokes can animate.
- The page template, styles and scroll script are in `site/article/`.
- `scripts/run-tests.sh` runs the build, so a missing figure or an undefined citation fails the tests.
