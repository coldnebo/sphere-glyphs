#!/usr/bin/env bash
# In-container: regenerate example Substances and render everything into out/.
#
#   scripts/build-examples.sh            render existing examples -> out/
#   scripts/build-examples.sh --regen    also re-run glyphs.py / stars.py over examples/
#   scripts/build-examples.sh --solve    also re-solve Tammes(13) first (~40 s)
#
# Run from the host with:  scripts/dev.sh scripts/build-examples.sh [--regen|--solve]
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

DOMAIN=penrose/tammes-glyph.domain
STYLES=penrose/styles

case "${1:-}" in
  --solve) python3 src/tammes.py 13 examples/tammes13.json ;&
  --regen) python3 src/glyphs.py examples/tammes13.json examples/glyphs 24
           python3 src/stars.py examples/glyphs/glyphs.json examples/stars ;;
  "") ;;
  *) echo "unknown option: $1" >&2; exit 2 ;;
esac

mkdir -p out/glyphs out/stars out/sheets
for style in seal brush glass; do
  for s in examples/glyphs/*.substance; do
    node src/render.mjs "$DOMAIN" "$s" "$STYLES/$style.style" "out/glyphs/$(basename "$s" .substance)-$style.svg" >/dev/null
  done
done
for s in examples/stars/*.substance; do
  node src/render.mjs "$DOMAIN" "$s" "$STYLES/glass.style" "out/stars/$(basename "$s" .substance)-glass.svg" >/dev/null
done

# Contact sheets: the first 12 glyphs in each surface style, and all 6 star loops in glass.
mapfile -t first12 < <(ls examples/glyphs/*.substance | head -12)
for style in seal brush glass; do
  node src/sheet.mjs "$DOMAIN" "$STYLES/$style.style" "out/sheets/$style-sheet.png" "${first12[@]}"
done
node src/sheet.mjs --cols 3 "$DOMAIN" "$STYLES/glass.style" out/sheets/stars-sheet.png examples/stars/*.substance

echo "done: $(find out -name '*.svg' | wc -l) SVGs in out/glyphs, out/stars; sheets in out/sheets"
