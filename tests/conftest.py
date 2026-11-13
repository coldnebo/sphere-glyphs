import json
from pathlib import Path

import numpy as np
import pytest

ROOT = Path(__file__).resolve().parent.parent
EXAMPLES = ROOT / "examples"


@pytest.fixture(scope="session")
def tammes13():
    data = json.loads((EXAMPLES / "tammes13.json").read_text())
    return np.array(data["points"]), [tuple(e) for e in data["edges"]], data
