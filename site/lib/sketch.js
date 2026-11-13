// A fast canvas sketch of glass.style, for drawing thousands of glyphs (the Library wall).
// Same model as the Penrose style: orthographic view of the sphere; each corner a filled
// quadratic outline, pressed on tight turns and thinner at depth; three passes: a pale wash for
// every piece, a paper halo where the stroke is in front, then ink fading in at the rim.
// About a millisecond per glyph. For the finished ink, open the glyph in the explorer.

export const PAPER = "#f5f0e3";
const WASH = "rgb(158, 168, 189)";
const INK = "rgb(23, 20, 15)";
const RIM = "rgba(77, 84, 102, 0.18)";
const DOT = "rgba(64, 69, 82, 0.35)";

/** glass.style's default view: the symmetry axis tilted 0.52 rad toward the viewer (rows). */
export const DEFAULT_VIEW = (() => {
  const c = Math.cos(0.52), s = Math.sin(0.52);
  return [[1, 0, 0], [0, c, -s], [0, s, c]];
})();

const rot90 = ([x, y]) => [-y, x];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const norm = (a) => Math.hypot(a[0], a[1]) || 1e-9;
const unit = (a) => mul(a, 1 / norm(a));

/**
 * Draw a closed loop through `points` (unit vectors) in the order `loop`.
 * Coordinates follow glass.style: a 400-unit canvas, sphere radius 165, y up.
 */
export function drawGlyph(ctx, points, loop, {
  size, view = DEFAULT_VIEW, base = 6.5, momentum = 1, pressure = 1, background = PAPER,
} = {}) {
  const k = size / 400;
  const R = 165 * k, cx = size / 2, cy = size / 2;
  const n = loop.length;
  const cut = 0.5 * momentum;
  const gap = 2.6 * k, ramp = 0.06;

  // project: screen point (y down for the canvas) and depth (+1 nearest)
  const proj = points.map(([x, y, z]) => {
    const [a, b, c] = view.map((r) => r[0] * x + r[1] * y + r[2] * z);
    return { p: [cx + R * a, cy - R * b], z: c };
  });
  const front = (z) => Math.min(1, Math.max(0, (z + ramp) / (2 * ramp)));
  const halfWidth = (za, zb) => (base / 2) * k * (0.72 + 0.28 * (za + zb) / 2);

  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(140, 158, 191, 0.05)";
  ctx.fill();
  ctx.strokeStyle = RIM;
  ctx.lineWidth = Math.max(0.6, k);
  ctx.stroke();
  ctx.fillStyle = DOT;
  for (const { p, z } of proj) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], Math.max(0.6, (1.6 + 0.8 * z) * k), 0, 2 * Math.PI);
    ctx.fill();
  }

  // pieces: one rounded corner per vertex, plus a straight run per step when momentum < 1
  const pieces = [];
  for (let i = 0; i < n; i++) {
    const A = proj[loop[(i + n - 1) % n]], B = proj[loop[i]], C = proj[loop[(i + 1) % n]];
    const m1 = add(B.p, mul(sub(A.p, B.p), cut));
    const m2 = add(B.p, mul(sub(C.p, B.p), cut));
    const din = sub(B.p, m1), dout = sub(m2, B.p);
    const turn = dot(din, dout) / (norm(din) * norm(dout));
    const hin = halfWidth(A.z, B.z), hout = halfWidth(B.z, C.z);
    const hw = ((hin + hout) / 2) * (1 + pressure * (0.55 - 0.85 * turn));
    const n0 = rot90(unit(din)), n2 = rot90(unit(dout));
    const sum = add(n0, n2);
    const nm = norm(sum) > 1e-6 ? unit(sum) : n0;
    const kk = dot(sum, nm) / 4;
    const alpha = front(B.z);
    pieces.push({
      alpha,
      path: (g) => {
        const reach = 2 * (hw + g) - (hin + hout + 2 * g) * kk;
        const P = new Path2D();
        let q = add(m1, mul(n0, hin + g));
        P.moveTo(q[0], q[1]);
        let c1 = add(B.p, mul(nm, reach)), e1 = add(m2, mul(n2, hout + g));
        P.quadraticCurveTo(c1[0], c1[1], e1[0], e1[1]);
        q = sub(m2, mul(n2, hout + g));
        P.lineTo(q[0], q[1]);
        c1 = sub(B.p, mul(nm, reach));
        e1 = sub(m1, mul(n0, hin + g));
        P.quadraticCurveTo(c1[0], c1[1], e1[0], e1[1]);
        P.closePath();
        return P;
      },
    });
    if (cut < 0.4999) {
      const s0 = m2, s1 = add(C.p, mul(sub(B.p, C.p), cut));
      const mid = mul(add(B.p, C.p), 0.5);
      const nn = rot90(unit(sub(C.p, B.p)));
      const run = (from, to, h, a) => ({
        alpha: a,
        path: (g) => {
          const P = new Path2D();
          const pts = [add(from, mul(nn, h + g)), add(to, mul(nn, h + g)), sub(to, mul(nn, h + g)), sub(from, mul(nn, h + g))];
          P.moveTo(pts[0][0], pts[0][1]);
          for (const t of pts.slice(1)) P.lineTo(t[0], t[1]);
          P.closePath();
          return P;
        },
      });
      pieces.push(run(s0, mid, hout, front(B.z)), run(mid, s1, hout, front(C.z)));
    }
  }

  // BACK: every piece, pale
  ctx.fillStyle = WASH;
  ctx.globalAlpha = 1;
  for (const pc of pieces) ctx.fill(pc.path(0));
  // HALO: paper around the front pieces, so they pass over what is behind
  ctx.fillStyle = PAPER;
  for (const pc of pieces) if (pc.alpha > 0) { ctx.globalAlpha = pc.alpha; ctx.fill(pc.path(gap)); }
  // FRONT: ink
  ctx.fillStyle = INK;
  for (const pc of pieces) if (pc.alpha > 0) { ctx.globalAlpha = pc.alpha; ctx.fill(pc.path(0)); }
  ctx.globalAlpha = 1;
}
