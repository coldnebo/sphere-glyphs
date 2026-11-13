// The point-cloud style: repeatable, inside the sphere, and the same cloud at every size.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { paintCloud, path3d } from "../site/lib/cloud.js";
import { star } from "../site/lib/glyph-text.js";

const data = JSON.parse(readFileSync("site/spike/data.json", "utf8"));
const loop = star(data.loops.C, 4);
const canvas = (n) => ({ w: n, h: n, rgb: new Float32Array(n * n * 3) });

test("the 3D path stays within the sphere and visits every chord", () => {
  const line = path3d(data.points, loop, {});
  const chords = new Set(line.map((s) => s.chord));
  assert.equal(chords.size, 13);
  for (const s of line) assert.ok(Math.hypot(...s.p) <= 1 + 1e-9);
});

test("the same loop gives the same cloud", () => {
  const a = canvas(160), b = canvas(160);
  paintCloud(a, data.points, loop, { size: 160 });
  paintCloud(b, data.points, loop, { size: 160 });
  assert.deepEqual(a.rgb, b.rgb);
});

test("the cloud is the same at every size", () => {
  const small = canvas(300), large = canvas(1200);
  paintCloud(small, data.points, loop, { size: 300 });
  paintCloud(large, data.points, loop, { size: 1200 });
  const ink = (buf, f) => {
    const out = new Float32Array(20 * 20);
    for (let y = 0; y < buf.h; y++) for (let x = 0; x < buf.w; x++) {
      out[Math.floor(y / (15 * f)) * 20 + Math.floor(x / (15 * f))] += (1 - buf.rgb[(y * buf.w + x) * 3] / 245) / (f * f);
    }
    return out;
  };
  const A = ink(small, 1), B = ink(large, 4);
  const sum = (v) => v.reduce((s, x) => s + x, 0);
  const ratio = sum(B) / sum(A);
  assert.ok(ratio > 0.85 && ratio < 1.15, `ink differs by ${((ratio - 1) * 100).toFixed(0)}%`);
  const ma = sum(A) / A.length, mb = sum(B) / B.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < A.length; i++) { num += (A[i] - ma) * (B[i] - mb); da += (A[i] - ma) ** 2; db += (B[i] - mb) ** 2; }
  assert.ok(num / Math.sqrt(da * db) > 0.95);
});
