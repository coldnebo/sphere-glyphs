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
           python3 src/stars.py examples/glyphs/glyphs.json examples/stars
           python3 src/loops.py examples/glyphs/glyphs.json examples/loops
           python3 src/spells.py examples/spells/spells.json examples/spells ;;
  "") ;;
  *) echo "unknown option: $1" >&2; exit 2 ;;
esac

mkdir -p out/glyphs out/stars out/loops out/spells out/sheets
for style in seal brush glass; do
  for s in examples/glyphs/*.substance; do
    node src/render.mjs "$DOMAIN" "$s" "$STYLES/$style.style" "out/glyphs/$(basename "$s" .substance)-$style.svg" >/dev/null
  done
done
for s in examples/stars/*.substance; do
  node src/render.mjs "$DOMAIN" "$s" "$STYLES/glass.style" "out/stars/$(basename "$s" .substance)-glass.svg" >/dev/null
done

for s in examples/loops/*.substance; do
  node src/render.mjs "$DOMAIN" "$s" "$STYLES/glass.style" "out/loops/$(basename "$s" .substance).svg" >/dev/null
done
for s in examples/spells/*.substance; do
  node src/render.mjs "$DOMAIN" "$s" "$STYLES/spell.style" "out/spells/$(basename "$s" .substance).svg" >/dev/null
done

# Contact sheets: the first 12 glyphs in each surface style, and all 6 star loops in glass.
mapfile -t first12 < <(ls examples/glyphs/*.substance | head -12)
for style in seal brush glass; do
  node src/sheet.mjs "$DOMAIN" "$STYLES/$style.style" "out/sheets/$style-sheet.png" "${first12[@]}"
done
node src/sheet.mjs --cols 3 "$DOMAIN" "$STYLES/glass.style" out/sheets/stars-sheet.png examples/stars/*.substance
node src/sheet.mjs --cols 6 --captions "$DOMAIN" "$STYLES/glass.style" out/sheets/loops-sheet.png examples/loops/*.substance
node src/sheet.mjs --cols 5 --captions "$DOMAIN" "$STYLES/spell.style" out/sheets/spells-sheet.png examples/spells/*.substance

# Atlas: all 199 surface glyphs (generated into out/, not committed)
python3 src/glyphs.py examples/tammes13.json out/atlas 199 >/dev/null
node src/sheet.mjs --cols 20 --cell 160 --captions "$DOMAIN" "$STYLES/brush.style" out/sheets/atlas-brush.png out/atlas/glyph-*.substance

echo "done: $(find out -name '*.svg' | wc -l) SVGs in out/{glyphs,stars,loops,spells}; sheets and the 199-glyph atlas in out/sheets"
