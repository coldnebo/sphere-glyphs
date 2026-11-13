import json

import numpy as np

import loops
from conftest import EXAMPLES


def load():
    d = json.loads((EXAMPLES / "glyphs" / "glyphs.json").read_text())
    return np.array(d["points"]), [tuple(e) for e in d["edges"]]


def test_three_surface_loops_eighteen_distinct_glyphs():
    x, edges = load()
    found, syms = loops.surface_loops(x, edges)
    assert len(found) == 3
    es = {frozenset(e) for e in edges}
    for L in found:
        assert sorted(L) == list(range(13))
        assert all(frozenset((L[i], L[(i + 1) % 13])) in es for i in range(13))  # closes along contacts
    glyphs = {loops.canonical_loop(loops.star(list(L), k), syms) for L in found for k in range(1, 7)}
    assert len(glyphs) == 18


def test_k_and_13_minus_k_are_the_same_loop():
    x, edges = load()
    found, syms = loops.surface_loops(x, edges)
    for L in found:
        for k in range(1, 7):
            a = loops.canonical_loop(loops.star(list(L), k), syms)
            assert a == loops.canonical_loop(loops.star(list(L), 13 - k), syms)


def test_regenerating_examples_is_byte_identical(tmp_path):
    loops.main(str(EXAMPLES / "glyphs" / "glyphs.json"), str(tmp_path))
    files = sorted((EXAMPLES / "loops").glob("*.substance"))
    assert len(files) == 18
    for p in files:
        assert (tmp_path / p.name).read_text() == p.read_text(), p.name
