import itertools
import json
import math

import numpy as np
import pytest

import burnside
from conftest import EXAMPLES


def brute_force_invariant(n, perm):
    """Every undirected Hamiltonian cycle of K_n, kept if perm maps its edge set to itself."""
    out = set()
    for rest in itertools.permutations(range(1, n)):
        if rest[0] > rest[-1]:
            continue                                   # each undirected cycle once
        c = (0,) + rest
        edges = frozenset(tuple(sorted((c[i], c[(i + 1) % n]))) for i in range(n))
        image = frozenset(tuple(sorted((perm[a], perm[b]))) for a, b in edges)
        if image == edges:
            out.add(edges)
    return out


@pytest.mark.parametrize("n, perm", [
    (5, (0, 2, 1, 4, 3)),
    (7, (0, 2, 3, 1, 5, 6, 4)),
    (7, (6, 5, 4, 3, 2, 1, 0)),
    (8, (1, 2, 3, 0, 5, 6, 7, 4)),
    (8, (0, 1, 3, 2, 5, 4, 7, 6)),
    (9, (0, 2, 1, 4, 3, 6, 5, 8, 7)),
    (9, (0, 2, 3, 4, 1, 6, 7, 8, 5)),
])
def test_invariant_cycles_match_brute_force(n, perm):
    assert set(burnside.invariant_cycles(n, perm)) == brute_force_invariant(n, perm)


def test_identity_would_fix_everything():
    n = 7
    assert len(burnside.invariant_cycles(n, tuple(range(n)))) == math.factorial(n - 1) // 2


def test_exact_count_for_the_13_points():
    d = json.loads((EXAMPLES / "glyphs" / "glyphs.json").read_text())
    r = burnside.count(d["points"], d["edges"])
    assert r["loops"] == 239_500_800
    assert r["symmetries"] == 8
    # Burnside: an integer, a little above the naive 12!/2/8, because symmetric loops have
    # orbits smaller than 8
    assert r["glyphs"] * 8 >= r["loops"]
    assert r["glyphs"] - r["loops"] // 8 < r["symmetric_loops"]
