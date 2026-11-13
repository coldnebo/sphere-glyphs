// Shared helpers: compile + optimize a Penrose trio headlessly (Node + jsdom).
import { readFileSync, writeFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const { window } = new JSDOM("<!DOCTYPE html><body></body>");
globalThis.window = window;
globalThis.document = window.document;
globalThis.XMLSerializer = window.XMLSerializer;

const { compile, optimize, toSVG, showError } = await import("@penrose/core");

const read = (p) => readFileSync(p, "utf8");

/** Render one Domain/Substance/Style trio (file paths) and return the SVG markup. */
export async function renderSVG({ domain, substance, style, variation = "tammes" }) {
  const compiled = await compile({
    domain: read(domain),
    substance: read(substance),
    style: read(style),
    variation,
    excludeWarnings: [],
  });
  if (compiled.isErr()) throw new Error(`compile ${substance}: ${showError(compiled.error)}`);
  for (const w of compiled.value.warnings ?? []) console.error("warning:", showError(w));

  const optimized = optimize(compiled.value);
  if (optimized.isErr()) throw new Error(`optimize ${substance}: ${showError(optimized.error)}`);

  const svg = await toSVG(optimized.value, async () => undefined, variation);
  return svg.outerHTML;
}

/** Write SVG markup to `out`; a `.png` extension rasterizes it with resvg. */
export async function writeImage(svg, out, { width } = {}) {
  if (out.toLowerCase().endsWith(".png")) {
    const { Resvg } = await import("@resvg/resvg-js");
    const opts = width ? { fitTo: { mode: "width", value: width } } : {};
    writeFileSync(out, new Resvg(svg, opts).render().asPng());
  } else {
    writeFileSync(out, svg);
  }
}
