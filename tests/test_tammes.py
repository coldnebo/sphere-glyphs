import numpy as np
import pytest

import tammes


def angle_deg(d):
    return np.degrees(2 * np.arcsin(d / 2))


@pytest.mark.parametrize(
    "n, expected_deg, expected_edges",
    [
        (4, 109.4712, 6),   # regular tetrahedron
        (6, 90.0, 12),      # regular octahedron
    ],
)
def test_solver_recovers_classical_cases(n, expected_deg, expected_edges):
    d, x = tammes.solve(n, starts=8)
    assert angle_deg(d) == pytest.approx(expected_deg, abs=1e-3)
    assert np.allclose(np.linalg.norm(x, axis=1), 1.0)
    assert len(tammes.contact_graph(x)) == expected_edges


def test_committed_13_point_optimum(tammes13):
    x, edges, data = tammes13
    assert data["angle_deg"] == pytest.approx(57.1367, abs=1e-4)
    assert np.allclose(np.linalg.norm(x, axis=1), 1.0, atol=1e-9)
    # the contact graph re-derived from the points matches what was stored
    assert sorted(tammes.contact_graph(x)) == sorted(edges)
    deg = np.bincount(np.array(edges).ravel(), minlength=13)
    assert len(edges) == 24
    assert sorted(deg.tolist()) == [3] * 4 + [4] * 9
