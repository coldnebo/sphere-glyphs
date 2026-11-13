// A point-cloud rendering of a loop glyph, after pictures of atomic orbitals.
//
// Instead of inking a line, the loop becomes a cloud of points scattered around its path in
// three dimensions, the way an orbital is drawn as the places an electron might be. The path is
// the same one the other styles follow (the loop, its corners cut by momentum), but taken in 3D
// before projection, so depth comes through: near points are larger and darker, far ones smaller
// and fainter.
//
// Where the other styles press and swell (slow, tight turns), the cloud spreads out and thins;
// fast straight runs stay tight and dense. Each chord is a lobe, and the colour alternates from
// chord to chord, ink and sienna, as an orbital's lobes alternate in sign.
//
// The number of points and the dot size are fixed in glyph units, so a preview and a large
// print show the same cloud. Paints into { w, h, rgb } like brush.js.
import { DEFAULT_VIEW, rng, seedFrom } from "./brush.js";

const PAPER = [245, 240, 227];
const INK = [23, 20, 15];
const SIENNA = [138, 75, 42];

/** The loop's path in 3D, with corners cut by momentum: [{ p: [x, y, z], spread, chord }]. */
export function path3d(points, loop, { momentum = 1, pressure = 1, steps = 40 } = {}) {
  const n = loop.length, cut = 0.5 * momentum;
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const out = [];
  for (let i = 0; i < n; i++) {
    const A = points[loop[(i + n - 1) % n]], B = points[loop[i]], C = points[loop[(i + 1) % n]];
    const m1 = lerp(B, A, cut), m2 = lerp(B, C, cut);
    const din = B.map((v, j) => v - m1[j]), dout = m2.map((v, j) => v - B[j]);
    const len = (v) => Math.hypot(...v) || 1e-9;
    const turn = din.reduce((s, v, j) => s + v * dout[j], 0) / (len(din) * len(dout));
    const swell = 1 + pressure * (0.55 - 0.85 * turn);
    // the corner: from m1, pulled toward B, to m2; it belongs half to the chord before, half after
    for (let s = 0; s < steps; s++) {
      const t = s / steps, u = 1 - t;
      const p = [0, 1, 2].map((j) => u * u * m1[j] + 2 * u * t * B[j] + t * t * m2[j]);
      const bulge = 1 + (swell - 1) * Math.sin(Math.PI * t);
      out.push({ p, spread: bulge, chord: t < 0.5 ? (i + n - 1) % n : i });
    }
    if (cut < 0.4999) {
      const m1next = lerp(C, B, cut);
      for (let s = 0; s < steps; s++) out.push({ p: lerp(m2, m1next, s / steps), spread: 1, chord: i });
    }
  }
  return out;
}

/** Gaussian random numbers (Box-Muller). */
function gauss(rand) {
  const u = 1 - rand(), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Paint a loop as a cloud. Options: size, view, base (the cloud's thickness, as the weight of
 * the other styles), momentum, pressure, density (how many points, 1 = 30,000), seed.
 */
export function paintCloud(buf, points, loop, opts = {}) {
  const { size = buf.w, view = DEFAULT_VIEW, base = 6.5, density = 1, ground = true } = opts;
  const rand = rng((opts.seed ?? seedFrom(loop)) ^ 0x51ed27);
  const k = size / 400, R = 165 * k, c = size / 2;
  if (ground) {
    for (let i = 0; i < buf.w * buf.h; i++) buf.rgb.set(PAPER, i * 3);
  }
  const line = path3d(points, loop, opts);
  // points are spread along the path by length, not by sample, so short corners don't clump
  const cum = new Float64Array(line.length);
  for (let i = 1; i < line.length; i++) cum[i] = cum[i - 1] + Math.hypot(...line[i].p.map((v, j) => v - line[i - 1].p[j]));
  const length = cum[line.length - 1];
  const at = (d) => {
    let lo = 0, hi = line.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
    return line[lo];
  };
  // the cloud's spread in sphere units: grows with the stroke's weight, but gently
  const sigma = 0.028 * (base / 6.5) ** 0.6;
  const total = Math.round(36000 * density);
  const r = 0.62 * k;
  const project = ([x, y, z]) => {
    const [a, b, d] = view.map((row) => row[0] * x + row[1] * y + row[2] * z);
    return [c + R * a, c - R * b, d];
  };

  // a faint rim: the sphere the loop lives on
  for (let i = 0; i < 720; i++) {
    const t = (i / 720) * Math.PI * 2;
    dot(buf, c + R * Math.cos(t), c + R * Math.sin(t), 0.55 * k, INK, 0.08);
  }
  for (let i = 0; i < total; i++) {
    const s = at(rand() * length);
    // a swollen, pressed turn is a looser cloud (thinner where it spreads, not heavier), within limits
    const swell = Math.min(1.8, Math.max(0.7, 1 + (s.spread - 1) * 0.6));
    const spread = sigma * swell;
    const q = s.p.map((v) => v + gauss(rand) * spread);
    const [x, y, depth] = project(q);
    const near = 0.5 + 0.5 * Math.max(-1, Math.min(1, depth));     // 0 far side .. 1 near side
    const color = s.chord % 2 ? SIENNA : INK;
    dot(buf, x, y, r * (0.65 + 0.7 * near), color, (0.16 + 0.34 * near) / swell);
  }
}

/**
 * A soft dot blended over the buffer. Its anti-aliased edge adds area (about pi/12 px^2), which
 * matters for dots a pixel across: scale the ink so every dot carries ink in proportion to its
 * true size, and small renders match large ones.
 */
function dot(buf, x, y, r, color, alpha) {
  alpha *= (r * r) / (r * r + 1 / 12);
  const x0 = Math.max(0, Math.floor(x - r - 1)), x1 = Math.min(buf.w - 1, Math.ceil(x + r + 1));
  const y0 = Math.max(0, Math.floor(y - r - 1)), y1 = Math.min(buf.h - 1, Math.ceil(y + r + 1));
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const d = Math.hypot(px + 0.5 - x, py + 0.5 - y);
      const a = alpha * Math.min(1, Math.max(0, r + 0.5 - d));
      if (a <= 0) continue;
      const i = (py * buf.w + px) * 3;
      for (let ch = 0; ch < 3; ch++) buf.rgb[i + ch] += (color[ch] - buf.rgb[i + ch]) * a;
    }
  }
}
