import json

import numpy as np

import stars
from conftest import EXAMPLES


def points():
    return np.array(json.loads((EXAMPLES / "glyphs" / "glyphs.json").read_text())["points"])


def test_star_cycles_are_permutations():
    order = stars.canonical_order(points())
    assert order[0] == int(np.argmax(points()[:, 2]))   # axis vertex first
    for k in range(1, 7):
        assert sorted(stars.star_cycle(order, k)) == list(range(13))


def test_k_and_13_minus_k_are_reverse_loops():
    order = stars.canonical_order(points())
    for k in range(1, 7):
        a, b = stars.star_cycle(order, k), stars.star_cycle(order, 13 - k)
        assert b == [a[0]] + a[1:][::-1]


def test_regenerating_examples_is_byte_identical(tmp_path):
    stars.main(str(EXAMPLES / "glyphs" / "glyphs.json"), str(tmp_path))
    for p in sorted((EXAMPLES / "stars").glob("*.substance")):
        assert (tmp_path / p.name).read_text() == p.read_text(), p.name
