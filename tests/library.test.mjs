// The Library: every glyph exactly once, reachable by number. The full proof is the index
// build itself (it scans all 12! orderings and must total the Burnside count); these tests
// check the pieces and spot-check the committed index against fresh scans.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BLOCK, BLOCKS, ORDERINGS, Library, isCanonical, rank, scanBlock, shuffle, unrank,
} from "../site/lib/library.js";
import { canonicalCode, encodeLoop } from "../site/lib/glyph-text.js";
import { drawGlyph } from "../site/lib/sketch.js";

const data = JSON.parse(readFileSync("site/spike/data.json", "utf8"));
const counts = new Uint16Array(readFileSync("site/library/index.bin").buffer.slice(0));
const library = new Library(counts, data.symmetries);

let seed = 99;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test("the shuffle is a bijection", () => {
  for (const n of [1, 7, 1000, 4096]) {
    const seen = new Set();
    for (let i = 0; i < n; i++) seen.add(shuffle(i, n));
    assert.equal(seen.size, n);
    assert.ok([...seen].every((x) => x >= 0 && x < n));
  }
});

test("orderings round-trip through their numbers", () => {
  for (const k of [0, 1, 12345, ORDERINGS - 1, ...Array.from({ length: 200 }, () => Math.floor(rand() * ORDERINGS))]) {
    const loop = unrank(k);
    assert.equal(loop[0], 0);
    assert.deepEqual([...loop].sort((a, b) => a - b), [...Array(13).keys()]);
    assert.equal(rank(loop), k);
  }
});

test("isCanonical agrees with canonicalCode", () => {
  let found = 0;
  for (let t = 0; t < 3000; t++) {
    const loop = unrank(Math.floor(rand() * ORDERINGS));
    const expected = loop[1] < loop[12] && canonicalCode(loop, data.symmetries) === encodeLoop(loop);
    assert.equal(isCanonical(loop, data.symmetries), expected);
    found += expected;
  }
  assert.ok(found > 100 && found < 300, `about 1 in 16 orderings is canonical, got ${found}/3000`);
});

test("the index covers the whole space and totals the Burnside count", () => {
  assert.equal(counts.length, BLOCKS);
  assert.equal(library.size, 29_940_480);
});

test("the committed index matches fresh scans", () => {
  for (const b of [0, 1, 777, 58_000, BLOCKS - 1, ...Array.from({ length: 5 }, () => Math.floor(rand() * BLOCKS))]) {
    assert.equal(scanBlock(b, data.symmetries).length, counts[b], `block ${b}`);
  }
});

test("glyph n is canonical, in wall order, and distinct from its neighbours", () => {
  for (const start of [0, 13_337, 29_940_480 - 40, Math.floor(rand() * 29_900_000)]) {
    const codes = new Set();
    let last = -1;
    for (let n = start; n < start + 40; n++) {
      const g = library.glyph(n);
      assert.ok(isCanonical(g.loop, data.symmetries));
      assert.ok(g.position > last, "positions increase along the wall");
      assert.equal(Math.floor(g.position / BLOCK) <= BLOCKS - 1, true);
      last = g.position;
      codes.add(encodeLoop(g.loop));
    }
    assert.equal(codes.size, 40);
  }
  assert.throws(() => library.glyph(29_940_480), RangeError);
});

test("the sketch renderer draws a glyph", () => {
  globalThis.Path2D ??= class { moveTo() {} lineTo() {} quadraticCurveTo() {} closePath() {} };
  let fills = 0;
  const ctx = new Proxy({}, {
    get: (o, k) => (k in o ? o[k] : k === "fill" ? () => fills++ : () => {}),
    set: (o, k, v) => ((o[k] = v), true),
  });
  drawGlyph(ctx, data.points, library.glyph(5).loop, { size: 200 });
  assert.ok(fills >= 13 * 2, `expected wash and ink fills, got ${fills}`);
});
