import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

SAMPLES = ROOT / "data" / "samples"


def _items(name: str) -> list[dict]:
    return json.loads((SAMPLES / name).read_text())


ALL_SAMPLES = _items("index.json") + _items("extra.json")
CLEAN = [s for s in ALL_SAMPLES if not s["tampered"]]
TAMPERED = [s for s in ALL_SAMPLES if s["tampered"]]


def load(sample: dict):
    from engine.parse import parse_upload

    return parse_upload(sample["file"], (SAMPLES / sample["file"]).read_bytes())


@pytest.fixture(scope="session")
def ravi():
    sample = next(s for s in ALL_SAMPLES if s["id"] == "ravi_gig")
    return load(sample)
