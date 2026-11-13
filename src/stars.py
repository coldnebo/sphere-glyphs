"""Spherical star polygons: visit the 13 Tammes points in the order i -> k*i (mod 13).

On a circle this rule draws the star polygon {13/k} from the 13th roots of unity.
Here the points are ordered axis-first, then ring by ring by azimuth, and consecutive
points are joined by straight chords through the sphere's interior. Each glyph is a
closed loop (every vertex is a corner, no Start/End).

usage: python3 src/stars.py examples/glyphs/glyphs.json examples/stars
"""
import json
import math
import os
import sys

import numpy as np

from substance_text import at_lines


def canonical_order(x):
    """Vertex order: by polar angle (ring), then azimuth within the ring."""
    polar = np.round(np.degrees(np.arccos(np.clip(x[:, 2], -1, 1))) / 10)  # ring buckets
    azim = np.arctan2(x[:, 1], x[:, 0]) % (2 * math.pi)
    return sorted(range(len(x)), key=lambda i: (polar[i], azim[i]))


def star_cycle(order, k):
    n = len(order)
    return [order[(k * i) % n] for i in range(n)]


def substance(x, cycle, k):
    n = len(x)
    names = [f"v{i:02d}" for i in range(n)]
    lines = [f"-- spherical star {{{n}/{k}}}: chords through the interior, closed loop", ""]
    lines.append("Vertex " + ", ".join(names))
    lines.append("")
    lines += at_lines(x)
    lines.append("")
    for a, b in zip(cycle, cycle[1:] + cycle[:1]):
        lines.append(f"Step({names[a]}, {names[b]})")
    return "\n".join(lines) + "\n"


def main(src, outdir):
    with open(src) as f:
        x = np.array(json.load(f)["points"])
    n = len(x)
    order = canonical_order(x)
    os.makedirs(outdir, exist_ok=True)
    for k in range(1, (n - 1) // 2 + 1):          # k and n-k give the same loop reversed
        cycle = star_cycle(order, k)
        with open(os.path.join(outdir, f"star-{n}-{k}.substance"), "w", newline="\n") as f:
            f.write(substance(x, cycle, k))
        depth = [float(np.linalg.norm((x[a] + x[b]) / 2)) for a, b in zip(cycle, cycle[1:] + cycle[:1])]
        print(f"{{{n}/{k}}}: chord midpoints at radius {min(depth):.2f}-{max(depth):.2f}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
