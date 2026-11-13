// Smoke test: every style compiles, optimizes and renders against real example Substances.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderSVG, writeImage } from "../src/penrose.mjs";

const domain = "penrose/tammes-glyph.domain";
const cases = [
  ["seal", "examples/glyphs/glyph-0000.substance"],
  ["brush", "examples/glyphs/glyph-0000.substance"],
  ["glass", "examples/glyphs/glyph-0000.substance"],
  ["glass", "examples/stars/star-13-2.substance"],
  ["spell", "examples/spells/acid-splash.substance"],
  ["spell", "examples/spells/chill-touch.substance"],
];

for (const [style, substance] of cases) {
  test(`${style} renders ${substance}`, async () => {
    const svg = await renderSVG({ domain, substance, style: `penrose/styles/${style}.style` });
    assert.match(svg, /^<svg\b/);
    assert.ok((svg.match(/<path\b/g) ?? []).length >= 10, "expected brush/arc paths in output");
  });
}

test("writeImage rasterizes PNG", async () => {
  const svg = await renderSVG({
    domain,
    substance: "examples/glyphs/glyph-0000.substance",
    style: "penrose/styles/brush.style",
  });
  const out = join(mkdtempSync(join(tmpdir(), "glyphs-")), "g.png");
  await writeImage(svg, out);
  assert.ok(statSync(out).size > 1000);
  assert.deepEqual([...readFileSync(out).subarray(1, 4)], [0x50, 0x4e, 0x47]); // "PNG"
});
