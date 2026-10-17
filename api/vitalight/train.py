"""Train the VitaLight multifactorial risk model on a simulated cohort.

    python -m vitalight.train            # writes models/vitalight-model.json

Served model: one log-linear Poisson regression per condition ("modified Poisson" for binary outcomes, a
standard epidemiology tool). exp(coef) is directly a relative risk, which is exactly what the report shows
as factor bars, so the explanation is the model itself rather than a post-hoc approximation.

Benchmarks on the same held-out population cohort:
- logistic regression (same features),
- histogram gradient boosting (non-linear, captures interactions, not directly explainable),
- the hand-written rule engine (src/lib/model.ts),
- the oracle (true simulated risk, an upper bound no model can beat).

The artifact is plain JSON (no pickle): coefficients, metrics and calibration, readable by humans and safe
to load.
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression, PoissonRegressor
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score

from .features import FEATURES
from .simulate import cohort

from .ml import ARTIFACT
CAPS = {"asthma": 0.6, "eczema": 0.6, "t1d": 0.3, "chd": 0.25}

# The rule engine is itself a fixed log-linear model on the same features: base, {feature: RR}.
RULES = {
    "asthma": (0.08, {"m_asthma": 2.0, "f_asthma": 1.7, "par_eczema": 1.25, "fh_asthma": 1.15,
                      "smoke_preg": 1.4, "smoke_home": 1.2}),
    "eczema": (0.15, {"m_eczema": 1.8, "f_eczema": 1.6, "par_asthma": 1.2, "fh_eczema": 1.1}),
    "t1d": (0.004, {"f_t1d": 15, "m_t1d": 8, "fh_t1d": 1.8}),
    "chd": (0.008, {"m_chd": 5, "f_chd": 3, "mat_diabetes": 3.5, "consanguinity": 2, "fh_chd": 1.5,
                    "ivf": 1.3, "smoke_preg": 1.2}),
}  # fmt: skip


def scores(y: np.ndarray, p: np.ndarray) -> dict[str, float]:
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return {
        "auc": round(float(roc_auc_score(y, p)), 4),
        "brier": round(float(brier_score_loss(y, p)), 6),
        "logLoss": round(float(log_loss(y, p)), 5),
        "meanPredicted": round(float(p.mean()), 5),
        "observedRate": round(float(y.mean()), 5),
    }


def calibration(y: np.ndarray, p: np.ndarray, bins: int = 10) -> list[dict[str, float]]:
    """Observed vs predicted by risk decile (quantile bins)."""
    order = np.argsort(p)
    out = []
    for chunk in np.array_split(order, bins):
        out.append({"predicted": round(float(p[chunk].mean()), 5), "observed": round(float(y[chunk].mean()), 5)})
    return out


def train(n_train: int, n_test: int, seed: int) -> dict:
    x_tr, _, y_tr = cohort(n_train, seed, enriched=True)
    x_te, p_te, y_te = cohort(n_test, seed + 1, enriched=False)

    conditions: dict[str, dict] = {}
    metrics: dict[str, dict] = {}
    for cid, feats in FEATURES.items():
        Xtr = x_tr[feats].to_numpy(dtype=float)
        Xte = x_te[feats].to_numpy(dtype=float)
        ytr, yte = y_tr[cid].to_numpy(), y_te[cid].to_numpy()
        wtr = x_tr["weight"].to_numpy()

        glm = PoissonRegressor(alpha=0, max_iter=1000).fit(Xtr, ytr, sample_weight=wtr)
        p_glm = np.minimum(glm.predict(Xte), CAPS[cid])

        logit = LogisticRegression(C=1e4, max_iter=2000).fit(Xtr, ytr, sample_weight=wtr)
        p_logit = logit.predict_proba(Xte)[:, 1]

        gbm = HistGradientBoostingClassifier(max_iter=200, learning_rate=0.08, random_state=seed).fit(Xtr, ytr, sample_weight=wtr)
        p_gbm = gbm.predict_proba(Xte)[:, 1]

        base, rr = RULES[cid]
        p_rules = np.full(len(Xte), base)
        for feat, r in rr.items():
            p_rules *= np.where(x_te[feat].to_numpy(), r, 1.0)
        p_rules = np.minimum(p_rules, CAPS[cid])

        conditions[cid] = {
            "intercept": round(float(glm.intercept_), 6),
            "coefs": {f: round(float(c), 6) for f, c in zip(feats, glm.coef_)},
            "cap": CAPS[cid],
        }
        metrics[cid] = {
            "positivesTrain": int(ytr.sum()),
            "positivesTest": int(yte.sum()),
            "model": scores(yte, p_glm),
            "logistic": scores(yte, p_logit),
            "gradientBoosting": scores(yte, p_gbm),
            "rules": scores(yte, p_rules),
            "oracle": scores(yte, p_te[cid].to_numpy()),
            "calibration": calibration(yte, p_glm),
            "relativeRisks": {f: round(math.exp(c), 3) for f, c in zip(feats, glm.coef_)},
        }
        m = metrics[cid]
        print(
            f"{cid:7s} AUC model {m['model']['auc']:.3f} | logit {m['logistic']['auc']:.3f} | "
            f"gbm {m['gradientBoosting']['auc']:.3f} | rules {m['rules']['auc']:.3f} | oracle {m['oracle']['auc']:.3f}"
            f"   Brier model {m['model']['brier']:.5f} vs rules {m['rules']['brier']:.5f}"
        )

    now = datetime.now(timezone.utc)
    return {
        "version": f"vl-{now:%Y.%m.%d}-poisson",
        "trainedAt": now.isoformat(timespec="seconds"),
        "algorithm": "Log-linear Poisson regression per condition (scikit-learn PoissonRegressor)",
        "explanation": "exp(coefficient) = relative risk of each factor; risk = exp(intercept + sum of active coefficients)",
        "data": {
            "source": "Simulated synthetic cohort (vitalight.simulate). No real patient data.",
            "trainSize": n_train,
            "trainSampling": "exposure-enriched, importance-weighted back to population prevalence",
            "testSize": n_test,
            "testSampling": "population prevalence",
            "seed": seed,
        },
        "conditions": conditions,
        "metrics": metrics,
        "geneticsNote": "Cystic fibrosis, sickle cell and trisomy 21 use exact Mendelian / maternal-age rules, not learned.",
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--n-train", type=int, default=1_500_000)
    ap.add_argument("--n-test", type=int, default=400_000)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", type=Path, default=ARTIFACT)
    args = ap.parse_args()
    card = train(args.n_train, args.n_test, args.seed)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(card, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {args.out} ({card['version']})")


if __name__ == "__main__":
    main()
