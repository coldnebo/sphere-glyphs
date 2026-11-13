// The physics figures are computed, so check the mathematics they are computed from.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ORBITALS, calabiYauPoint, cpow, laguerre, psi } from "../site/science.mjs";

const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

test("generalised Laguerre polynomials match their closed forms", () => {
  for (const x of [0, 0.5, 2, 7.3]) {
    assert.ok(close(laguerre(0, 3, x), 1));
    assert.ok(close(laguerre(1, 1, x), 2 - x));                              // L_1^1
    assert.ok(close(laguerre(2, 1, x), (x * x) / 2 - 3 * x + 3));            // L_2^1
    assert.ok(close(laguerre(1, 3, x), 4 - x));                              // L_1^3
  }
});

test("hydrogen nodes sit where theory puts them", () => {
  const [s1, s2, p2, d3a, d3b, f4] = ORBITALS;
  // 2s has its radial node at r = 2 Bohr radii
  assert.ok(Math.sign(psi(s2, 1.9, 0, 0)) !== Math.sign(psi(s2, 2.1, 0, 0)));
  assert.ok(close(psi(s2, 2, 0, 0), 0));
  // 1s has none, and is largest at the nucleus
  assert.ok(psi(s1, 0, 0, 0) > psi(s1, 1, 0, 0) && psi(s1, 3, 0, 0) > 0);
  // 2p_z is zero in the xy plane and changes sign across it
  assert.ok(close(psi(p2, 1, 1, 0), 0));
  assert.ok(psi(p2, 0, 0, 2) > 0 && psi(p2, 0, 0, -2) < 0);
  // 3d_xy vanishes on the axes; 3d_z2 on its cone, where 3z^2 = r^2
  assert.ok(close(psi(d3b, 3, 0, 0), 0) && close(psi(d3b, 0, 3, 0), 0));
  const z = Math.sqrt(1 / 3), rxy = Math.sqrt(2 / 3);
  assert.ok(close(psi(d3a, 3 * rxy, 0, 3 * z), 0, 1e-12));
  // 4f_z(5z^2 - 3r^2) is odd in z
  assert.ok(close(psi(f4, 1, 2, 3), -psi(f4, 1, 2, -3)));
});

test("every Calabi-Yau point satisfies z1^n + z2^n = 1", () => {
  // reconstruct z1, z2 from the construction and check the equation
  const cmul = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c];
  const cis = (t) => [Math.cos(t), Math.sin(t)];
  for (const n of [2, 3, 5, 7]) {
    for (const [k1, k2] of [[0, 0], [1, 3 % n], [n - 1, 0]]) {
      for (const [x, y] of [[-0.8, 0.1], [0, 0.7], [0.6, 1.5]]) {
        const ch = [Math.cosh(x) * Math.cos(y), Math.sinh(x) * Math.sin(y)];
        const sh = [Math.sinh(x) * Math.cos(y), Math.cosh(x) * Math.sin(y)];
        const z1 = cmul(cis((2 * Math.PI * k1) / n), cpow(ch, 2 / n));
        const z2 = cmul(cis((2 * Math.PI * k2) / n), cpow([sh[1], -sh[0]], 2 / n));
        // z^n by repeated multiplication, which has no branch cuts
        let p1 = [1, 0], p2 = [1, 0];
        for (let i = 0; i < n; i++) { p1 = cmul(p1, z1); p2 = cmul(p2, z2); }
        assert.ok(close(p1[0] + p2[0], 1, 1e-9) && close(p1[1] + p2[1], 0, 1e-9), `n=${n} k=${k1},${k2} at ${x},${y}`);
        // and the projected point is the one the renderer uses
        const P = calabiYauPoint(n, k1, k2, x, y, 0.78);
        assert.ok(close(P[0], z1[0]) && close(P[1], z2[0]));
        assert.ok(close(P[2], Math.cos(0.78) * z1[1] + Math.sin(0.78) * z2[1]));
      }
    }
  }
});
