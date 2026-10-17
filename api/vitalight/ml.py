"""Serving: trained model for multifactorial conditions + exact genetics rules, same output contract."""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

from . import engine
from .features import LABELS, extract
from .schemas import ConditionResult, Factor, FamilyInput

ARTIFACT = Path(__file__).resolve().parent.parent / "models" / "vitalight-model.json"

# Effects weaker than ×1.05 either way are not shown as factors (they still count in the risk).
MIN_EFFECT = math.log(1.05)
RULES_VERSION = "rules-1.0"


@lru_cache(maxsize=1)
def load_card(path: Path = ARTIFACT) -> dict | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def model_version() -> str:
    card = load_card()
    return card["version"] if card else RULES_VERSION


def predict(f: FamilyInput) -> list[ConditionResult]:
    card = load_card()
    if card is None:  # no artifact: fall back to the reference rule engine
        return engine.assess_rules(f)
    x = extract(f)
    out: list[ConditionResult] = []
    for cid in engine.MULTIFACTORIAL:
        m = card["conditions"][cid]
        eta = m["intercept"] + sum(c * x[feat] for feat, c in m["coefs"].items())
        risk = min(math.exp(eta), m["cap"])
        factors = [
            Factor(label=LABELS[feat], rr=math.exp(c))
            for feat, c in m["coefs"].items()
            if x[feat] and abs(c) >= MIN_EFFECT
        ]
        out.append(engine.make_result(cid, risk, factors, "ml"))
    return out + engine.genetics(f)
