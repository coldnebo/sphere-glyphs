// The site spike builds Substance and Style text in the browser; check that text compiles
// and renders through Penrose for arbitrary view rotations.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderSVG } from "../src/penrose.mjs";
import { literals, loopSubstance, withBrush, withView } from "../site/spike/glyph-text.js";

const data = JSON.parse(readFileSync("site/spike/data.json", "utf8"));
const glass = readFileSync("penrose/styles/glass.style", "utf8");
const dir = mkdtempSync(join(tmpdir(), "site-"));

// column-major 4x4 rotation about the x axis, then about the y axis
function rot(ax, ay) {
  const [cx, sx, cy, sy] = [Math.cos(ax), Math.sin(ax), Math.cos(ay), Math.sin(ay)];
  // R = Ry * Rx
  const r = [[cy, sy * sx, sy * cx], [0, cx, -sx], [-sy, cy * sx, cy * cx]];
  return [r[0][0], r[1][0], r[2][0], 0, r[0][1], r[1][1], r[2][1], 0, r[0][2], r[1][2], r[2][2], 0, 0, 0, 0, 1];
}

async function render(loop, k, m) {
  const L = data.loops[loop];
  const cycle = L.map((_, i) => L[(k * i) % L.length]);
  const sub = join(dir, `${loop}${k}.substance`);
  const sty = join(dir, `${loop}${k}.style`);
  writeFileSync(sub, loopSubstance(data.points, cycle));
  writeFileSync(sty, withView(glass, m));
  return renderSVG({ domain: "penrose/tammes-glyph.domain", substance: sub, style: sty });
}

test("literals stay distinct, -0 included", () => {
  assert.equal(literals([0, -0, 0.5]), "0.000000, 0.000001, 0.500000");
});

test("withView replaces the view block, and refuses a style without one", () => {
  const s = withView(glass, rot(0.3, -1.2));
  assert.match(s, /r12 = /);
  assert.doesNotMatch(s, /spin = /);
  assert.throws(() => withView("canvas {}", rot(0, 0)));
});

test("every loop and k renders from an arbitrary view", async () => {
  for (const loop of Object.keys(data.loops)) {
    for (const k of [1, 4]) {
      const svg = await render(loop, k, rot(1.1, 2.3));
      assert.ok((svg.match(/<path\b/g) ?? []).length >= 13, `${loop} k=${k}`);
    }
  }
});

test("the view actually changes the drawing", async () => {
  const a = await render("A", 3, rot(0.52, 0));
  const b = await render("A", 3, rot(0.52, 1.0));
  assert.notEqual(a, b);
});

test("withBrush sets the brush block, and the result renders", async () => {
  const s = withBrush(glass, { base: 10, momentum: 0.2, pressure: 2 });
  assert.match(s, /^\s*base = 10\.0000/m);
  assert.match(s, /^\s*momentum = 0\.2000/m);
  assert.match(s, /^\s*pressure = 2\.0000/m);
  assert.throws(() => withBrush("canvas {}", {}));
  const L = data.loops.C;
  const sub = join(dir, "brush.substance");
  const sty = join(dir, "brush.style");
  writeFileSync(sub, loopSubstance(data.points, L.map((_, i) => L[(3 * i) % 13])));
  writeFileSync(sty, withBrush(withView(glass, rot(0.4, 0.9)), { base: 3, momentum: 0.1, pressure: 0 }));
  const svg = await renderSVG({ domain: "penrose/tammes-glyph.domain", substance: sub, style: sty });
  assert.ok((svg.match(/<path\b/g) ?? []).length >= 13);
});
