"""Export the data the site's interactive pages need, as JSON.

usage: python3 src/site_data.py examples/glyphs/glyphs.json site/spike/data.json
"""
import json
import sys

import numpy as np

import loops


def main(src, out):
    with open(src) as f:
        d = json.load(f)
    x = np.array(d["points"])
    edges = [tuple(e) for e in d["edges"]]
    found, syms = loops.surface_loops(x, edges)
    data = {
        "points": [[round(c, 6) for c in p] for p in x.tolist()],
        "edges": [list(e) for e in edges],
        "loops": {r: list(L) for r, L in zip(loops.ROWS, found)},
        # vertex permutations realised by rotations/reflections of the configuration;
        # the page uses them to recognise the same glyph however it is turned
        "symmetries": [list(s) for s in syms],
    }
    with open(out, "w", newline="\n") as f:
        json.dump(data, f, indent=1)
        f.write("\n")
    print(f"wrote {out}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
