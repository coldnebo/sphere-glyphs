// Figures for the site, rendered at build time. Each returns SVG markup.
// Glyphs come from Penrose (glass style); circle diagrams and the sphere are plain SVG, so the
// page can animate their strokes.
import { readFileSync } from "node:fs";
import { composeSheet, renderText } from "../src/penrose.mjs";
import {
  loopSubstance, withView, withBrush, star, decodeLoop, mutateLoop,
} from "./lib/glyph-text.js";
import { Library } from "./lib/library.js";

const DOMAIN = readFileSync("penrose/tammes-glyph.domain", "utf8");
const GLASS = readFileSync("penrose/styles/glass.style", "utf8");
export const data = JSON.parse(readFileSync("site/spike/data.json", "utf8"));
const N = data.points.length;

const PAPER = "#f5f0e3";
const INK = "#17140f";
const WASH = "#9aa3b4";
const FAINT = "#cfc6b3";

// ---------------------------------------------------------------- helpers

/** Seeded random numbers, so every build draws the same figures. */
function rng(seed) {
  let s = seed % 2147483647;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Column-major world->view matrix: tilt about x (glass.style's convention). */
function tiltMatrix(t) {
  const c = Math.cos(t), s = Math.sin(t);
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
}
const POLE_VIEW = tiltMatrix(0);

export async function glyph(cycle, { view = null, brush = null } = {}) {
  let style = GLASS;
  if (view) style = withView(style, view);
  if (brush) style = withBrush(style, brush);
  return renderText({ domain: DOMAIN, substance: loopSubstance(data.points, cycle), style, label: "figure" });
}

const sheet = async (cycles, opts, glyphOpts = {}) =>
  composeSheet(await Promise.all(cycles.map((c) => glyph(c, glyphOpts))), { background: null, ...opts });

const f = (v) => +v.toFixed(2);

// ---------------------------------------------------------------- figures

/** Cover: one family glyph, large. */
export async function cover() {
  return glyph(star(data.loops.C, 4), { brush: { base: 7.5, momentum: 1, pressure: 1.2 } });
}

/** Thirteen points on a circle and the six star polygons {13/k}; strokes animate on the page. */
export function dancers() {
  const cell = 260, r = 104, cols = 3;
  const pt = (i, cx, cy) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / 13;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  let out = "";
  for (let k = 1; k <= 6; k++) {
    const cx = ((k - 1) % cols) * cell + cell / 2;
    const cy = Math.floor((k - 1) / cols) * (cell + 24) + cell / 2;
    const order = Array.from({ length: 13 }, (_, i) => (k * i) % 13);
    const d = order.map((i, j) => `${j ? "L" : "M"}${pt(i, cx, cy).map(f).join(" ")}`).join("") + "Z";
    out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${FAINT}" stroke-width="1"/>`;
    out += `<path class="draw" style="--i:${k - 1}" d="${d}" pathLength="1" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`;
    for (let i = 0; i < 13; i++) {
      const [x, y] = pt(i, cx, cy);
      out += `<circle cx="${f(x)}" cy="${f(y)}" r="${i === 0 ? 5 : 3.6}" fill="${i === 0 ? INK : PAPER}" stroke="${INK}" stroke-width="1.4"/>`;
    }
    out += `<text x="${cx}" y="${cy + r + 34}" text-anchor="middle" class="label">{13/${k}}</text>`;
  }
  const w = cols * cell, h = 2 * (cell + 24);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="The six star polygons through 13 points on a circle">${out}</svg>`;
}

/** The 13 Tammes points and their 24 contacts, from the side and from the pole. */
export function sphere() {
  const P = data.points;
  const cell = 400, R = 165;
  const views = [0.52, 0.0];
  let out = "";
  views.forEach((tilt, v) => {
    const ox = v * (cell + 40) + cell / 2, oy = cell / 2;
    const c = Math.cos(tilt), s = Math.sin(tilt);
    const rot = ([x, y, z]) => [x, y * c - z * s, y * s + z * c];
    const scr = ([x, y]) => [ox + R * x, oy - R * y];
    const back = [], front = [];
    for (const [a, b] of data.edges) {
      const pa = P[a], pb = P[b];
      const seg = Array.from({ length: 25 }, (_, i) => {
        const t = i / 24;
        const p = pa.map((u, j) => u * (1 - t) + pb[j] * t);
        const n = Math.hypot(...p);
        return rot(p.map((u) => u / n));
      });
      for (let i = 0; i < 24; i++) {
        const z = (seg[i][2] + seg[i + 1][2]) / 2;
        const [x1, y1] = scr(seg[i]), [x2, y2] = scr(seg[i + 1]);
        const line = `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${z >= 0 ? INK : WASH}" stroke-opacity="${f(z >= 0 ? 0.35 + 0.5 * z : 0.55)}" stroke-width="${f(z >= 0 ? 1.4 + z : 1.1)}" stroke-linecap="round"/>`;
        (z >= 0 ? front : back).push(line);
      }
    }
    out += `<g>${back.join("")}`;
    out += `<circle cx="${ox}" cy="${oy}" r="${R}" fill="${PAPER}" fill-opacity="0.55" stroke="${WASH}" stroke-opacity="0.6" stroke-width="1.2"/>`;
    out += front.join("");
    const dots = P.map((p, i) => [rot(p), i]).sort((m, n) => m[0][2] - n[0][2]);
    for (const [p] of dots) {
      const [x, y] = scr(p);
      out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(3.2 + 2.2 * Math.max(0, p[2]))}" fill="${p[2] >= 0 ? INK : WASH}"/>`;
    }
    out += `<text x="${ox}" y="${cell + 18}" text-anchor="middle" class="label">${v ? "from the top point" : "from the side"}</text></g>`;
  });
  const w = 2 * cell + 40, h = cell + 30;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Thirteen points on a sphere, joined to their nearest neighbours">${out}</svg>`;
}

