// The soap film: a true disc, its rim on the loop, and the least-area flow lowering its area.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filmArea, filmMesh, paintFilm } from "../site/lib/film.js";
import { path3d } from "../site/lib/cloud.js";
import { star, decodeLoop } from "../site/lib/glyph-text.js";

const data = JSON.parse(readFileSync("site/spike/data.json", "utf8"));
const loops = [star(data.loops.A, 1), star(data.loops.C, 4), decodeLoop("72b491c53a68")];

test("the mesh is a disc: vertices - edges + faces = 1", () => {
  const { pos, tris } = filmMesh(data.points, loops[0], { minimal: 0 });
  const edges = new Set();
  for (const [a, b, c] of tris) for (const [u, v] of [[a, b], [b, c], [c, a]]) edges.add(u < v ? `${u},${v}` : `${v},${u}`);
  assert.equal(pos.length / 3 - edges.size + tris.length, 1);
});

test("the film's rim lies on the loop's path", () => {
  const film = filmMesh(data.points, loops[1], {});
  const path = path3d(data.points, loops[1], {});
  // distance from a point to the path's polyline (its segments, not just its sample points)
  const toSegment = (p, a, b) => {
    const ab = b.map((x, k) => x - a[k]), ap = p.map((x, k) => x - a[k]);
    const t = Math.max(0, Math.min(1, ap.reduce((s, x, k) => s + x * ab[k], 0) / (ab.reduce((s, x) => s + x * x, 0) || 1)));
    return Math.hypot(...p.map((x, k) => x - (a[k] + ab[k] * t)));
  };
  for (const v of film.rim) {
    const p = [0, 1, 2].map((k) => film.pos[v * 3 + k]);
    let nearest = Infinity;
    for (let i = 0; i < path.length; i++) nearest = Math.min(nearest, toSegment(p, path[i].p, path[(i + 1) % path.length].p));
    assert.ok(nearest < 1e-3, `rim point ${nearest.toFixed(4)} off the loop`);
  }
});

test("the least-area flow lowers the film's area", () => {
  for (const loop of loops) {
    const harmonic = filmArea(filmMesh(data.points, loop, { minimal: 0 }));
    const minimal = filmArea(filmMesh(data.points, loop, { minimal: 40 }));
    assert.ok(minimal < harmonic, `area ${harmonic.toFixed(4)} -> ${minimal.toFixed(4)}`);
  }
});

test("the same loop paints the same film", () => {
  const paint = () => {
    const buf = { w: 160, h: 160, rgb: new Float32Array(160 * 160 * 3) };
    paintFilm(buf, data.points, loops[2], { size: 160 });
    return buf.rgb;
  };
  assert.deepEqual(paint(), paint());
});
