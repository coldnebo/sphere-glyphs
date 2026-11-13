# Examples

Everything here is generated, and the tests check that regenerating it reproduces it
byte for byte. Render any Substance with any Style:

```sh
scripts/dev.sh node src/render.mjs penrose/tammes-glyph.domain <substance> penrose/styles/<style>.style out/x.svg
```

| path | made by | contents |
|---|---|---|
| `tammes13.json` | `src/tammes.py 13 examples/tammes13.json` | the 13 points (unoriented), the minimum angle, and the contact edges |
| `glyphs/glyph-NNNN.substance` | `src/glyphs.py examples/tammes13.json examples/glyphs 24` | 24 of the 199 surface glyphs, a seeded random sample. `NNNN` is the glyph's index in the canonical list |
| `glyphs/glyphs.json` | same | the oriented points, the edges, and all 199 canonical paths |
| `stars/star-13-k.substance` | `src/stars.py examples/glyphs/glyphs.json examples/stars` | the closed chord loops i → k·i mod 13, for k = 1…6 |

The surface glyphs (`Start`, `End` and `Step` along `Contact` edges) are made for the **seal**
and **brush** styles, and also work in **glass**. The star loops have no `Contact` edges and
travel through the interior, so they are meant for **glass**.

To render all of them, with contact sheets, into `out/`:

```sh
scripts/dev.sh scripts/build-examples.sh
```
