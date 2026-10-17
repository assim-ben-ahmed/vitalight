"""Rule engine parity with src/lib/model.ts, and sanity checks on the trained model."""

import json
from pathlib import Path

import pytest

from vitalight import engine, ml
from vitalight.schemas import FamilyInput

GOLDEN = json.loads((Path(__file__).parent / "golden_rules.json").read_text(encoding="utf-8"))


def to_input(f: dict) -> FamilyInput:
    return FamilyInput(name=f["name"], clinician=f["clinician"], dueDate=f["dueDate"], consent=True,
                       mother=f["mother"], father=f["father"], pregnancy=f["pregnancy"])  # fmt: skip


@pytest.mark.parametrize("case", GOLDEN, ids=[c["family"]["id"] for c in GOLDEN])
def test_python_rules_match_typescript(case):
    py = engine.assess_rules(to_input(case["family"]))
    ts = case["results"]
    assert [r.id for r in py] == [r["id"] for r in ts]
    for p, t in zip(py, ts):
        assert p.risk == pytest.approx(t["risk"], rel=1e-9), p.id
        assert p.baseline == pytest.approx(t["baseline"], rel=1e-9)
        assert p.level == t["level"], p.id
        assert [f.label.model_dump() for f in p.factors] == [f["label"] for f in t["factors"]], p.id
        assert [f.rr for f in p.factors] == pytest.approx([f["rr"] for f in t["factors"]])
        assert [r.model_dump() for r in p.recommendations] == t["recommendations"], p.id


def family(**kw) -> FamilyInput:
    p = lambda age, **x: {"age": age, **x}  # noqa: E731
    return FamilyInput(name="T", clinician="Dr. T", dueDate="2027-01-01", consent=True,
                       mother=kw.get("mother", p(30)), father=kw.get("father", p(32)),
                       pregnancy=kw.get("pregnancy", {"weeks": 20}))  # fmt: skip


def by_id(results):
    return {r.id: r for r in results}


def test_trained_model_is_loaded():
    assert ml.load_card() is not None
    assert ml.model_version().startswith("vl-")


def test_no_risk_factor_family_is_low_everywhere():
    res = ml.predict(family())
    assert all(r.level == "low" for r in res)
    assert {r.method for r in res} == {"ml", "genetic"}


def test_model_learns_paternal_t1d_as_strongest_t1d_factor():
    r = by_id(ml.predict(family(father={"age": 32, "conditions": ["t1d"]})))["t1d"]
    assert r.level == "high"
    assert 8 < r.factors[0].rr < 25  # simulated truth is x15
    assert r.factors[0].label.en == "Father has type 1 diabetes"


def test_ml_effects_are_monotonic_for_asthma():
    none = by_id(ml.predict(family()))["asthma"].risk
    one = by_id(ml.predict(family(mother={"age": 30, "conditions": ["asthma"]})))["asthma"].risk
    both = by_id(ml.predict(family(mother={"age": 30, "conditions": ["asthma"]},
                                   father={"age": 32, "conditions": ["asthma"]})))["asthma"].risk  # fmt: skip
    assert none < one < both <= 0.6


def test_genetics_stay_exact_when_both_parents_carry():
    res = by_id(ml.predict(family(mother={"age": 30, "carriers": ["cf"]}, father={"age": 32, "carriers": ["cf"]})))
    assert res["cf"].risk == pytest.approx(0.25)
    assert res["cf"].method == "genetic"
    assert res["cf"].level == "high"


def test_trisomy_follows_maternal_age_table():
    assert engine.t21_by_age(35) == pytest.approx(1 / 350)
    assert engine.t21_by_age(18) == pytest.approx(1 / 1500)
    assert engine.t21_by_age(50) == pytest.approx(1 / 15)


def test_model_card_beats_or_matches_rules_on_held_out_data():
    card = ml.load_card()
    for cid, m in card["metrics"].items():
        assert m["model"]["auc"] >= m["rules"]["auc"] - 0.005, cid
        assert m["model"]["brier"] <= m["rules"]["brier"] * 1.01, cid
        # calibration-in-the-large within 15 % on the population cohort
        assert m["model"]["meanPredicted"] == pytest.approx(m["model"]["observedRate"], rel=0.15), cid
