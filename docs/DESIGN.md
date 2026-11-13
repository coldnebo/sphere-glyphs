# Tammes Glyphs — Design

A generative writing system built from the best possible arrangement of points on a sphere.
Its glyphs are paths through those points. They are projected onto the page and drawn with
a brush model that ranges from formal (seal script) to expressive (cursive).

---

## 1. Origin

The n-th roots of unity give the vertices of a regular n-gon: every point is equivalent to
every other under rotation. The question was whether this extends to a sphere, giving 13
points spread evenly over its surface.

**Not exactly, on the ordinary sphere.** A perfectly symmetric arrangement is the orbit of a
finite rotation group, and on the ordinary sphere S² those groups are the cyclic, dihedral,
tetrahedral (12), octahedral (24) and icosahedral (60) groups. A 13-point orbit forces the
group C₁₃ or D₁₃, which puts every point on a single circle: the flat 13-gon again.

**In higher dimensions, yes.** Dropping the constant term of the 13th roots of unity gives
the regular 12-simplex in ℝ¹²:
`p_k = (1/√6)·(cos 2πjk/13, sin 2πjk/13)` for j = 1…6. Every pair of points has the same
inner product, −1/12. The perfect difference set {0, 1, 3, 9} mod 13 gives an
equiangular tight frame of 13 vectors in ℂ⁴.

**On S², "evenly spread" becomes an optimisation problem.** It has two classic forms:
- **Thomson:** minimise the total Coulomb energy Σ 1/r.
- **Tammes:** maximise the minimum distance between any two points, like packing N equal
  caps. A botanist posed it in 1930 after studying the pores on pollen grains.

Both belong to the Riesz-energy family, and both have rugged landscapes full of metastable
local minima. Physical examples include colloidosomes, virus capsids and fullerenes.

## 2. The 13-point Tammes optimum

Musin and Tarasov proved the solution in 2012, with a computer-assisted proof that
enumerates the possible "irreducible contact graphs". It is the first case beyond the
classical ones, and it is tied to the Newton–Gregory kissing-number dispute.

Reproduced here numerically (`src/tammes.py`, multi-start SLSQP):

| Property | Value |
|---|---|
| Minimum angular separation | **57.1367°**, short of the 60° needed for a 13th kissing sphere |
| Contact graph | 24 edges; degrees 3×4, 4×9 |
| Symmetry | 8 isometries (4 rotations, 4 reflections) about an axis through one vertex |
| Layout | rings of 1 + 4 + 4 + 4 at 0°, ~57°, ~95° and ~137° from the axis |
| Largest empty cap | centred on the far end of the axis |

The 4-fold axis is the natural "up" for every glyph. With the axis at the centre of the
page, the structure shows as a quatrefoil.

## 3. Glyph model

The model is a stack of layers. Each layer is a dial between formal and expressive.

| Layer | Formal end | Expressive end |
|---|---|---|
| **Points** | Tammes optimum | metastable siblings, e.g. "dialects" (not built) |
| **Topology**: which points connect | Hamiltonian paths on contact arcs | arbitrary permutations, chords through the interior |
| **Projection** | Lambert equal-area map (planar, no crossings) | orthographic glass sphere with tilt (crossings, depth) |
| **Kinematics**: the hand | exact arcs | momentum: corners cut midpoint to midpoint |
| **Brush and ink** | uniform weight | pressure from turn sharpness, entry press, lifted tail, depth thinning |

### Topology

- **Surface paths:** Hamiltonian paths on the contact graph, visiting every vertex once
  along minimum-distance arcs. There are 3,120 directed paths, which reduce to **199
  distinct glyphs** up to symmetry and reversal: about the size of a syllabary. On the
  sphere they never cross themselves, and under the equal-area map they stay planar.
