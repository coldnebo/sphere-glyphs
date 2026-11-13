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

test("the painting doesn't change with resolution: a small preview and a large print agree", () => {
  // paint at 300 and 1200 px, average the large one down to 300, and compare the ink:
  // total coverage, and where it lies (correlation of 15 x 15 blocks)
  for (const name of ["fluent", "big"]) {
    const small = canvas(300), large = canvas(1200);
    paintGlyph(small, data.points, loop, { size: 300, ...BRUSHES[name] });
    paintGlyph(large, data.points, loop, { size: 1200, ...BRUSHES[name] });
    const ink = (buf, f) => {                      // darkness (0..1) of each 300-px pixel
      const out = new Float32Array(300 * 300);
      for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
        out[Math.floor(y / f) * 300 + Math.floor(x / f)] += (1 - buf.rgb[(y * buf.w + x) * 3] / 245) / (f * f);
      }
      return out;
    };
    const a = ink(small, 1), b = ink(large, 4);
    const total = (v) => v.reduce((s, x) => s + x, 0);
    const ratio = total(b) / total(a);
    assert.ok(ratio > 0.85 && ratio < 1.15, `${name}: ink differs by ${((ratio - 1) * 100).toFixed(0)}%`);
    const blocks = (v) => {
      const out = new Float32Array(20 * 20);
      for (let i = 0; i < v.length; i++) out[Math.floor(Math.floor(i / 300) / 15) * 20 + Math.floor((i % 300) / 15)] += v[i];
      return out;
    };
    const A = blocks(a), B = blocks(b);
    const mean = (v) => total(v) / v.length, ma = mean(A), mb = mean(B);
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < A.length; i++) {
      num += (A[i] - ma) * (B[i] - mb);
      da += (A[i] - ma) ** 2;
      db += (B[i] - mb) ** 2;
    }
    const r = num / Math.sqrt(da * db);
    assert.ok(r > 0.93, `${name}: ink lies in different places (r = ${r.toFixed(3)})`);
  }
});
