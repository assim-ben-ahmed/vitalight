"""Synthetic cohort simulator: the "ground truth" the model is trained against.

No real patient data exists for this project, so we simulate families and newborn outcomes. The simulator
is intentionally richer than the rule engine and than what the model can see:
- interactions (two atopic parents add more than the product of each; diabetes x heart defect),
- unobserved family-level heterogeneity (log-normal frailty shared across the atopic conditions),
- weak effects that the rule engine ignores (gestational diabetes, maternal age 40+ for CHD),
- realistic exposure prevalences, with an optional enrichment so rare exposures are seen often enough.

The model therefore has to *estimate* effects from noisy binary outcomes, and its quality is measured on a
held-out cohort drawn at population prevalence. Effect sizes are rounded orders of magnitude from public
literature; this is a teaching cohort, not epidemiology.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# Population prevalence of each exposure (approximate, adults of childbearing age in Europe).
PREVALENCE = {
    "m_asthma": 0.09, "f_asthma": 0.08, "m_eczema": 0.10, "f_eczema": 0.08,
    "fh_asthma": 0.20, "fh_eczema": 0.20, "fh_t1d": 0.04, "fh_chd": 0.05,
    "m_t1d": 0.005, "f_t1d": 0.006, "m_chd": 0.008, "f_chd": 0.008,
    "preexisting_t2d": 0.01, "gdm": 0.10, "consanguinity": 0.02, "ivf": 0.035,
    "smoke_preg": 0.12, "m_smoker": 0.18, "f_smoker": 0.25,
}  # fmt: skip

# Enriched prevalence used for the training cohort (P(y|x) is unchanged by sampling on x).
ENRICHED = {k: max(v, 0.15) for k, v in PREVALENCE.items()}


def sample_exposures(n: int, rng: np.random.Generator, prevalence: dict[str, float]) -> pd.DataFrame:
    df = pd.DataFrame({k: rng.random(n) < p for k, p in prevalence.items()})
    # Importance weight back to the population: enriched rows with many exposures count for less, so the
    # fit targets the population distribution (otherwise co-occurring strong factors hit the risk caps
    # far more often than in reality and bias the coefficients).
    w = np.ones(n)
    for k, p in prevalence.items():
        q = PREVALENCE[k]
        w *= np.where(df[k], q / p, (1 - q) / (1 - p))
    df["weight"] = w / w.mean()
    df["smoke_preg"] &= df["m_smoker"] | (rng.random(n) < 0.3)  # mostly mothers who smoke
    df["m_age"] = np.clip(rng.normal(31, 5.5, n), 18, 49).round()
    # features as seen by the model (same definitions as features.extract)
    df["par_eczema"] = df.m_eczema | df.f_eczema
    df["par_asthma"] = df.m_asthma | df.f_asthma
    df["mat_diabetes"] = df.preexisting_t2d | df.m_t1d
    df["smoke_home"] = (df.m_smoker | df.f_smoker) & ~df.smoke_preg
    df["mat_age_40"] = df.m_age >= 40
    return df


def true_risks(df: pd.DataFrame, rng: np.random.Generator) -> pd.DataFrame:
    n = len(df)
    b = lambda c: df[c].to_numpy().astype(float)  # noqa: E731
    rr = lambda c, r: np.where(df[c].to_numpy(), r, 1.0)  # noqa: E731
    # Shared atopic frailty: unobserved (diet, microbiome, environment), mean 1.
    atopy = rng.lognormal(-0.5 * 0.35**2, 0.35, n)

    both_atopic = (b("m_asthma") + b("m_eczema") > 0) & (b("f_asthma") + b("f_eczema") > 0)
    asthma = (
        0.065 * atopy * rr("m_asthma", 2.1) * rr("f_asthma", 1.7) * rr("par_eczema", 1.3) * rr("fh_asthma", 1.15)
        * rr("smoke_preg", 1.45) * rr("smoke_home", 1.2) * rr("gdm", 1.08) * np.where(both_atopic, 1.2, 1.0)
    )
    eczema = (
        0.13 * atopy * rr("m_eczema", 1.9) * rr("f_eczema", 1.6) * rr("par_asthma", 1.2) * rr("fh_eczema", 1.1)
        * np.where(both_atopic, 1.15, 1.0)
    )
    t1d = 0.0035 * rr("f_t1d", 15) * rr("m_t1d", 7) * rr("fh_t1d", 1.9) * rr("gdm", 1.1)
    chd = (
        0.0075 * rr("m_chd", 5) * rr("f_chd", 3) * rr("mat_diabetes", 3.3) * rr("consanguinity", 2.1)
        * rr("fh_chd", 1.5) * rr("ivf", 1.35) * rr("smoke_preg", 1.25) * rr("gdm", 1.1) * rr("mat_age_40", 1.3)
        * np.where(b("mat_diabetes") * b("m_chd") > 0, 1.3, 1.0)
    )  # fmt: skip
    return pd.DataFrame(
        {
            "asthma": np.minimum(asthma, 0.7),
            "eczema": np.minimum(eczema, 0.7),
            "t1d": np.minimum(t1d, 0.4),
            "chd": np.minimum(chd, 0.35),
        }
    )


def cohort(n: int, seed: int, enriched: bool) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Returns (exposures, true risk, observed outcome) for n simulated families."""
    rng = np.random.default_rng(seed)
    x = sample_exposures(n, rng, ENRICHED if enriched else PREVALENCE)
    p = true_risks(x, rng)
    y = pd.DataFrame({c: rng.random(n) < p[c] for c in p.columns}).astype(int)
    return x, p, y
