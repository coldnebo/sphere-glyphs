// Shared helpers: compile + optimize a Penrose trio headlessly (Node + jsdom).
import { readFileSync, writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const { window } = new JSDOM("<!DOCTYPE html><body></body>");
globalThis.window = window;
globalThis.document = window.document;
globalThis.XMLSerializer = window.XMLSerializer;

const { compile, optimize, toSVG, showError } = await import("@penrose/core");

const read = (p) => readFileSync(p, "utf8");

/** Render a Domain/Substance/Style trio given as program text; returns the SVG markup. */
export async function renderText({ domain, substance, style, variation = "tammes", label = "substance" }) {
  const compiled = await compile({ domain, substance, style, variation, excludeWarnings: [] });
  if (compiled.isErr()) throw new Error(`compile ${label}: ${showError(compiled.error)}`);
  for (const w of compiled.value.warnings ?? []) console.error("warning:", showError(w));

  const optimized = optimize(compiled.value);
  if (optimized.isErr()) throw new Error(`optimize ${label}: ${showError(optimized.error)}`);

  const svg = await toSVG(optimized.value, async () => undefined, variation);
  return svg.outerHTML;
}

/** Render one Domain/Substance/Style trio (file paths) and return the SVG markup. */
export async function renderSVG({ domain, substance, style, variation = "tammes" }) {
  return renderText({
    domain: read(domain), substance: read(substance), style: read(style), variation, label: substance,
  });
}

/**
 * Tile SVG renders into one sheet. Ids are prefixed per tile so url(#...) references can't
 * collide. Optional captions sit in a band under each tile.
 */
export function composeSheet(svgs, { cols = 4, cell = 312, captions = null, background = "rgb(245,240,227)" } = {}) {
  const band = captions ? Math.round(cell * 0.1) : 0;
  const rowH = cell + band;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const tiles = svgs.map((svg, i) => {
    const p = `g${i}-`;
    const [x, y] = [(i % cols) * cell, Math.floor(i / cols) * rowH];
    let t = svg
      .replace(/\bid="([^"]+)"/g, `id="${p}$1"`)
      .replace(/url\(#([^)]+)\)/g, `url(#${p}$1)`)
      .replace(/href="#([^"]+)"/g, `href="#${p}$1"`)
      .replace(/^<svg\b/, `<svg x="${x}" y="${y}" width="${cell}" height="${cell}"`);
    if (captions) {
      t += `<text x="${x + cell / 2}" y="${y + cell + band * 0.6}" text-anchor="middle" ` +
        `font-family="DejaVu Serif, Georgia, serif" font-size="${Math.round(band * 0.55)}" ` +
        `fill="rgb(60,52,44)">${esc(captions[i] ?? "")}</text>`;
    }
    return t;
  });
  const rows = Math.ceil(svgs.length / cols);
  const [w, h] = [cols * cell, rows * rowH];
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    (background ? `<rect width="100%" height="100%" fill="${background}"/>` : "") +
    `${tiles.join("")}</svg>`
  );
}

/** Write SVG markup to `out`; a `.png` extension rasterizes it with resvg. */
export async function writeImage(svg, out, { width } = {}) {
  if (out.toLowerCase().endsWith(".png")) {
    const { Resvg } = await import("@resvg/resvg-js");
    const opts = {
      font: { loadSystemFonts: true, fontDirs: ["/usr/share/fonts"], defaultFontFamily: "DejaVu Serif" },
      ...(width ? { fitTo: { mode: "width", value: width } } : {}),
    };
    writeFileSync(out, new Resvg(svg, opts).render().asPng());
  } else {
    writeFileSync(out, svg);
  }
}
