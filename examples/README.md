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
| `loops/loop-R-kK.substance` | `src/loops.py examples/glyphs/glyphs.json examples/loops` | the 3 closed surface loops (rows A–C) and the star loops they generate, k = 1…6. k = 1 is the surface loop itself |
| `spells/spells.json` | extracted from the spell book sample | 5 spells: name, attributes, and edges between 11 points on a circle |
| `spells/<spell>.substance` | `src/spells.py examples/spells/spells.json examples/spells` | each spell on the 11-point sphere, as `Link` arcs |

The surface glyphs (`Start`, `End` and `Step` along `Contact` edges) are made for the **seal**
and **brush** styles, and also work in **glass**. The star loops have no `Contact` edges and
travel through the interior, so they are meant for **glass**. The same goes for the loops.

### Spells

The spell diagrams come from **_The Spell Writing Guide_** by Gorilla of Destiny:
[DriveThruRPG product page](https://www.drivethrurpg.com/en/product/429711/the-spell-writing-guide),
and the [author's books and compendiums](https://www.gorillaofdestiny.com/books-and-compendiums).
The edge lists were extracted from the publicly available sample (Chapter 2: Damage Spells,
5 of its 18 spells, chosen to show the range of the designs). This is a small proof of concept:
an interpretation offered for the author's consideration. The spell circles, their construction,
and the attribute data belong to the author.

`spells.json` records each spell's diagram from the source book: 11 points on a circle, with
bold chords between them. The book doesn't number the points, so the numbering here was chosen
during extraction: **0 at the bottom, increasing counter-clockwise on the page.** In every
spell, point 5 is joined to points 0–4.

`spells.py` moves the 11 points onto the sphere at the 11-point Tammes optimum: a regular
icosahedron with its south vertex removed. It uses the "hub at the pole" mapping. Point 5 goes
to the north pole, 0–4 to the upper ring and 6–10 to the lower ring, so the shared 5→0…4 base
becomes five short spokes from the centre. Each chord becomes a great-circle arc on the surface.
Antipodal pairs have no unique great circle, so they're routed over the pole. The arc samples
are written into the Substance as `Link(a, b, …15 numbers…)`, and `spell.style` inks each one
as a tapered brush stroke. Points drawn as filled dots in the book become `Mark(v)`.

```sh
scripts/dev.sh node src/sheet.mjs --cols 5 --captions penrose/tammes-glyph.domain \
    penrose/styles/spell.style out/spells.png examples/spells/*.substance
```

To render all of them, with contact sheets, into `out/`:

```sh
scripts/dev.sh scripts/build-examples.sh
```