/** One loop on a 13-bead bracelet, turned and flipped: three ways of writing the same loop. */
export function bracelet() {
  const loop = decodeLoop("72b491c53a68");
  const cell = 300, r = 112;
  const panels = [
    ["as written", (i) => i],
    ["turned", (i) => (i + 3) % 13],
    ["flipped", (i) => (13 - i) % 13],
  ];
  let out = "";
  panels.forEach(([label, place], p) => {
    const cx = p * cell + cell / 2, cy = cell / 2;
    const pt = (i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * place(i)) / 13;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };
    const d = loop.map((i, j) => `${j ? "L" : "M"}${pt(i).map(f).join(" ")}`).join("") + "Z";
    out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${FAINT}"/>`;
    out += `<path class="draw" style="--i:${p}" d="${d}" pathLength="1" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`;
    for (let i = 0; i < 13; i++) {
      const [x, y] = pt(i);
      out += `<circle cx="${f(x)}" cy="${f(y)}" r="9" fill="${PAPER}" stroke="${INK}" stroke-width="1.3"/>`;
      out += `<text x="${f(x)}" y="${f(y + 3.6)}" text-anchor="middle" class="bead">${i}</text>`;
    }
    out += `<text x="${cx}" y="${cell + 4}" text-anchor="middle" class="label">${label}</text>`;
  });
  const w = 3 * cell, h = cell + 14;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="One loop of 13 numbered beads, as written, turned and flipped">${out}</svg>`;
}

/** One glyph carried by each of the 8 symmetries, seen from the top point: there the 8 moves
 *  are plain quarter-turns and mirror images of one picture. */
export async function orientations() {
  const g = star(data.loops.B, 3);
  const P = data.points;
  const det = (a, b, c) =>
    a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  // three points spanning space, and one off the axis to measure each move's angle by
  const [i, j, k] = [0, 1, 2];
  const ref = P.findIndex((p) => Math.abs(p[2]) < 0.9);
  const azim = (p) => Math.atan2(p[1], p[0]);
  const keyed = data.symmetries.map((s) => {
    const mirror = Math.sign(det(P[s[i]], P[s[j]], P[s[k]])) !== Math.sign(det(P[i], P[j], P[k]));
    const turn = (azim(P[s[ref]]) - azim(P[ref]) + 4 * Math.PI) % (2 * Math.PI);
    return { s, order: (mirror ? 10 : 0) + turn };
  });
  keyed.sort((a, b) => a.order - b.order);   // top row: the four turns; bottom row: the four mirrors
  return sheet(keyed.map(({ s }) => g.map((v) => s[v])), { cols: 4, cell: 300 }, { view: POLE_VIEW });
}

/** A loop the half-turn maps onto itself, seen from the top point, where the symmetry shows. */
export async function symmetric() {
  const half = data.symmetries.find(
    (s) => s.filter((v, i) => v === i).length === 1 && s.every((v, i) => s[v] === i),
  );
  const pole = half.findIndex((v, i) => v === i);
  const pairs = [];
  for (let i = 0; i < N; i++) if (i !== pole && i < half[i]) pairs.push([i, half[i]]);
  const rand = rng(1859);
  for (let i = pairs.length - 1; i > 0; i--) {           // shuffle the pairs, pick a side of each
    const j = Math.floor(rand() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  const xs = pairs.map(([a, b]) => (rand() < 0.5 ? a : b));
  const loop = [pole, ...xs, ...xs.map((x) => half[x]).reverse()];
  return glyph(loop, { view: POLE_VIEW, brush: { base: 6, momentum: 0.85, pressure: 1 } });
}

/** The three road trips: loops along the contact edges only. */
export async function roadtrips() {
  return sheet(["A", "B", "C"].map((r) => data.loops[r]), { cols: 3, cell: 340, captions: ["A", "B", "C"] });
}

/** The 18 families: three road trips, each stepped by k = 1..6. */
export async function families() {
  const cycles = [], names = [];
  for (const r of ["A", "B", "C"]) {
    for (let k = 1; k <= 6; k++) {
      cycles.push(star(data.loops[r], k));
      names.push(`${r}${k}`);
    }
  }
  return sheet(cycles, { cols: 6, cell: 220, captions: names });
}

/** A walk: start from A3 and reverse one stretch at a time. */
export async function wandering() {
  const rand = rng(2025);
  const steps = [star(data.loops.A, 3)];
  while (steps.length < 10) steps.push(mutateLoop(steps.at(-1), rand));
  return sheet(steps, { cols: 5, cell: 240, captions: steps.map((_, i) => (i ? `step ${i}` : "A3")) });
}

/** The colophon: one loop (B3), inked three ways. */
export async function tools() {
  const g = star(data.loops.B, 3);
  const brushes = [
    { base: 5, momentum: 0.15, pressure: 0.4 },
    { base: 6.5, momentum: 1, pressure: 1 },
    { base: 11, momentum: 1, pressure: 2.2 },
  ];
  const svgs = await Promise.all(brushes.map((brush) => glyph(g, { brush })));
  return composeSheet(svgs, { cols: 3, cell: 340, background: null, captions: ["formal", "as drawn", "heavy"] });
}

/** For the explorer section: a glyph from the gallery. */
export async function explore() {
  return glyph(decodeLoop("72b491c53a68"), { brush: { base: 6.5, momentum: 0.6, pressure: 1 } });
}

// ---------------------------------------------------------------- social preview cards

/**
 * A 1200 x 630 link-preview card: one glyph large in the middle, two smaller either side.
 * No text: the platforms print the page title and description next to it, and the build
 * machine may not have the fonts.
 */
async function card(centre, left, right) {
  const [W, H] = [1200, 630];
  const place = (svg, size, cx) =>
    svg.replace(/^<svg\b/, `<svg x="${cx - size / 2}" y="${(H - size) / 2}" width="${size}" height="${size}"`);
  const [c, l, r] = await Promise.all([centre, left, right]);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="100%" height="100%" fill="${PAPER}"/>` +
    // each render brings its own square of paper, so the squares must not overlap
    place(l, 320, 180) + place(r, 320, W - 180) + place(c, 520, W / 2) + `</svg>`;
}

