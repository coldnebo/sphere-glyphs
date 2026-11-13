// Render many substances with one style and tile them into a contact sheet.
// usage: node src/sheet.mjs [--cols N] [--cell PX] <domain> <style> <out.svg|out.png> <substance...>
import { renderSVG, writeImage } from "./penrose.mjs";

const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  if (i < 0) return dflt;
  const v = Number(args[i + 1]);
  args.splice(i, 2);
  return v;
};
const cols = opt("--cols", 4);
const cell = opt("--cell", 312);
const [domain, style, out, ...substances] = args;
if (!substances.length) {
  console.error("usage: node src/sheet.mjs [--cols N] [--cell PX] <domain> <style> <out> <substance...>");
  process.exit(2);
}

// Nest each rendered SVG as a tile. Prefix ids so url(#...) references can't collide.
const tiles = [];
for (const [i, substance] of substances.entries()) {
  const p = `g${i}-`;
  const svg = (await renderSVG({ domain, substance, style }))
    .replace(/\bid="([^"]+)"/g, `id="${p}$1"`)
    .replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`)
    .replace(/href="#([^"]+)"/g, `href="#${p}$1"`)
    .replace(/^<svg\b/, `<svg x="${(i % cols) * cell}" y="${Math.floor(i / cols) * cell}" width="${cell}" height="${cell}"`);
  tiles.push(svg);
}
const rows = Math.ceil(substances.length / cols);
const [w, h] = [cols * cell, rows * cell];
const sheet =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
  `<rect width="100%" height="100%" fill="rgb(245,240,227)"/>${tiles.join("")}</svg>`;
await writeImage(sheet, out);
console.log("wrote", out, `(${substances.length} glyphs, ${cols}x${rows})`);
