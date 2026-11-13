// Render many substances with one style and tile them into a contact sheet.
// usage: node src/sheet.mjs [--cols N] [--cell PX] [--captions] <domain> <style> <out.svg|out.png> <substance...>
//   --captions  label each tile with the Substance's "-- name: ..." header line (or its file name)
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { renderSVG, writeImage } from "./penrose.mjs";

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

const band = captions ? Math.round(cell * 0.1) : 0;
const rowH = cell + band;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const caption = (file) =>
  readFileSync(file, "utf8").match(/^-- name: (.+)$/m)?.[1].trim() ?? basename(file, ".substance");

// Nest each rendered SVG as a tile. Prefix ids so url(#...) references can't collide.
const tiles = [];
for (const [i, substance] of substances.entries()) {
  const p = `g${i}-`;
  const [x, y] = [(i % cols) * cell, Math.floor(i / cols) * rowH];
  const svg = (await renderSVG({ domain, substance, style }))
    .replace(/\bid="([^"]+)"/g, `id="${p}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${p}$1"`)
    .replace(/^<svg\b/, `<svg x="${x}" y="${y}" width="${cell}" height="${cell}"`);
  tiles.push(svg);
  if (captions) {
    tiles.push(
      `<text x="${x + cell / 2}" y="${y + cell + band * 0.6}" text-anchor="middle" ` +
        `font-family="DejaVu Serif, serif" font-size="${Math.round(band * 0.55)}" ` +
        `fill="rgb(60,52,44)">${esc(caption(substance))}</text>`,
    );
  }
}
const rows = Math.ceil(substances.length / cols);
const [w, h] = [cols * cell, rows * rowH];
const sheet =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
  `<rect width="100%" height="100%" fill="rgb(245,240,227)"/>${tiles.join("")}</svg>`;
await writeImage(sheet, out);
console.log("wrote", out, `(${substances.length} glyphs, ${cols}x${rows})`);
