// Render many substances with one style and tile them into a contact sheet.
// usage: node src/sheet.mjs [--cols N] [--cell PX] [--captions] <domain> <style> <out.svg|out.png> <substance...>
//   --captions  label each tile with the Substance's "-- name: ..." header line (or its file name)
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { composeSheet, renderSVG, writeImage } from "./penrose.mjs";

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  if (i < 0) return dflt;
  const v = Number(args[i + 1]);
  args.splice(i, 2);
  return v;
};
const flag = (name) => {
  const i = args.indexOf(name);
  if (i >= 0) args.splice(i, 1);
  return i >= 0;
};
const cols = opt("--cols", 4);
const cell = opt("--cell", 312);
const captions = flag("--captions");
const [domain, style, out, ...substances] = args;
if (!substances.length) {
  console.error("usage: node src/sheet.mjs [--cols N] [--cell PX] [--captions] <domain> <style> <out> <substance...>");
  process.exit(2);
}

const caption = (file) =>
  readFileSync(file, "utf8").match(/^-- name: (.+)$/m)?.[1].trim() ?? basename(file, ".substance");

const svgs = [];
for (const substance of substances) svgs.push(await renderSVG({ domain, substance, style }));
await writeImage(composeSheet(svgs, { cols, cell, captions: captions ? substances.map(caption) : null }), out);
console.log("wrote", out, `(${substances.length} glyphs, ${cols}x${Math.ceil(substances.length / cols)})`);