- **Chord loops:** any permutation, joined by straight chords through the interior. The
  first family studied is **spherical star polygons**: the points are ordered axis first,
  then ring by ring by azimuth, and visited in the order i → k·i mod 13. On a circle this
  rule gives {13/k} from the roots of unity, so the project returns to its starting
  question in 3D. Each k from 1 to 6 gives one closed loop; k and 13−k give the same loop
  reversed. Open chord paths number 13!/(8·2) ≈ 3.9 × 10⁸ up to symmetry; closed loops
  number 12!/(2·8) ≈ 3.0 × 10⁷.
- **Loops from surface loops** (`loops.py`): the contact graph has only **3 closed
  Hamiltonian loops** up to symmetry. Each one is itself an ordering of the 13 points, so it
  can stand in for the roots of unity: stepping by k = 1…6 gives a 3 × 6 table of
  **18 distinct loop glyphs**. k = 1 is the surface loop, drawn along contact arcs, and each
  step of k pulls it further into the interior. The star ordering above isn't a surface
  loop, so its six stars are a separate family.

### Projections

- **Lambert azimuthal equal-area:** `(x, y)·√(2/(1+z))`. The whole sphere maps into a
  disc of radius 2. The near hemisphere sits inside radius √2; the far hemisphere is the
  outer band. This is a map, not a view: no strokes overlap.
- **Stereographic:** `(x, y)/(1+z)`. Conformal, so arcs stay circular, but it stretches
  the outer ring 2.6× and was rejected.
- **Orthographic glass:** `(x, y)` after a tilt about the x-axis. Front and back
  interleave. Chords stay straight, and depth varies linearly along each one.

### Brush model

Each interior vertex b, entered from a and left toward c, gets one piece:
- The centreline is a quadratic Bézier from mid(ab) to mid(bc), with b as the control
  point. Neighbouring pieces share endpoints and tangent directions, so the stroke is
  smooth everywhere.
- The piece is drawn as a filled outline made of offset quadratics. The half-width is h₀
  where pieces meet and h_w at the turn, with `h_w = h₀·(1.55 − 0.85·cos θ)`: a straight
  pass is fast and thin, a tight turn slow and pressed.
- In the glass style, h₀ also depends on the depth at the chord midpoint. Neighbouring
  pieces agree on that depth, so width stays continuous.
- Start: a press dot, then a short widening lead. End: a taper to a point, short of the
  last vertex.

The Chinese scripts map onto the dial: **seal** (篆书, uniform weight, exact geometry) →
**regular** (楷书, deliberate press at stroke start and end) → **running and cursive**
(行书 and 草书, momentum-driven continuous paths).

## 4. Implementation (Penrose spike)

