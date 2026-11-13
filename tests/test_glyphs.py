import numpy as np
import pytest

import glyphs
from conftest import EXAMPLES


@pytest.fixture(scope="module")
def oriented(tammes13):
    x, edges, _ = tammes13
    return glyphs.orient(x), edges


def test_orientation_puts_largest_hole_south_and_a_vertex_north(oriented):
    x, _ = oriented
    assert np.allclose(np.linalg.norm(x, axis=1), 1.0)
    top = np.argmax(x[:, 2])
    assert x[top, 2] > 0.999            # the 4-fold axis vertex
    assert abs(x[top, 0]) < 1e-9        # spun so it points "up" the page (+y)
    assert x[:, 2].min() > -0.75        # nothing near the south pole: that's the empty cap


def test_glyph_counts(oriented):
    x, edges = oriented
    paths, syms, distinct = glyphs.distinct_glyphs(x, edges)
    assert len(paths) == 3120
    assert len(syms) == 8
    assert len(distinct) == 199


def test_paths_follow_contact_edges(oriented):
    x, edges = oriented
    _, _, distinct = glyphs.distinct_glyphs(x, edges)
    es = {frozenset(e) for e in edges}
    for p in distinct:
        assert sorted(p) == list(range(13))
        assert all(frozenset(s) in es for s in zip(p, p[1:]))


def test_regenerating_examples_is_byte_identical(tmp_path):
    """glyphs.py over examples/tammes13.json reproduces the committed examples/glyphs."""
    glyphs.main(str(EXAMPLES / "tammes13.json"), str(tmp_path), 24)
    expected = sorted(p.name for p in (EXAMPLES / "glyphs").glob("*.substance"))
    assert sorted(p.name for p in tmp_path.glob("*.substance")) == expected
    for name in expected:
        assert (tmp_path / name).read_text() == (EXAMPLES / "glyphs" / name).read_text(), name
