// Computed figures for "Shapes we cannot see": hydrogen orbitals, spherical harmonics, and a
// Calabi-Yau cross-section. Each returns { type: "webp", data, width, height }.
import { INK, PAPER, Raster, SIENNA, WASH, mix } from "./raster.mjs";

function rng(seed) {
  let s = seed % 2147483647;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Rotate a point about the x axis (tilt) and then the y axis (turn); returns [x, y, z]. */
function view([x, y, z], tilt, turn = 0) {
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  [y, z] = [y * ct - z * st, y * st + z * ct];
  const cu = Math.cos(turn), su = Math.sin(turn);
  return [x * cu + z * su, y, -x * su + z * cu];
}

// ---------------------------------------------------------------- hydrogen orbitals

/** Generalised Laguerre polynomial L_k^a(x). */
export function laguerre(k, a, x) {
  if (k === 0) return 1;
  let prev = 1, cur = 1 + a - x;
  for (let i = 1; i < k; i++) [prev, cur] = [cur, ((2 * i + 1 + a - x) * cur - (i + a) * prev) / (i + 1)];
  return cur;
}

/**
 * Real hydrogen orbitals (atomic units). The wavefunction is a polynomial in x, y, z (the real
 * spherical harmonic times r^l) times the radial factor e^(-r/n) L_{n-l-1}^{2l+1}(2r/n).
 */
export const ORBITALS = [
  { name: "1s", n: 1, l: 0, poly: () => 1 },
  { name: "2s", n: 2, l: 0, poly: () => 1 },
  { name: "2p", n: 2, l: 1, poly: (x, y, z) => z },
  { name: "3d", n: 3, l: 2, poly: (x, y, z, r2) => 3 * z * z - r2 },
  { name: "3d", n: 3, l: 2, poly: (x, y) => x * y },
  { name: "4f", n: 4, l: 3, poly: (x, y, z, r2) => z * (5 * z * z - 3 * r2) },
];

export function psi({ n, l, poly }, x, y, z) {
  const r2 = x * x + y * y + z * z, r = Math.sqrt(r2);
  return poly(x, y, z, r2) * Math.exp(-r / n) * laguerre(n - l - 1, 2 * l + 1, (2 * r) / n);
}

/** A cloud of points drawn from |psi|^2, in stippled ink; the two signs of psi in two inks. */
async function cloud(orbital, size, points, seed) {
  const R = 3 * orbital.n * orbital.n + 3;          // holds nearly all of the probability
  const rand = rng(seed);
  const u = () => (2 * rand() - 1) * R;
  let max = 0;
  for (let i = 0; i < 200000; i++) max = Math.max(max, psi(orbital, u(), u(), u()) ** 2);
  max *= 1.15;
  const img = new Raster(size, size);
  // frame by the mean radius, (3n^2 - l(l+1))/2, so the shape fills the tile
  const mean = (3 * orbital.n * orbital.n - orbital.l * (orbital.l + 1)) / 2;
  const scale = (size * 0.43) / (1.75 * mean + 2.5);
  let drawn = 0;
  while (drawn < points) {
    const x = u(), y = u(), z = u();
    const v = psi(orbital, x, y, z);
    if (rand() * max > v * v) continue;
    const [sx, sy, depth] = view([x, y, z], -0.16, 0.5);
    const near = 0.55 + 0.45 * (0.5 + depth / (2 * R));
    img.dot(size / 2 + sx * scale, size / 2 - sy * scale, 0.6, v >= 0 ? INK : SIENNA, 0.3 * near);
    drawn++;
  }
  return img;
}

/** The six orbitals, 3 x 2, as one image. */
export async function orbitals() {
  const tile = 460, cols = 3, gap = 0;
  const sheet = new Raster(tile * cols, tile * 2);
  for (const [i, o] of ORBITALS.entries()) {
    const t = await cloud(o, tile, 42000, 1926 + i);
    const ox = (i % cols) * (tile + gap) * sheet.scale, oy = Math.floor(i / cols) * tile * sheet.scale;
    for (let y = 0; y < t.h; y++) sheet.rgb.set(t.rgb.subarray(y * t.w * 3, (y + 1) * t.w * 3), ((oy + y) * sheet.w + ox) * 3);
  }
  return sheet.webp();
}

// ---------------------------------------------------------------- spherical harmonics

/** Real spherical harmonics on the unit sphere, as polynomials in x, y, z. */
export const HARMONICS = [
  { name: "l = 2, m = 0", f: (x, y, z) => 3 * z * z - 1 },
  { name: "l = 3, m = 2", f: (x, y, z) => z * (x * x - y * y) },
  { name: "l = 4, m = 4", f: (x, y) => x ** 4 - 6 * x * x * y * y + y ** 4 },
  { name: "l = 6, m = 3", f: (x, y, z) => (x * x * x - 3 * x * y * y) * (11 * z ** 3 - 3 * z) },
];

/** Shade a sphere by one harmonic: sienna where positive, blue wash where negative. */
function shadedSphere(img, ox, oy, R, f, points) {
  const light = [-0.4, 0.55, 0.73];
  let max = 0;
  for (let i = 0; i < 4000; i++) {
    const a = Math.acos(1 - 2 * (i + 0.5) / 4000), b = i * 2.39996;
    max = Math.max(max, Math.abs(f(Math.sin(a) * Math.cos(b), Math.sin(a) * Math.sin(b), Math.cos(a))));
  }
  // the harmonic's value at each pixel of the disc (undoing the view to find the sphere point)
  const tilt = 0.42, ct = Math.cos(tilt), st = Math.sin(tilt);
  const W = 2 * R + 1;
  const value = new Float32Array(W * W).fill(NaN);
  for (let py = -R; py <= R; py++) {
    for (let px = -R; px <= R; px++) {
      const sx = (px + 0.5) / R, sy = -(py + 0.5) / R, d = sx * sx + sy * sy;
      if (d > 1) continue;
      const sz = Math.sqrt(1 - d);
      value[(py + R) * W + (px + R)] = f(sx, sy * ct + sz * st, -sy * st + sz * ct) / max;
    }
  }
  for (let py = -R; py <= R; py++) {
    for (let px = -R; px <= R; px++) {
      const v = value[(py + R) * W + (px + R)];
      if (Number.isNaN(v)) continue;
      const sx = (px + 0.5) / R, sy = -(py + 0.5) / R, d = sx * sx + sy * sy, sz = Math.sqrt(1 - d);
      const shade = 0.82 + 0.18 * Math.max(0, sx * light[0] + sy * light[1] + sz * light[2]);
      let c = mix(PAPER, v >= 0 ? SIENNA : WASH, Math.min(1, Math.abs(v) ** 0.7) * 0.9);
      // nodal lines: only where the sign actually changes to a neighbour, so they stay thin
      const right = value[(py + R) * W + (px + R + 1)], down = value[(py + R + 1) * W + (px + R)];
      if ((right !== undefined && !Number.isNaN(right) && Math.sign(right) !== Math.sign(v)) ||
          (down !== undefined && !Number.isNaN(down) && Math.sign(down) !== Math.sign(v))) c = mix(c, INK, 0.6);
      if (d > 0.985) c = mix(c, INK, 0.35);                 // the rim
      img.fill(ox + px, oy + py, mix(INK, c, shade));
    }
  }
  // the 13 points, where they face the viewer
  for (const p of points) {
    const [x, y, z] = view(p, -0.42);
    if (z > 0) img.dot(ox + x * R, oy - y * R, 3.2, INK, 0.9);
  }
}

/** Four harmonics, each with the 13 points on it. */
export async function harmonics(points) {
  const R = 190, cell = 2 * R + 40;
  const img = new Raster(cell * 4, cell);
  HARMONICS.forEach((h, i) => shadedSphere(img, cell * i + cell / 2, cell / 2, R, h.f, points));
  return img.webp();
}

// ---------------------------------------------------------------- Calabi-Yau

/**
 * Andrew Hanson's construction (1994) of the complex curve z1^n + z2^n = 1, a cross-section of
 * the quintic Calabi-Yau manifold when n = 5. With z = x + iy, x in [-a, a], y in [0, pi/2]:
 *   z1 = e^(2 pi i k1 / n) cosh(z)^(2/n),   z2 = e^(2 pi i k2 / n) (-i sinh z)^(2/n),
 * so z1^n + z2^n = cosh^2 - sinh^2 = 1. The n^2 patches (k1, k2) tile the surface. It lives in
 * C^2 = R^4; we see it in R^3 as (Re z1, Re z2, cos(alpha) Im z1 + sin(alpha) Im z2).
 */
export function cpow([re, im], p) {
  const r = Math.hypot(re, im) ** p, t = Math.atan2(im, re) * p;
  return [r * Math.cos(t), r * Math.sin(t)];
}
const cmul = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c];
const cis = (t) => [Math.cos(t), Math.sin(t)];