[Penrose](https://penrose.cs.cmu.edu) (CMU) was chosen for the formal layer. You declare
the mathematical objects and the visual rules, and it lays out the picture by numerical
optimisation, close in spirit to the Tammes problem itself. Version 3.3.1 was used.

```
src/tammes.py          solve Tammes(N), extract contact graph      -> examples/tammes13.json
src/glyphs.py          pole/orientation, Hamiltonian paths, symmetry dedupe -> Substances
src/stars.py           spherical star loops i -> k*i mod 13        -> Substances
src/render.mjs         compile + optimize + toSVG/PNG (Node + jsdom, src/penrose.mjs)
src/sheet.mjs          tile many renders into a contact sheet

penrose/tammes-glyph.domain
    type Vertex
    predicate At(Vertex, Number, Number, Number)   -- 3D coords as Substance literals
    predicate Contact(Vertex, Vertex)
    predicate Step(Vertex, Vertex)
    predicate Start(Vertex)
    predicate End(Vertex)
penrose/styles/seal.style  Lambert, exact projected arcs, uniform weight
penrose/styles/brush.style Lambert, momentum + pressure outlines
penrose/styles/glass.style orthographic + tilt; back wash / halo / front ink passes
```

Design decisions:
- **Coordinates are data and the projection is style.** The 3D points go into Substance
  as numbers, so changing the projection or tilt means editing only the Style.
- **Per-corner geometry is stored on the middle vertex** (`b.m1`, `b.hin`, …). Each vertex
  is the middle of at most one corner on a path, so names never collide.
- **Layer order** is pinned with invisible marker shapes in `global`, because Penrose
  sorts shapes topologically by their `layer` constraints.
- Penrose's optimiser does no work yet: all geometry arrives precomputed.

## 5. Known limitations

1. **The front/back switch happens at piece joins, not at the sphere's outline.** Ink
   fades in according to the depth of each corner's middle vertex, so a stroke changes
   colour at a chord midpoint near the outline rather than exactly on it.
2. **Hairpin turns** (near-reversals in the projected image) produce thin spikes, because
   the offset outline folds over itself. They read a little like a brush flick, but they
   are an artefact.
3. **Depth order among front strokes is arbitrary.** Once chords can cross, two front
   strokes can overlap, and Penrose's static layering can't sort shapes by a depth it
   computes at runtime.
4. Contact arcs are approximated by quadratics through the projected arc midpoint. That's
   fine for 57° arcs but not exact.
5. **Repeated numbers in one Substance statement break matching.** Penrose binds the
   `Number` variables of a Style `forall` injectively, so `At(v, 0, 0, 1)` (with x = y)
   never matches, and the vertex silently disappears. `-0` counts as equal to `0`.
   `spells.py` nudges repeated values by 1e-6 (`literals()`), and a test guards it. The
   13-point data avoids this only by luck.

Items 1 and 3 both point to a renderer outside Penrose that splits pieces at the outline
and sorts them by depth.

## 6. Directions

**Near term**
- Depth-correct renderer: split pieces at the outline, sort by depth, and give each piece
  a real ink gradient (Taichi or WebGL).
- An animated `tilt`: a chord loop's silhouette changes as the sphere turns, so a glyph
  could be read from a viewpoint, or resolve only from one angle.
- Ink simulation: a reservoir that depletes along the stroke, dry-brush "flying white"
  (飞白) on fast passes, and bleed into paper (cf. MoXi, Chu & Tai 2005; Baxter's DAB
  brush).

**Writing system**
- **Grammar from the rule.** Step sizes k = 1…12 form the multiplicative group mod 13,
  which is cyclic of order 12, so composing two glyphs' rules gives another glyph: an
  algebra of meanings. Starting point and ordering could act as inflections.
- **Readability:** decide whether orientation is significant (fixed axis, as now) or
  irrelevant (glyphs equal up to symmetry). Test whether the 199 surface glyphs can be
  told apart at small sizes.
- **Words:** compose several glyphs on the page. That's a layout problem Penrose's
  optimiser is well suited to.
- **Other N:** compare alphabets from N = 12 (icosahedral, highly symmetric) and N = 14
  (the most recently proven Tammes case) with 13 (low symmetry, rich alphabet).

**Points layer**
- Move the Tammes and Thomson relaxations into Penrose or Taichi and keep metastable
  minima as variant letterforms ("dialects").

**Lineage** — dot-and-line writing systems: kolam (South India) and sona sand drawings
(Chokwe, Angola), where a continuous line loops around a dot grid; the circular,
non-linear logograms of *Arrival*. Here the dot grid is replaced by an optimal sphere
packing: the dots sit where geometry says they must.

## References

- O. R. Musin, A. S. Tarasov, *The strong thirteen spheres problem*, Discrete Comput. Geom.
  48 (2012) 128–141. [arXiv:1002.1439](https://arxiv.org/abs/1002.1439)
- O. R. Musin, A. S. Tarasov, *The Tammes problem for N = 14*, Experimental Mathematics 24
  (2015). [arXiv:1410.2536](https://arxiv.org/abs/1410.2536)
- P. M. L. Tammes, *On the number and arrangements of the places of exit on the surface of
  pollen-grains* (1930).
- [Tammes problem — Wikipedia](https://en.wikipedia.org/wiki/Tammes_problem)
- [Penrose](https://penrose.cs.cmu.edu), Carnegie Mellon University.
