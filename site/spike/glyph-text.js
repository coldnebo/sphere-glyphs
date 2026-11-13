// Pure text builders shared by the page and its test: Penrose Substance and Style programs.

// Penrose matches Number variables injectively: repeated values in one statement would
// silently drop it (see src/substance_text.py), so keep every literal distinct.
export function literals(values) {
  const seen = new Set();
  return values
    .map((v) => {
      let s = v.toFixed(6);
      while (seen.has(Number(s))) s = (v += 1e-6).toFixed(6);
      seen.add(Number(s));
      return s;
    })
    .join(", ");
}

/** A closed loop through `points` (array of [x, y, z]) in the order `cycle`. */
export function loopSubstance(points, cycle) {
  const name = (i) => `v${String(i).padStart(2, "0")}`;
  const lines = ["Vertex " + points.map((_, i) => name(i)).join(", "), ""];
  points.forEach((p, i) => lines.push(`At(${name(i)}, ${literals(p)})`));
  lines.push("");
  cycle.forEach((a, i) => lines.push(`Step(${name(a)}, ${name(cycle[(i + 1) % cycle.length])})`));
  return lines.join("\n") + "\n";
}

/** Set brush parameters (base, momentum, pressure) in a style's `-- brush:begin` block. */
export function withBrush(style, params) {
  const [head, block, tail] = style.split(/(?<=-- brush:begin)|(?=  -- brush:end)/);
  if (tail === undefined) throw new Error("style has no brush block");
  let b = block;
  for (const key of ["base", "momentum", "pressure"]) {
    const v = Math.max(0, Number(params[key]));
    if (!Number.isFinite(v)) continue;
    b = b.replace(new RegExp(`^(\\s*${key} = )[0-9.]+`, "m"), `$1${v.toFixed(4)}`);
  }
  return head + b + tail;
}

/** Replace a style's `-- view:begin ... -- view:end` block with an explicit rotation.
 *  `m` is a 4x4 world-to-view matrix in column-major order (three.js Matrix4.elements). */
export function withView(style, m) {
  const num = (v) => (v < 0 ? `0.0 - ${(-v).toFixed(6)}` : v.toFixed(6));
  const r = [[m[0], m[4], m[8]], [m[1], m[5], m[9]], [m[2], m[6], m[10]]];
  const block = ["  -- view:begin (set by the page)"];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) block.push(`  r${i}${j} = ${num(r[i][j])}`);
  block.push("  -- view:end");
  const out = style.replace(/ *-- view:begin[\s\S]*?-- view:end/, block.join("\n"));
  if (out === style) throw new Error("style has no view block");
  return out;
}

// ---------------------------------------------------------------- loop codes
//
// A closed loop through the 13 points has no start and no direction. Its code fixes both:
// start at point 0, go in the direction whose next point is smaller, and write the other
// 12 points in base 13 (0-9, a-c). 12!/2 ~ 240 million loops, each with exactly one code.
// The *canonical* code is the smallest code over the configuration's 8 symmetries: the
// same glyph however it is turned, about 30 million in all.

const DIGITS = "0123456789abc";

/** Visit every k-th point of loop L (the star polygon rule). */
export function star(L, k) {
  return L.map((_, i) => L[(k * i) % L.length]);
}

/** Rotate to start at 0 and pick the direction with the smaller second point. */
export function normalizeLoop(c) {
  const i = c.indexOf(0);
  const r = [...c.slice(i), ...c.slice(0, i)];
  const back = [r[0], ...r.slice(1).reverse()];
  return r[1] <= back[1] ? r : back;
}

export function encodeLoop(c) {
  return normalizeLoop(c).slice(1).map((v) => DIGITS[v]).join("");
}

/** A 12-character loop code back into a loop, or null if it isn't a valid code. */
export function decodeLoop(code) {
  if (typeof code !== "string" || !/^[0-9a-c]{12}$/.test(code)) return null;
  const c = [0, ...[...code].map((ch) => DIGITS.indexOf(ch))];
  return new Set(c).size === 13 ? c : null;
}

/** Smallest code over all symmetry images: equal for the same glyph however it's turned. */
export function canonicalCode(c, symmetries) {
  let best = null;
  for (const s of symmetries) {
    const code = encodeLoop(c.map((v) => s[v]));
    if (best === null || code < best) best = code;
  }
  return best;
}

/** Names for the family glyphs: canonical code -> "A1" ... "C6". */
export function familyNames(loops, symmetries) {
  const names = new Map();
  for (const [r, L] of Object.entries(loops)) {
    for (let k = 1; k <= 6; k++) names.set(canonicalCode(star(L, k), symmetries), `${r}${k}`);
  }
  return names;
}

/** A uniformly random loop through n points. `rand` returns floats in [0, 1). */
export function randomLoop(n, rand = Math.random) {
  const c = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

/** One small step: reverse a stretch of the loop, which replaces exactly two of its chords. */
export function mutateLoop(c, rand = Math.random) {
  const n = c.length;
  const i = Math.floor(rand() * n);
  const len = 2 + Math.floor(rand() * (n - 3));        // 2 .. n-2 points reversed
  const out = [...c];
  for (let a = 0; a < Math.floor(len / 2); a++) {
    const x = (i + a) % n, y = (i + len - 1 - a) % n;
    [out[x], out[y]] = [out[y], out[x]];
  }
  return out;
}
