// An ink-brush rendering of a loop glyph, after East Asian brush calligraphy.
//
// The brush follows the same path the glass style inks: the projected loop, its corners cut by
// momentum. That stroke's width becomes the brush's story. Where the glass stroke is thin the
// brush is moving fast: it lays down less ink, and a drying brush breaks into streaks of
// "flying white" (feibai). Where the stroke swells the brush has slowed and pressed: ink pools.
// A sudden slowdown after a fast run throws droplets onward, in the direction of travel.
//
// Bristles each carry their own ink, so the stroke dries as it goes. The brush lands with a
// press, travels the whole loop and lifts with a flick just before closing it, leaving a small
// gap like an enso. Depth on the sphere becomes ink tone: near strokes dense, far strokes pale,
// diluted ink. Ink only ever darkens what is under it.
//
// It paints into { w, h, rgb } (a Float32Array of 0..255 RGB), so the same code runs in the
// browser (into ImageData) and in Node (into site/raster.mjs). Randomness is seeded, so a loop
// always splashes the same way.

const PAPER = [245, 240, 227];

/** Named brushes: settings for paintGlyph, from clean painted lines to a gritty big brush. */
export const BRUSHES = {
  wet: { ink: 1.5, dryness: 0.3, splatter: 0.5, grit: 0, pressure: 1.4 },
  fluent: { ink: 1, dryness: 1, splatter: 1, grit: 0 },
  dry: { ink: 0.75, dryness: 2.2, splatter: 2, grit: 0, base: 8 },
  big: { ink: 0.8, dryness: 1.8, splatter: 2.6, grit: 1, base: 14, pressure: 1.4 },
  formal: { ink: 1, dryness: 0.6, splatter: 0.2, grit: 0, momentum: 0.25, pressure: 0.3 },
};
const INK = [18, 16, 13];
const LIGHT_INK = [120, 116, 110];      // diluted ink, for the far side of the sphere

/** glass.style's default view (rows): the symmetry axis tilted 0.52 rad toward the viewer. */
export const DEFAULT_VIEW = (() => {
  const c = Math.cos(0.52), s = Math.sin(0.52);
  return [[1, 0, 0], [0, c, -s], [0, s, c]];
})();

/** A small seeded random generator (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const seedFrom = (loop) => loop.reduce((h, v) => (Math.imul(h, 31) + v + 7) | 0, 0x9e3779b9);

/**
 * The stroke's centreline, sampled about once per pixel: position, depth, half-width (as the
 * glass style would ink it) and how sharply it turns. Same projection, corners and pressure
 * model as glass.style and sketch.js.
 */
export function centreline(points, loop, { size, view = DEFAULT_VIEW, base = 6.5, momentum = 1, pressure = 1 }) {
  const k = size / 400, R = 165 * k, c = size / 2;
  const n = loop.length, cut = 0.5 * momentum;
  const P = points.map(([x, y, z]) => {
    const [a, b, d] = view.map((r) => r[0] * x + r[1] * y + r[2] * z);
    return [c + R * a, c - R * b, d];
  });
  const lerp = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  const halfWidth = (za, zb) => (base / 2) * k * (0.72 + 0.28 * (za + zb) / 2);
  const out = [];
  const push = (p, w, turn) => out.push({ x: p[0], y: p[1], z: p[2], w, turn });

  for (let i = 0; i < n; i++) {
    const A = P[loop[(i + n - 1) % n]], B = P[loop[i]], C = P[loop[(i + 1) % n]];
    const m1 = lerp(B, A, cut), m2 = lerp(B, C, cut);
    const din = [B[0] - m1[0], B[1] - m1[1]], dout = [m2[0] - B[0], m2[1] - B[1]];
    const ln = (v) => Math.hypot(v[0], v[1]) || 1e-9;
    const turn = (din[0] * dout[0] + din[1] * dout[1]) / (ln(din) * ln(dout));   // 1 straight, -1 hairpin
    const hin = halfWidth(A[2], B[2]), hout = halfWidth(B[2], C[2]);
    const hw = ((hin + hout) / 2) * (1 + pressure * (0.55 - 0.85 * turn));
    const W = 2 * hw - (hin + hout) / 2;            // so the width at the corner's middle is hw
    // the corner: a quadratic from m1 through the pull of B to m2
    const len = ln(din) + ln(dout);
    const steps = Math.max(4, Math.ceil(len));
    for (let s = 0; s < steps; s++) {
      const t = s / steps, u = 1 - t;
      const p = [0, 1, 2].map((j) => u * u * m1[j] + 2 * u * t * B[j] + t * t * m2[j]);
      push(p, u * u * hin + 2 * u * t * W + t * t * hout, turn);
    }
    // the straight run to the next corner, when momentum leaves one
    if (cut < 0.4999) {
      const m1next = lerp(C, B, cut);
      const runLen = Math.hypot(m1next[0] - m2[0], m1next[1] - m2[1]);
      const rs = Math.max(1, Math.ceil(runLen));
      for (let s = 0; s < rs; s++) push(lerp(m2, m1next, s / rs), hout, 1);
    }
  }
  return out;
}

