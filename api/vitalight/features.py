"""Feature extraction for the multifactorial conditions.

Each feature is a binary, clinically named indicator, so every learned coefficient maps to one readable
factor in the report (odds ratio = exp(coef)). The same function feeds training and serving, which keeps
the two in sync.
"""

from __future__ import annotations

from .schemas import FamilyInput, Text, txt

# feature id -> label shown to clinicians
LABELS: dict[str, Text] = {
    "m_asthma": txt("Mother has asthma", "Mère asthmatique"),
    "f_asthma": txt("Father has asthma", "Père asthmatique"),
    "m_eczema": txt("Mother has atopic eczema", "Mère atteinte d’eczéma atopique"),
    "f_eczema": txt("Father has atopic eczema", "Père atteint d’eczéma atopique"),
    "par_eczema": txt("Parental atopic eczema", "Eczéma atopique parental"),
    "par_asthma": txt("Parental asthma", "Asthme parental"),
    "fh_asthma": txt("Asthma in grandparents / siblings", "Asthme chez les grands-parents / la fratrie"),
    "fh_eczema": txt("Eczema in grandparents / siblings", "Eczéma chez les grands-parents / la fratrie"),
    "fh_t1d": txt("T1D in grandparents / siblings", "DT1 chez les grands-parents / la fratrie"),
    "fh_chd": txt("CHD in grandparents / siblings", "Cardiopathie chez les grands-parents / la fratrie"),
    "m_t1d": txt("Mother has type 1 diabetes", "Mère atteinte de diabète de type 1"),
    "f_t1d": txt("Father has type 1 diabetes", "Père atteint de diabète de type 1"),
    "m_chd": txt("Mother born with a heart defect", "Mère née avec une cardiopathie"),
    "f_chd": txt("Father born with a heart defect", "Père né avec une cardiopathie"),
    "mat_diabetes": txt("Maternal pre-existing diabetes", "Diabète maternel préexistant"),
    "gdm": txt("Gestational diabetes", "Diabète gestationnel"),
    "consanguinity": txt("Consanguinity", "Consanguinité"),
    "ivf": txt("Assisted conception (IVF)", "Procréation médicalement assistée (FIV)"),
    "smoke_preg": txt("Smoking during pregnancy", "Tabac pendant la grossesse"),
    "smoke_home": txt("Smoker in the household", "Fumeur au domicile"),
    "mat_age_40": txt("Maternal age 40+", "Âge maternel ≥ 40 ans"),
}

# Features offered to each condition's model. Deliberately generous: the model decides what matters,
# and near-null effects are hidden from the report (see ml.MIN_EFFECT).
FEATURES: dict[str, list[str]] = {
    "asthma": ["m_asthma", "f_asthma", "par_eczema", "fh_asthma", "smoke_preg", "smoke_home", "gdm", "ivf"],
    "eczema": ["m_eczema", "f_eczema", "par_asthma", "fh_eczema", "smoke_preg", "ivf"],
    "t1d": ["f_t1d", "m_t1d", "fh_t1d", "gdm", "ivf"],
    "chd": ["m_chd", "f_chd", "mat_diabetes", "consanguinity", "fh_chd", "ivf", "smoke_preg", "gdm", "mat_age_40"],
}


def extract(f: FamilyInput) -> dict[str, int]:
    m, d, p = f.mother, f.father, f.pregnancy
    any_smoker = m.smoker or d.smoker
    x = {
        "m_asthma": "asthma" in m.conditions,
        "f_asthma": "asthma" in d.conditions,
        "m_eczema": "eczema" in m.conditions,
        "f_eczema": "eczema" in d.conditions,
        "par_eczema": "eczema" in m.conditions or "eczema" in d.conditions,
        "par_asthma": "asthma" in m.conditions or "asthma" in d.conditions,
        "fh_asthma": "asthma" in m.familyHistory or "asthma" in d.familyHistory,
        "fh_eczema": "eczema" in m.familyHistory or "eczema" in d.familyHistory,
        "fh_t1d": "t1d" in m.familyHistory or "t1d" in d.familyHistory,
        "fh_chd": "chd" in m.familyHistory or "chd" in d.familyHistory,
        "m_t1d": "t1d" in m.conditions,
        "f_t1d": "t1d" in d.conditions,
        "m_chd": "chd" in m.conditions,
        "f_chd": "chd" in d.conditions,
        "mat_diabetes": p.preexistingDiabetes or "t1d" in m.conditions,
        "gdm": p.gestationalDiabetes,
        "consanguinity": p.consanguinity,
        "ivf": p.ivf,
        "smoke_preg": p.smokingDuringPregnancy,
        # household smoke only counts when the mother is not already smoking during pregnancy
        "smoke_home": any_smoker and not p.smokingDuringPregnancy,
        "mat_age_40": m.age >= 40,
    }
    return {k: int(v) for k, v in x.items()}
