// A soap film on the loop: the least-area surface spanning a glyph's loop, like a soap film on a
// wire.
//
// Plateau's problem asks for the least-area surface with a given boundary; Douglas and Rado
// showed (1930-31) that every closed curve bounds such a disc, though for a tangled curve it may
// pass through itself. Here a disc of nearly equilateral triangles has its rim pinned to the
// loop's 3D path. It is first relaxed to a harmonic disc, then flowed toward least area by the
// iteration of Pinkall and Polthier (1993): repeatedly re-balance each point against its
// neighbours, weighted by the cotangents of the angles opposite each edge in the current shape.
//
// Each of the 13 chords claims a wedge of the disc, coloured in turn after Andrew Hanson's patch
// colouring of Calabi-Yau cross-sections. The film is smoothly shaded (lighting at each mesh
// point, blended across the triangles) and depth tested; the loop is drawn as an ink wire along
// its edge, faint where the film hides it. Paints into { w, h, rgb }.
import { DEFAULT_VIEW } from "./brush.js";
import { path3d } from "./cloud.js";

const PAPER = [245, 240, 227];
const INK = [23, 20, 15];
const PALETTE = [[138, 75, 42], [92, 104, 128], [176, 138, 92], [60, 66, 74], [150, 112, 98], [118, 128, 112]];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** Resample the loop's 3D path to m points evenly spaced by length, keeping each one's chord. */
function boundary(points, loop, m, opts) {
  const line = path3d(points, loop, opts);
  const cum = [0];
  for (let i = 1; i <= line.length; i++) {
    const a = line[i - 1].p, b = line[i % line.length].p;
    cum.push(cum[i - 1] + Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
  }
  const total = cum[line.length], out = [];
  let j = 0;
  for (let i = 0; i < m; i++) {
    const d = (i / m) * total;
    while (cum[j + 1] < d) j++;
    const t = (d - cum[j]) / (cum[j + 1] - cum[j] || 1);
    const a = line[j].p, b = line[(j + 1) % line.length].p;
    out.push({ p: a.map((v, k) => v + (b[k] - v) * t), chord: line[j].chord });
  }
  return out;
}

/**
 * A disc of rings 0..R; ring j has about m * j / R points, so triangles stay nearly equilateral.
 * Neighbouring rings are zipped together by angle. Returns vertices (with their ring and angle,
 * as a fraction of a turn), triangles, and which vertices are on the rim.
 */
function disc(R, m) {
  const verts = [{ j: 0, a: 0 }], rings = [[0]];
  for (let j = 1; j <= R; j++) {
    const n = j === R ? m : Math.max(6, Math.round((m * j) / R));
    const ring = [];
    for (let i = 0; i < n; i++) {
      ring.push(verts.length);
      verts.push({ j, a: i / n });
    }
    rings.push(ring);
  }
  const tris = [];
  for (const [i, v] of rings[1].entries()) tris.push([0, v, rings[1][(i + 1) % rings[1].length]]);
  for (let j = 1; j < R; j++) {
    const inner = rings[j], outer = rings[j + 1];
    let p = 0, q = 0;
    while (p < inner.length || q < outer.length) {
      const nextInner = (p + 1) / inner.length, nextOuter = (q + 1) / outer.length;
      if (q >= outer.length || (p < inner.length && nextInner < nextOuter)) {
        tris.push([inner[p % inner.length], outer[q % outer.length], inner[(p + 1) % inner.length]]);
        p++;
      } else {
        tris.push([inner[p % inner.length], outer[q % outer.length], outer[(q + 1) % outer.length]]);
        q++;
      }
    }
  }
  return { verts, tris, rim: rings[R] };
}

/**
 * The film: { pos (x, y, z per vertex), tris, verts, rim, edge }. `minimal` sets how many
 * least-area iterations follow the harmonic start (0 leaves a harmonic disc).
 */
export function filmMesh(points, loop, { rings = 24, m = 240, minimal = 40, ...opts } = {}) {
  const edge = boundary(points, loop, m, opts);
  const { verts, tris, rim } = disc(rings, m);
  const n = verts.length;
  const pos = new Float64Array(n * 3);
  const centre = [0, 1, 2].map((k) => edge.reduce((s, e) => s + e.p[k], 0) / m);
  const rimAt = (a) => {                                   // the loop at a fraction of the turn
    const f = a * m, i = Math.floor(f) % m, t = f - Math.floor(f);
    const p = edge[i].p, q = edge[(i + 1) % m].p;
    return p.map((v, k) => v + (q[k] - v) * t);
  };
  verts.forEach((v, i) => {
    const target = rimAt(v.a), t = v.j / rings;
    for (let k = 0; k < 3; k++) pos[i * 3 + k] = centre[k] + (target[k] - centre[k]) * t;
  });
  const fixed = new Uint8Array(n);
  for (const v of rim) fixed[v] = 1;

  // edges, each with the (up to two) vertices opposite it, for the cotangent weights
  const edges = new Map();
  const key = (a, b) => (a < b ? a * n + b : b * n + a);
  for (const [a, b, c] of tris) {
    for (const [u, v, o] of [[a, b, c], [b, c, a], [c, a, b]]) {
      const e = edges.get(key(u, v)) ?? { u: Math.min(u, v), v: Math.max(u, v), opp: [], w: 1 };
      e.opp.push(o);
      edges.set(key(u, v), e);
    }
  }
  const E = [...edges.values()];
  const nbr = Array.from({ length: n }, () => []);
  for (const e of E) {
    nbr[e.u].push(e);
    nbr[e.v].push(e);
  }
  const sweep = (omega) => {
    for (let i = 0; i < n; i++) {
      if (fixed[i]) continue;
      let sw = 0, sx = 0, sy = 0, sz = 0;
      for (const e of nbr[i]) {
        const o = e.u === i ? e.v : e.u;
        sw += e.w;
        sx += e.w * pos[o * 3];
        sy += e.w * pos[o * 3 + 1];
        sz += e.w * pos[o * 3 + 2];
      }
      pos[i * 3] += omega * (sx / sw - pos[i * 3]);
      pos[i * 3 + 1] += omega * (sy / sw - pos[i * 3 + 1]);
      pos[i * 3 + 2] += omega * (sz / sw - pos[i * 3 + 2]);
    }
  };
  // 1. a harmonic disc (equal weights), as the starting shape
  for (let it = 0; it < 250; it++) sweep(1.8);
  // 2. toward least area: re-weight by cotangents of the current shape, re-balance, repeat
  const cot = (o, u, v) => {
    const a = [0, 1, 2].map((k) => pos[u * 3 + k] - pos[o * 3 + k]), b = [0, 1, 2].map((k) => pos[v * 3 + k] - pos[o * 3 + k]);
    const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const c = Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
    return d / (c || 1e-12);
  };
  for (let it = 0; it < minimal; it++) {
    for (const e of E) {
      let w = 0;
      for (const o of e.opp) w += 0.5 * cot(o, e.u, e.v);
      e.w = Math.min(40, Math.max(0.02, w));                // keep it stable where triangles go obtuse
    }
    for (let s = 0; s < 6; s++) sweep(1.0);
  }
  return { pos, tris, verts, rim, edge, m };
}

/** A triangle with a colour at each corner, blended across it, into colour and depth buffers. */
function triangle(buf, zb, a, b, c, ca, cb, cc) {
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(area) < 1e-9) return;
  const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(buf.w - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(buf.h - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((b[0] - px) * (c[1] - py) - (b[1] - py) * (c[0] - px)) / area;
      const w1 = ((c[0] - px) * (a[1] - py) - (c[1] - py) * (a[0] - px)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * a[2] + w1 * b[2] + w2 * c[2], k = y * buf.w + x;
      if (z <= zb[k]) continue;
      zb[k] = z;
      for (let ch = 0; ch < 3; ch++) buf.rgb[k * 3 + ch] = w0 * ca[ch] + w1 * cb[ch] + w2 * cc[ch];
    }
  }
}

/** Paint the film for a loop. Options: size, view, base (the wire's weight), momentum, pressure, minimal. */
export function paintFilm(buf, points, loop, opts = {}) {
  const { size = buf.w, view = DEFAULT_VIEW, base = 6.5 } = opts;
  for (let i = 0; i < buf.w * buf.h; i++) buf.rgb.set(PAPER, i * 3);
  const zb = new Float32Array(buf.w * buf.h).fill(-Infinity);
  const k = size / 400, R = 165 * k, c = size / 2;
  const { pos, tris, verts, rim, edge, m } = filmMesh(points, loop, opts);
  const n = verts.length;

  // view-space positions, screen positions
  const V = Array.from({ length: n }, (_, i) => view.map((row) => row[0] * pos[i * 3] + row[1] * pos[i * 3 + 1] + row[2] * pos[i * 3 + 2]));
  const S = V.map(([x, y, z]) => [c + R * x, c - R * y, z]);
  // a normal at each vertex: the area-weighted average of its triangles' normals
  const N = Array.from({ length: n }, () => [0, 0, 0]);
  for (const [a, b, d] of tris) {
    const u = V[b].map((v, i) => v - V[a][i]), w = V[d].map((v, i) => v - V[a][i]);
    const f = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (const v of [a, b, d]) for (let i = 0; i < 3; i++) N[v][i] += f[i];
  }
  const light = (() => { const l = [-0.35, 0.6, 0.72], s = Math.hypot(...l); return l.map((x) => x / s); })();
  // wedge colours around the rim, one per chord, softened so neighbouring wedges fade together
  let around = edge.map((e) => PALETTE[e.chord % PALETTE.length].slice());
  const soften = Math.max(1, Math.round(m / 160));
  for (let pass = 0; pass < 2; pass++) {
    around = around.map((_, i) => {
      const s = [0, 0, 0];
      for (let d = -soften; d <= soften; d++) {
        const q = around[(i + d + m) % m];
        for (let ch = 0; ch < 3; ch++) s[ch] += q[ch] / (2 * soften + 1);
      }
      return s;
    });
  }
  const wedge = (a) => {
    const f = a * m, i = Math.floor(f) % m, t = f - Math.floor(f);
    return mix(around[i], around[(i + 1) % m], t);
  };
  // the colour at each vertex: its wedge, lit two-sided, with a little sheen
  const C = verts.map((v, i) => {
    const nn = N[i], len = Math.hypot(...nn) || 1;
    const lam = Math.abs((nn[0] * light[0] + nn[1] * light[1] + nn[2] * light[2]) / len);
    const facing = Math.abs(nn[2] / len);
    const base = mix(wedge(v.a), PAPER, 0.1 + 0.16 * (1 - v.j / rimRing(verts)));
    return mix(mix(INK, base, 0.3 + 0.7 * lam), PAPER, 0.24 * lam ** 14 + 0.07 * (1 - facing));
  });
  for (const [a, b, d] of tris) triangle(buf, zb, S[a], S[b], S[d], C[a], C[b], C[d]);

  // the wire: the loop itself in ink, faint where the film hides it
  const wire = Math.max(0.8, (base / 6.5) * 1.6 * k);
  for (let i = 0; i < rim.length; i++) {
    const a = S[rim[i]], b = S[rim[(i + 1) % rim.length]];
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let s = 0; s < steps; s++) {
      const t = s / steps, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
      const px = Math.round(x), py = Math.round(y);
      const hidden = px >= 0 && py >= 0 && px < buf.w && py < buf.h && zb[py * buf.w + px] > z + 0.02;
      inkDot(buf, x, y, wire * (hidden ? 0.6 : 1), hidden ? 0.25 : 0.95);
    }
  }
}
const rimRing = (verts) => verts[verts.length - 1].j;

function inkDot(buf, x, y, r, alpha) {
  alpha *= (r * r) / (r * r + 1 / 12);
  const x0 = Math.max(0, Math.floor(x - r - 1)), x1 = Math.min(buf.w - 1, Math.ceil(x + r + 1));
  const y0 = Math.max(0, Math.floor(y - r - 1)), y1 = Math.min(buf.h - 1, Math.ceil(y + r + 1));
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const a = alpha * Math.min(1, Math.max(0, r + 0.5 - Math.hypot(px + 0.5 - x, py + 0.5 - y)));
      if (a <= 0) continue;
      const i = (py * buf.w + px) * 3;
      for (let ch = 0; ch < 3; ch++) buf.rgb[i + ch] += (INK[ch] - buf.rgb[i + ch]) * a;
    }
  }
}

/** The film's area: for checking that the least-area flow really lowers it. */
export function filmArea({ pos, tris }) {
  let area = 0;
  for (const [a, b, c] of tris) {
    const u = [0, 1, 2].map((k) => pos[b * 3 + k] - pos[a * 3 + k]), w = [0, 1, 2].map((k) => pos[c * 3 + k] - pos[a * 3 + k]);
    area += 0.5 * Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]);
  }
  return area;
}