/**
 * Ink into the stroke's layer. Each pixel keeps the darkest ink that reached it (per channel,
 * as absorption): overlapping bristle dabs within one stroke don't stack up to black, so pale
 * diluted ink stays pale. The layer is laid onto the paper at the end.
 */
function stamp(buf, x, y, r, color, a, tooth = 0) {
  if (a <= 0.003) return;
  const x0 = Math.max(0, Math.floor(x - r - 1)), x1 = Math.min(buf.w - 1, Math.ceil(x + r + 1));
  const y0 = Math.max(0, Math.floor(y - r - 1)), y1 = Math.min(buf.h - 1, Math.ceil(y + r + 1));
  const ab = buf.ab, field = buf.tooth;
  for (let py = y0; py <= y1; py++) {
    const dy = py + 0.5 - y;
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - x;
      let cover = Math.min(1, Math.max(0, r + 0.5 - Math.sqrt(dx * dx + dy * dy)));
      if (cover <= 0) continue;
      // a dry brush only catches the raised fibres of the paper
      if (tooth > 0 && field) {
        cover *= Math.min(1, Math.max(0, (field[py * buf.w + px] - tooth) * 5 + 0.5));
        if (cover <= 0) continue;
      }
      const f = a * cover, i = (py * buf.w + px) * 3;
      for (let c = 0; c < 3; c++) {
        const absorb = f * (1 - color[c] / 255);
        if (absorb > ab[i + c]) ab[i + c] = absorb;
      }
    }
  }
}

/** Fill the buffer with paper, with a faint fibre grain. */
export function paper(buf, rand) {
  for (let i = 0; i < buf.w * buf.h; i++) {
    const g = (rand() - 0.5) * 5;
    buf.rgb[i * 3] = PAPER[0] + g;
    buf.rgb[i * 3 + 1] = PAPER[1] + g;
    buf.rgb[i * 3 + 2] = PAPER[2] + g * 0.9;
  }
}

/**
 * The paper's tooth: a texture of raised fibres (fine grain over coarser blotches, 0..1) that a
 * dry brush catches on. Only built when grit asks for it.
 */
function toothField(w, h, k, rand) {
  const field = new Float32Array(w * h);
  const cell = Math.max(3, Math.round(7 * k));
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
  const coarse = Float32Array.from({ length: gw * gh }, rand);
  for (let y = 0; y < h; y++) {
    const gy = y / cell, iy = Math.floor(gy), fy = gy - iy;
    for (let x = 0; x < w; x++) {
      const gx = x / cell, ix = Math.floor(gx), fx = gx - ix;
      const a = coarse[iy * gw + ix], b = coarse[iy * gw + ix + 1];
      const c = coarse[(iy + 1) * gw + ix], d = coarse[(iy + 1) * gw + ix + 1];
      const smooth = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
      field[y * w + x] = 0.55 * smooth + 0.45 * rand();
    }
  }
  return field;
}

/**
 * Paint a loop with the brush. Options: size (px of the buffer), view, base/momentum/pressure
 * (as for the glass style), ink (how much the brush carries), dryness (how readily it breaks
 * into flying white), splatter (how freely it throws droplets), grit (0 = a fine brush; toward
 * 1 = a big, coarse brush whose hairs clump and whose dry ink catches the paper's grain),
 * bristles, seed.
 */