export const CARDS = {
  home: () => card(cover(), explore(), symmetric()),
  loops: () => card(
    glyph(star(data.loops.C, 4), { brush: { base: 7.5, momentum: 1, pressure: 1.2 } }),
    glyph(star(data.loops.A, 2)),
    glyph(star(data.loops.B, 5)),
  ),
  explorer: () => card(
    glyph(star(data.loops.B, 2), { brush: { base: 6, momentum: 0.15, pressure: 0.6 } }),
    glyph(decodeLoop("72b491c53a68"), { brush: { base: 6.5, momentum: 0.6, pressure: 1 } }),
    glyph(star(data.loops.C, 4), { brush: { base: 11, momentum: 1, pressure: 2.2 } }),
  ),
  colophon: () => card(
    glyph(star(data.loops.B, 3)),
    glyph(star(data.loops.B, 3), { brush: { base: 5, momentum: 0.15, pressure: 0.4 } }),
    glyph(star(data.loops.B, 3), { brush: { base: 11, momentum: 1, pressure: 2.2 } }),
  ),
  // one loop from formal to free, the range of the calligraphy in the article
  inspirations: () => card(
    glyph(star(data.loops.A, 3), { brush: { base: 5, momentum: 0.15, pressure: 0.4 } }),
    glyph(star(data.loops.A, 3), { brush: { base: 11, momentum: 1, pressure: 2.2 } }),
    glyph(star(data.loops.A, 3)),
  ),
  // the first three glyphs on the Library wall, in ink
  library: () => {
    const lib = libraryIndex();
    return card(glyph(lib.glyph(0).loop), glyph(lib.glyph(1).loop), glyph(lib.glyph(2).loop));
  },
};

function libraryIndex() {
  const counts = new Uint16Array(readFileSync("site/library/index.bin").buffer.slice(0));
  return new Library(counts, data.symmetries);
}

/** The home page's door to the Library: the wall's first four glyphs, 2 x 2. */
export async function libraryDoor() {
  const lib = libraryIndex();
  return sheet([0, 1, 2, 3].map((n) => lib.glyph(n).loop), { cols: 2, cell: 300 });
}

export const FIGURES = {
  cover, dancers, sphere, bracelet, orientations, symmetric, roadtrips, families, wandering, explore, tools,
};
