// The ink brush: repeatable, ink only darkens, and every preset paints a stroke.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BRUSHES, centreline, paintGlyph } from "../site/lib/brush.js";
import { star } from "../site/lib/glyph-text.js";

const data = JSON.parse(readFileSync("site/spike/data.json", "utf8"));
const loop = star(data.loops.B, 3);
const canvas = (n) => ({ w: n, h: n, rgb: new Float32Array(n * n * 3) });

test("the centreline follows the loop, about a sample per pixel", () => {
  const line = centreline(data.points, loop, { size: 400 });
  assert.ok(line.length > 800, `only ${line.length} samples`);
  for (const p of line) {
    assert.ok(p.x > 0 && p.x < 400 && p.y > 0 && p.y < 400 && p.w > 0);
  }
});

test("the same loop paints the same picture", () => {
  const a = canvas(200), b = canvas(200);
  paintGlyph(a, data.points, loop, { size: 200 });
  paintGlyph(b, data.points, loop, { size: 200 });
  assert.deepEqual(a.rgb, b.rgb);
});

test("every preset lays down ink, and ink only darkens the paper", () => {
  for (const [name, preset] of Object.entries(BRUSHES)) {
    const c = canvas(240);
    paintGlyph(c, data.points, loop, { size: 240, ...preset });
    let dark = 0;
    for (let i = 0; i < c.rgb.length; i++) {
      assert.ok(c.rgb[i] <= 248.5, `${name}: a pixel lighter than paper`);
      if (i % 3 === 0 && c.rgb[i] < 120) dark++;
    }
    assert.ok(dark > 400, `${name}: only ${dark} inked pixels`);
  }
});