export function paintGlyph(buf, points, loop, opts = {}) {
  const {
    size = buf.w, ink = 1, dryness = 1, splatter = 1, grit = 0, ground = true,
  } = opts;
  const bristles = opts.bristles ?? Math.round(26 - 10 * Math.min(1, grit));
  const rand = rng(opts.seed ?? seedFrom(loop));
  if (ground) paper(buf, rand);
  const layer = { w: buf.w, h: buf.h, ab: new Float32Array(buf.w * buf.h * 3) };
  if (grit > 0) layer.tooth = toothField(buf.w, buf.h, size / 400, rand);
  const line = centreline(points, loop, { ...opts, size });
  const N = line.length;
  // start the stroke at the first vertex, and lift a little before closing the loop (an enso)
  const start = 0, stop = Math.floor(N * 0.955);
  const k = size / 400;

  // each bristle: where it sits across the brush, how much ink it holds, how fast it gives it up
  // With grit, hairs stick together in clumps that share a position and a rhythm of skipping,
  // so a coarse brush splits into a few broad ribbons with gaps between them.
  const clumps = Math.max(3, Math.round(bristles / (1 + 4 * Math.min(1, grit))));
  const clumpCentre = Array.from({ length: clumps }, (_, c) => ((c + 0.5) / clumps) * 2 - 1 + (rand() - 0.5) * 0.25 / clumps);
  const clumpGrain = Array.from({ length: clumps }, () => rand() * 1000);
  const hairs = Array.from({ length: bristles }, (_, j) => {
    const even = ((j + 0.5) / bristles) * 2 - 1 + (rand() - 0.5) * (1.4 / bristles);
    const c = Math.min(clumps - 1, Math.floor(((even + 1) / 2) * clumps));
    const g = Math.min(1, grit);
    return {
      o: even,
      pull: (clumpCentre[c] - even) * 0.5 * g,
      wobble: rand() * 1000,
      load: (1 + 0.3 * rand()) * ink,
      rate: 0.6 + 0.8 * rand(),
      grain: rand() * 1000 * (1 - g) + clumpGrain[c] * g,
      freq: 0.012 + 0.03 * rand(),
    };
  });

  // typical half-width, to read width as speed
  const mean = line.reduce((s, p) => s + p.w, 0) / N;
  let prevSpeed = 1;
  const front = (z) => Math.min(1, Math.max(0, (z + 0.18) / 0.36));

  for (let s = start; s < stop; s++) {
    const p = line[s], q = line[Math.min(N - 1, s + 1)];
    const tx0 = q.x - p.x, ty0 = q.y - p.y, tl = Math.hypot(tx0, ty0) || 1;
    const tx = tx0 / tl, ty = ty0 / tl, nx = -ty, ny = tx;
    const progress = (s - start) / (stop - start);

    // width as a proxy for speed: thin = fast, swollen = slow and pressed
    const speed = Math.min(2.2, Math.max(0.35, mean / Math.max(0.3 * mean, p.w)));
    // the press as the brush lands, and the taper as it lifts
    const land = Math.min(1, progress / 0.025), lift = Math.min(1, (1 - progress) / 0.08);
    const press = (0.75 + 0.5 * (1 / speed)) * (0.55 + 0.45 * land);
    const hw = p.w * Math.max(0.12, lift) * (0.92 + 0.18 * press);
    const tone = front(p.z);
    const color = tone >= 1 ? INK : tone <= 0 ? LIGHT_INK : INK.map((v, i) => v * tone + LIGHT_INK[i] * (1 - tone));
    // ink pools where the brush slows and presses
    const opacity = (0.5 + 0.45 * tone) * (speed < 0.85 ? 1.18 : 1);

    for (const h of hairs) {
      // bristles spread when the brush presses, and wobble a little
      const spread = 0.78 + 0.32 * Math.min(1.4, press);
      const dryNow = 1 - Math.min(1, h.load / 0.3);
      const jitter = (Math.sin(s * 0.05 + h.wobble) + 0.5 * Math.sin(s * 0.13 + h.wobble * 1.7)) * (0.2 + 0.5 * grit) * k;
      const off = (h.o + h.pull * (0.35 + 0.65 * dryNow)) * hw * spread + jitter;
      const x = p.x + nx * off, y = p.y + ny * off;
      // ink given up here, as a share of the whole stroke: more when slow, less when fast,
      // so a full brush lasts the loop and dries visibly only on fast runs and toward the end
      const flow = (1.05 / (stop - start)) * h.rate * (1 / speed) * (1 + 0.6 * (1 - lift));
      const wet = Math.min(1, h.load / 0.3);
      // flying white: on fast runs, and more as the brush dries, bristles lift off the paper.
      // Each bristle's own slowly varying grain decides where, so the gaps run along the stroke
      // as streaks rather than speckle.
      const fast = Math.min(1, Math.max(0, (speed - 0.92) / 0.55));
      const skip = dryness * (fast * (0.45 + 0.55 * (1 - wet)) + 0.6 * (1 - wet) ** 2);
      const grain = 0.5 + 0.35 * Math.sin(s * h.freq + h.grain) + 0.15 * Math.sin(s * h.freq * 3.7 + h.grain * 2.3);
      if (grain < skip) continue;
      const r = Math.max(0.55 * k, (hw / bristles) * (1.9 + 0.8 * grit));
      // how dry this bristle is at this moment decides how much of the paper's grain it misses
      const tooth = grit * Math.min(0.9, 0.22 + 0.5 * (1 - wet) + 0.45 * fast);
      stamp(layer, x, y, r, color, Math.min(1, opacity * (0.3 + 0.7 * wet)), tooth);
      h.load = Math.max(0, h.load - flow);
    }

    // a sudden slowdown after a fast run throws ink onward, in the direction of travel
    const slowing = prevSpeed - speed;
    if (splatter > 0 && slowing > 0.006 && prevSpeed > 1.05 && p.turn < 0.2) {
      const chance = Math.min(1, slowing * 12 * splatter * (0.4 + 0.6 * tone));
      if (rand() < chance) throwDroplets(layer, rand, p, tx, ty, hw, k, color, 1 + Math.floor(rand() * 3 * splatter));
    }
    prevSpeed = speed;
  }

  // the press where the brush lands: a pooled, slightly bleeding dot
  const first = line[start];
  for (let i = 0; i < 18; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * first.w * 1.1;
    stamp(layer, first.x + Math.cos(a) * d, first.y + Math.sin(a) * d, first.w * (0.45 + 0.3 * rand()), INK, 0.92);
  }
  // the flick as the brush lifts: a spray along the direction it was going
  const end = line[stop - 1], before = line[Math.max(0, stop - 6)];
  const ex = end.x - before.x, ey = end.y - before.y, el = Math.hypot(ex, ey) || 1;
  throwDroplets(layer, rand, end, ex / el, ey / el, end.w, k, front(end.z) > 0.5 ? INK : LIGHT_INK, Math.round(4 + 6 * splatter));

  // lay the ink onto the paper
  for (let i = 0; i < layer.ab.length; i++) buf.rgb[i] *= 1 - layer.ab[i];
}

/** Droplets thrown forward from p: a few round ones, some drawn out by their speed. */
function throwDroplets(buf, rand, p, tx, ty, hw, k, color, count) {
  for (let i = 0; i < count; i++) {
    const dist = hw * (1.2 + rand() * 5) + rand() * 10 * k;
    const side = (rand() - 0.5) * hw * 2.4;
    const x = p.x + tx * dist - ty * side, y = p.y + ty * dist + tx * side;
    const r = Math.max(0.5 * k, Math.min((1.2 + 3.5 * rand() * rand()) * k, (0.25 + rand() * rand() * 1.2) * hw * 0.6));
    const streak = rand() < 0.4 ? 2 + Math.floor(rand() * 4) : 1;
    for (let j = 0; j < streak; j++) stamp(buf, x - tx * j * r * 0.9, y - ty * j * r * 0.9, r * (1 - j / (streak + 1)), color, 0.8);
  }
}
