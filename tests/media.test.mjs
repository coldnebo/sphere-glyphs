// The photographs: every one the articles use is fetched, local, and public domain or CC0.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const manifest = JSON.parse(readFileSync("site/media/manifest.json", "utf8"));

function references() {
  const refs = [];
  for (const f of readdirSync("site/articles").filter((f) => f.endsWith(".md"))) {
    for (const para of readFileSync(join("site/articles", f), "utf8").split(/\n{2,}/)) {
      const m = /^!\[[^\]]*\]\((commons|scroll):([^)]+(?:\([^)]*\)[^)]*)*)\)\s*$/.exec(para.trim());
      if (m) refs.push({ article: f, kind: m[1], name: m[2].trim() });
    }
  }
  return refs;
}

test("every commons:/scroll: plate in the articles has a local copy of the right kind", () => {
  const refs = references();
  assert.ok(refs.length >= 10);
  for (const r of refs) {
    const m = manifest[r.name];
    assert.ok(m, `${r.article}: ${r.name} missing from site/media/manifest.json (run node site/media/fetch.mjs)`);
    assert.equal(m.kind, r.kind, `${r.name}: fetched as ${m.kind}, used as ${r.kind}`);
  }
});

test("every manifest entry is public domain or CC0, on disk, and reasonably small", () => {
  for (const [name, m] of Object.entries(manifest)) {
    assert.match(m.licence, /^(public domain|cc0|pd)/i, `${name}: ${m.licence}`);
    assert.match(m.page, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, `${name}: source page`);
    const file = join("site/media", m.file);
    assert.ok(existsSync(file), `${file} missing`);
    assert.ok(statSync(file).size < 2.5e6, `${file} is over 2.5 MB`);
  }
});

test("no page loads images from Commons directly", () => {
  for (const f of ["site/home.html", ...readdirSync("site/articles").map((f) => join("site/articles", f))]) {
    assert.doesNotMatch(readFileSync(f, "utf8"), /Special:FilePath|upload\.wikimedia\.org/, f);
  }
});
