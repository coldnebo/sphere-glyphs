"""Numerically solve the Tammes problem for N points and extract its contact graph.

Maximize d subject to |x_i - x_j|^2 >= d for all pairs, |x_i| = 1.
Multi-start SLSQP; keeps the best result.

usage: python3 src/tammes.py [N] [out.json]      (default N=13, out=tammes{N}.json)
"""
import json
import sys

import numpy as np
from scipy.optimize import minimize


def solve(n, starts=60, seed=0):
    rng = np.random.default_rng(seed)
    pairs = [(i, j) for i in range(n) for j in range(i + 1, n)]
    best = None
    for _ in range(starts):
        x0 = rng.normal(size=(n, 3))
        x0 /= np.linalg.norm(x0, axis=1, keepdims=True)
        dmin = min(np.sum((x0[i] - x0[j]) ** 2) for i, j in pairs)
        v0 = np.append(x0.ravel(), dmin)

        cons = [
            {"type": "ineq", "fun": lambda v, i=i, j=j: np.sum((v[3*i:3*i+3] - v[3*j:3*j+3]) ** 2) - v[-1]}
            for i, j in pairs
        ] + [
            {"type": "eq", "fun": lambda v, i=i: np.sum(v[3*i:3*i+3] ** 2) - 1.0}
            for i in range(n)
        ]
        r = minimize(lambda v: -v[-1], v0, constraints=cons, method="SLSQP",
                     options={"maxiter": 2000, "ftol": 1e-14})
        if not r.success:
            continue
        x = r.x[:-1].reshape(n, 3)
        x /= np.linalg.norm(x, axis=1, keepdims=True)
        d = min(np.linalg.norm(x[i] - x[j]) for i, j in pairs)
        if best is None or d > best[0]:
            best = (d, x)
    return best


def contact_graph(x, tol=1e-5):
    n = len(x)
    dist = np.linalg.norm(x[:, None] - x[None], axis=-1)
    dmin = min(dist[i, j] for i in range(n) for j in range(i + 1, n))
    return [(i, j) for i in range(n) for j in range(i + 1, n) if dist[i, j] < dmin + tol]


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 13
    out = sys.argv[2] if len(sys.argv) > 2 else f"tammes{n}.json"
    d, x = solve(n)
    ang = np.degrees(2 * np.arcsin(d / 2))
    edges = contact_graph(x)
    deg = np.bincount(np.array(edges).ravel(), minlength=n)
    print(f"N={n}  min angular separation = {ang:.4f} deg")
    print(f"contact edges = {len(edges)}  degrees = {sorted(deg.tolist())}")
    with open(out, "w") as f:
        json.dump({"n": n, "angle_deg": ang, "points": x.tolist(), "edges": edges}, f, indent=1)
    print(f"wrote {out}")
