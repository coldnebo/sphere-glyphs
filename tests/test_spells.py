import json
import re

import numpy as np
import pytest

import spells
import substance_text
import tammes
from conftest import EXAMPLES

SPELLS = EXAMPLES / "spells"


@pytest.fixture(scope="module")
def data():
    return json.loads((SPELLS / "spells.json").read_text())


def test_sphere11_is_the_tammes_optimum():
    x = spells.sphere11()
    assert np.allclose(np.linalg.norm(x, axis=1), 1.0)
    d = min(np.linalg.norm(x[i] - x[j]) for i in range(11) for j in range(i + 1, 11))
    assert np.degrees(2 * np.arcsin(d / 2)) == pytest.approx(63.4349, abs=1e-4)
    # icosahedron minus one vertex: 30 - 5 edges
    assert len(spells.contacts(x)) == 25
    # same as the numerical solver finds
    d_num, _ = tammes.solve(11, starts=6)
    assert d == pytest.approx(d_num, abs=1e-6)


def test_hub_at_pole_and_its_spokes_are_contacts():
    x = spells.sphere11()
    assert np.allclose(x[spells.HUB], (0, 0, 1))
    c = {tuple(e) for e in spells.contacts(x)}
    assert all((i, spells.HUB) in c for i in range(5))


@pytest.mark.parametrize("pair", [(0, 1), (0, 8), (3, 6), (2, 9)])
def test_arc_samples_lie_on_sphere_between_endpoints(pair):
    x = spells.sphere11()
    a, b = x[pair[0]], x[pair[1]]
    pts = spells.arc(a, b)
    assert len(pts) == spells.SAMPLES
    assert np.allclose(np.linalg.norm(pts, axis=1), 1.0)
    # strictly progresses from a to b
    da = [np.arccos(np.clip(p @ a, -1, 1)) for p in pts]
    assert da == sorted(da)


def test_antipodal_arcs_route_over_the_north_pole():
    x = spells.sphere11()
    for i in range(5):
        j = 6 + (i + 2) % 5
        assert np.allclose(x[i], -x[j])
        pts = spells.arc(x[i], x[j])
        # the great circle chosen is the one through the pole...
        assert abs(np.linalg.det([x[i], pts[0], (0, 0, 1)])) < 1e-9
        # ...and the arc takes the northern half of it
        assert pts[spells.SAMPLES // 2][2] > 0.8


def test_literals_are_distinct_in_value():
    assert substance_text.literals([0.0, -0.0, 0.0, 1.0]) == "0.000000, 0.000001, 0.000002, 1.000000"


def test_spell_data(data):
    assert data["vertices"] == 11
    assert len(data["spells"]) == 5
    for s in data["spells"]:
        e = [tuple(p) for p in s["edges"]]
        assert len(e) == len(set(e)), s["name"]
        assert all(0 <= a < b < 11 for a, b in e), s["name"]
        # the shared base: 5 joins 0-4 in every spell
        assert {(i, 5) for i in range(5)} <= set(e), s["name"]


def test_every_statement_has_distinct_numbers():
    """Guard against Penrose's injective Number matching (see spells.literals)."""
    for f in SPELLS.glob("*.substance"):
        for line in f.read_text().splitlines():
            nums = [float(n) for n in re.findall(r"-?\d+\.\d+", line)]
            assert len(nums) == len(set(nums)), f"{f.name}: {line}"


def test_regenerating_examples_is_byte_identical(tmp_path, data):
    spells.main(str(SPELLS / "spells.json"), str(tmp_path))
    for s in data["spells"]:
        name = f"{s['slug']}.substance"
        assert (tmp_path / name).read_text() == (SPELLS / name).read_text(), name