export function calabiYauPoint(n, k1, k2, x, y, alpha) {
  const cosh = [Math.cosh(x) * Math.cos(y), Math.sinh(x) * Math.sin(y)];
  const sinh = [Math.sinh(x) * Math.cos(y), Math.cosh(x) * Math.sin(y)];
  const misinh = [sinh[1], -sinh[0]];                  // -i * sinh z
  const z1 = cmul(cis((2 * Math.PI * k1) / n), cpow(cosh, 2 / n));
  const z2 = cmul(cis((2 * Math.PI * k2) / n), cpow(misinh, 2 / n));
  return [z1[0], z2[0], Math.cos(alpha) * z1[1] + Math.sin(alpha) * z2[1]];
}

/** The quintic cross-section, shaded, with patches in a palette of inks and washes. */
export async function calabiYau(opts = {}) {
  const { size = 1400, tilt = -0.55, turn = 0.6, alpha = 0.78, n = 5 } = opts;
  const img = new Raster(size, size);
  const steps = opts.steps ?? 34, a = 1.0;
  const light = (() => { const v = [-0.35, 0.6, 0.72], m = Math.hypot(...v); return v.map((c) => c / m); })();
  const palette = [SIENNA, [92, 104, 128], [176, 138, 92], [60, 66, 74], [150, 112, 98]];
  const scale = size * 0.3 * (opts.zoom ?? 1);
  const P = (k1, k2, i, j) => view(calabiYauPoint(n, k1, k2, -a + (2 * a * i) / steps, (Math.PI / 2) * (j / steps), alpha), tilt, turn);
  const screen = ([x, y, z]) => [size / 2 + x * scale, size / 2 - y * scale, z];
  for (let k1 = 0; k1 < n; k1++) {
    for (let k2 = 0; k2 < n; k2++) {
      const base = mix(palette[k1 % palette.length], PAPER, 0.12 + (0.5 * k2) / n);
      const grid = [];
      for (let i = 0; i <= steps; i++) {
        grid.push([]);
        for (let j = 0; j <= steps; j++) grid[i].push(P(k1, k2, i, j));
      }
      for (let i = 0; i < steps; i++) {
        for (let j = 0; j < steps; j++) {
          const q = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]];
          // two-sided Lambert shading, plus a little sheen, from the view-space normal
          const u = q[2].map((v, c) => v - q[0][c]), w = q[3].map((v, c) => v - q[1][c]);
          const nrm = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
          const len = Math.hypot(...nrm) || 1;
          const lam = Math.abs((nrm[0] * light[0] + nrm[1] * light[1] + nrm[2] * light[2]) / len);
          const facing = Math.abs(nrm[2] / len);
          const color = mix(mix(INK, base, 0.3 + 0.7 * lam), PAPER, 0.25 * lam ** 12 + 0.06 * (1 - facing));
          const sq = q.map(screen);
          img.triangle(sq[0], sq[1], sq[2], color);
          img.triangle(sq[0], sq[2], sq[3], color);
        }
      }
    }
  }
  return opts.raw ? img : img.webp();
}

/** A gallery of the family z1^n + z2^n = 1 for n = 2..7: n = 5 is the quintic's cross-section. */
export async function calabiYauFamily() {
  const tile = 420, ns = [2, 3, 4, 5, 6, 7], cols = 3;
  const sheet = new Raster(tile * cols, tile * 2);
  for (const [i, n] of ns.entries()) {
    const t = await calabiYau({ n, size: tile, steps: 22, zoom: n === 2 ? 0.8 : 1, raw: true });
    const ox = (i % cols) * tile * sheet.scale, oy = Math.floor(i / cols) * tile * sheet.scale;
    for (let y = 0; y < t.h; y++) sheet.rgb.set(t.rgb.subarray(y * t.w * 3, (y + 1) * t.w * 3), ((oy + y) * sheet.w + ox) * 3);
  }
  return sheet.webp();
}
