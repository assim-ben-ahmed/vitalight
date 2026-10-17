"""Reference rule engine: a faithful Python port of src/lib/model.ts.

Two jobs:
- genetics (cystic fibrosis, sickle cell, trisomy 21) is always computed here, because Mendelian carrier
  probabilities and maternal-age tables are known exactly and should not be learned from data;
- it is the fallback for the multifactorial conditions when no trained model artifact is available.

Figures are rounded orders of magnitude from public literature, for illustration only.
"""

from __future__ import annotations

import math

from .schemas import ConditionId, ConditionResult, Factor, FamilyInput, Level, ParentProfile, Text, txt

MULTI = txt("Multifactorial", "Multifactorielle")
RECESSIVE = txt("Genetic · recessive", "Génétique · récessive")

CONDITIONS: dict[str, dict] = {
    "asthma": {
        "name": txt("Childhood asthma", "Asthme de l’enfant"),
        "category": MULTI,
        "baseline": 0.08,
    },
    "eczema": {"name": txt("Atopic eczema", "Eczéma atopique"), "category": MULTI, "baseline": 0.15},
    "t1d": {
        "name": txt("Type 1 diabetes", "Diabète de type 1"),
        "category": txt("Autoimmune", "Auto-immune"),
        "baseline": 0.004,
    },
    "chd": {
        "name": txt("Congenital heart defect", "Cardiopathie congénitale"),
        "category": txt("Structural", "Structurelle"),
        "baseline": 0.008,
    },
    "cf": {"name": txt("Cystic fibrosis", "Mucoviscidose"), "category": RECESSIVE, "baseline": 0.0004},
    "scd": {"name": txt("Sickle cell disease", "Drépanocytose"), "category": RECESSIVE, "baseline": 0.0003},
    "chromo": {
        "name": txt("Trisomy 21", "Trisomie 21"),
        "category": txt("Chromosomal", "Chromosomique"),
        "baseline": 1 / 700,
    },
}

CONDITION_ORDER: list[ConditionId] = ["asthma", "eczema", "t1d", "chd", "cf", "scd", "chromo"]
MULTIFACTORIAL: list[ConditionId] = ["asthma", "eczema", "t1d", "chd"]
CARRIER_POPULATION = {"cf": 1 / 25, "scd": 1 / 30}


def has(p: ParentProfile, c: str) -> bool:
    return c in p.conditions


def fam(p: ParentProfile, c: str) -> bool:
    return c in p.familyHistory


def level_of(risk: float, rr: float) -> Level:
    if (rr >= 10 and risk >= 0.01) or (rr >= 4 and risk >= 0.25):
        return "high"
    if rr >= 2.5:
        return "elevated"
    if rr >= 1.2:
        return "moderate"
    return "low"


SMOKE_FREE = txt("Smoke-free home and car from birth", "Domicile et voiture sans tabac dès la naissance")
EMOLLIENT = txt("Daily emollient from birth", "Émollient quotidien dès la naissance")
T1D_SIGNS = txt("Educate parents on early T1D signs", "Informer les parents des signes précoces du DT1")
FETAL_ECHO = txt("Fetal echocardiography around 20–22 weeks", "Échocardiographie fœtale vers 20–22 semaines")
COUNSELLING = txt("Genetic counselling", "Conseil génétique")
COUNSELLING_NOW = txt("Genetic counselling now", "Conseil génétique dès maintenant")
PRENATAL_DX = txt("Discuss prenatal diagnosis options", "Discuter des options de diagnostic prénatal")
CFDNA = txt("Offer cell-free DNA testing", "Proposer le dépistage par ADN libre circulant")
ROUTINE = txt("Routine care, no specific action", "Suivi habituel, aucune action spécifique")

RECS: dict[str, dict[str, list[Text]]] = {
    "asthma": {
        "moderate": [
            txt("Encourage a smoke-free home", "Encourager un domicile sans tabac"),
            txt(
                "Discuss breastfeeding benefits at the next visit",
                "Aborder les bénéfices de l’allaitement à la prochaine consultation",
            ),
        ],
        "elevated": [SMOKE_FREE, txt("Respiratory follow-up at 6 and 12 months", "Suivi respiratoire à 6 et 12 mois")],
        "high": [
            txt(
                "Early paediatric pulmonology referral if wheezing appears",
                "Orientation précoce en pneumopédiatrie en cas de sifflements",
            ),
            SMOKE_FREE,
        ],
    },
    "eczema": {
        "moderate": [
            txt(
                "Daily emollient advice from the first weeks",
                "Conseiller un émollient quotidien dès les premières semaines",
            )
        ],
        "elevated": [
            EMOLLIENT,
            txt(
                "Discuss early allergen introduction with the paediatrician",
                "Aborder l’introduction précoce des allergènes avec le pédiatre",
            ),
        ],
        "high": [
            EMOLLIENT,
            txt(
                "Paediatric allergy consultation in the first year",
                "Consultation d’allergologie pédiatrique la première année",
            ),
        ],
    },
    "t1d": {
        "moderate": [
            txt(
                "Inform parents of early T1D signs (thirst, weight loss)",
                "Informer les parents des signes précoces du DT1 (soif, perte de poids)",
            )
        ],
        "elevated": [
            txt(
                "Offer islet autoantibody screening in early childhood",
                "Proposer un dépistage des auto-anticorps anti-îlots dans la petite enfance",
            ),
            T1D_SIGNS,
        ],
        "high": [
            txt("Refer to a T1D risk-screening programme", "Orienter vers un programme de dépistage du risque de DT1"),
            T1D_SIGNS,
        ],
    },
    "chd": {
        "moderate": [
            txt(
                "Standard pulse-oximetry screening at birth",
                "Dépistage standard par oxymétrie de pouls à la naissance",
            )
        ],
        "elevated": [FETAL_ECHO, txt("Pulse-oximetry screening at birth", "Oxymétrie de pouls à la naissance")],
        "high": [
            FETAL_ECHO,
            txt(
                "Plan delivery in a centre with paediatric cardiology",
                "Prévoir l’accouchement dans un centre avec cardiologie pédiatrique",
            ),
        ],
    },
    "cf": {
        "moderate": [
            txt("Offer carrier testing to the untested parent", "Proposer un test de porteur au parent non testé")
        ],
        "elevated": [txt("Carrier testing for both parents", "Test de porteur pour les deux parents"), COUNSELLING],
        "high": [
            COUNSELLING_NOW,
            PRENATAL_DX,
            txt(
                "Ensure newborn screening result is followed up",
                "Assurer le suivi du résultat du dépistage néonatal",
            ),
        ],
    },
    "scd": {
        "moderate": [
            txt(
                "Offer haemoglobinopathy screening to the untested parent",
                "Proposer un dépistage des hémoglobinopathies au parent non testé",
            )
        ],
        "elevated": [
            txt(
                "Haemoglobinopathy screening for both parents",
                "Dépistage des hémoglobinopathies pour les deux parents",
            ),
            COUNSELLING,
        ],
        "high": [
            COUNSELLING_NOW,
            PRENATAL_DX,
            txt("Haematology follow-up from birth", "Suivi en hématologie dès la naissance"),
        ],
    },
    "chromo": {
        "moderate": [
            txt(
                "Combined first-trimester screening (standard of care)",
                "Dépistage combiné du premier trimestre (prise en charge standard)",
            )
        ],
        "elevated": [txt("Combined first-trimester screening", "Dépistage combiné du premier trimestre"), CFDNA],
        "high": [
            CFDNA,
            txt("Genetic counselling on diagnostic options", "Conseil génétique sur les options diagnostiques"),
        ],
    },
}

SMOKING_PREG = txt("Smoking during pregnancy", "Tabac pendant la grossesse")
CONSANGUINITY = txt("Consanguinity", "Consanguinité")


def make_result(cid: ConditionId, risk: float, factors: list[Factor], method: str) -> ConditionResult:
    baseline = CONDITIONS[cid]["baseline"]
    rr = risk / baseline
    level = level_of(risk, rr)
    return ConditionResult(
        id=cid,
        risk=risk,
        baseline=baseline,
        rr=rr,
        level=level,
        factors=sorted(factors, key=lambda f: -f.rr),
        recommendations=RECS[cid].get(level, [ROUTINE]),
        method=method,  # type: ignore[arg-type]
    )


def _multiplicative(base: float, factors: list[Factor], cap: float) -> float:
    return min(base * math.prod(f.rr for f in factors), cap)


# ---------------------------------------------------------------- multifactorial (rule fallback)


def rules_multifactorial(f: FamilyInput) -> dict[str, tuple[float, list[Factor]]]:
    m, d, p = f.mother, f.father, f.pregnancy
    out: dict[str, tuple[float, list[Factor]]] = {}

    fs: list[Factor] = []
    if has(m, "asthma"):
        fs.append(Factor(label=txt("Mother has asthma", "Mère asthmatique"), rr=2.0))
    if has(d, "asthma"):
        fs.append(Factor(label=txt("Father has asthma", "Père asthmatique"), rr=1.7))
    if has(m, "eczema") or has(d, "eczema"):
        fs.append(Factor(label=txt("Parental atopic eczema", "Eczéma atopique parental"), rr=1.25))
    if fam(m, "asthma") or fam(d, "asthma"):
        fs.append(
            Factor(label=txt("Asthma in grandparents / siblings", "Asthme chez les grands-parents / la fratrie"), rr=1.15)
        )
    if p.smokingDuringPregnancy:
        fs.append(Factor(label=SMOKING_PREG, rr=1.4))
    elif m.smoker or d.smoker:
        fs.append(Factor(label=txt("Smoker in the household", "Fumeur au domicile"), rr=1.2))
    out["asthma"] = (_multiplicative(0.08, fs, 0.6), fs)

    fs = []
    if has(m, "eczema"):
        fs.append(Factor(label=txt("Mother has atopic eczema", "Mère atteinte d’eczéma atopique"), rr=1.8))
    if has(d, "eczema"):
        fs.append(Factor(label=txt("Father has atopic eczema", "Père atteint d’eczéma atopique"), rr=1.6))
    if has(m, "asthma") or has(d, "asthma"):
        fs.append(Factor(label=txt("Parental asthma", "Asthme parental"), rr=1.2))
    if fam(m, "eczema") or fam(d, "eczema"):
        fs.append(
            Factor(label=txt("Eczema in grandparents / siblings", "Eczéma chez les grands-parents / la fratrie"), rr=1.1)
        )
    out["eczema"] = (_multiplicative(0.15, fs, 0.6), fs)

    fs = []
    if has(d, "t1d"):
        fs.append(Factor(label=txt("Father has type 1 diabetes", "Père atteint de diabète de type 1"), rr=15))
    if has(m, "t1d"):
        fs.append(Factor(label=txt("Mother has type 1 diabetes", "Mère atteinte de diabète de type 1"), rr=8))
    if fam(m, "t1d") or fam(d, "t1d"):
        fs.append(Factor(label=txt("T1D in grandparents / siblings", "DT1 chez les grands-parents / la fratrie"), rr=1.8))
    out["t1d"] = (_multiplicative(0.004, fs, 0.3), fs)

    fs = []
    if has(m, "chd"):
        fs.append(Factor(label=txt("Mother born with a heart defect", "Mère née avec une cardiopathie"), rr=5))
    if has(d, "chd"):
        fs.append(Factor(label=txt("Father born with a heart defect", "Père né avec une cardiopathie"), rr=3))
    if p.preexistingDiabetes or has(m, "t1d"):
        fs.append(Factor(label=txt("Maternal pre-existing diabetes", "Diabète maternel préexistant"), rr=3.5))
    if p.consanguinity:
        fs.append(Factor(label=CONSANGUINITY, rr=2))
    if fam(m, "chd") or fam(d, "chd"):
        fs.append(
            Factor(label=txt("CHD in grandparents / siblings", "Cardiopathie chez les grands-parents / la fratrie"), rr=1.5)
        )
    if p.ivf:
        fs.append(Factor(label=txt("Assisted conception (IVF)", "Procréation médicalement assistée (FIV)"), rr=1.3))
    if p.smokingDuringPregnancy:
        fs.append(Factor(label=SMOKING_PREG, rr=1.2))
    out["chd"] = (_multiplicative(0.008, fs, 0.25), fs)
    return out


# ---------------------------------------------------------------- genetics (always rule-based)


def _carrier_prob(p: ParentProfile, cid: str, population: float, who: str) -> tuple[float, Text | None]:
    parent = txt("Mother", "Mère") if who == "m" else txt("Father", "Père")

    def lab(en: str, fr_m: str, fr_f: str) -> Text:
        return txt(f"{parent.en}: {en}", f"{parent.fr} : {fr_m if who == 'm' else fr_f}")

    if has(p, cid):
        return 1.0, lab("affected", "atteinte", "atteint")
    if cid in p.carriers:
        return 1.0, lab("confirmed carrier", "porteuse confirmée", "porteur confirmé")
    if fam(p, cid):
        return 0.5, lab("family history", "antécédents familiaux", "antécédents familiaux")
    return population, None


def recessive(f: FamilyInput, cid: str) -> tuple[float, list[Factor]]:
    population = CARRIER_POPULATION[cid]
    pm, sm = _carrier_prob(f.mother, cid, population, "m")
    pf, sf = _carrier_prob(f.father, cid, population, "f")
    factors: list[Factor] = []
    # Consanguinity raises the chance that the second parent shares the variant.
    if f.pregnancy.consanguinity:
        if pm == population:
            pm = min(pm * 4, 0.5)
        if pf == population:
            pf = min(pf * 4, 0.5)
    if sm:
        factors.append(Factor(label=sm, rr=pm / population))
    if sf:
        factors.append(Factor(label=sf, rr=pf / population))
    if f.pregnancy.consanguinity and (pm < 1 or pf < 1):
        factors.append(Factor(label=CONSANGUINITY, rr=4))
    return pm * pf * 0.25, factors


# Approximate trisomy 21 risk at birth by maternal age (log-interpolated).
T21 = [(20, 1 / 1500), (25, 1 / 1250), (30, 1 / 900), (35, 1 / 350), (38, 1 / 175), (40, 1 / 100),
       (42, 1 / 60), (45, 1 / 30), (48, 1 / 15)]  # fmt: skip


def t21_by_age(age: float) -> float:
    if age <= T21[0][0]:
        return T21[0][1]
    for (a0, r0), (a1, r1) in zip(T21, T21[1:]):
        if age <= a1:
            t = (age - a0) / (a1 - a0)
            return math.exp(math.log(r0) + t * (math.log(r1) - math.log(r0)))
    return T21[-1][1]


def trisomy21(f: FamilyInput) -> tuple[float, list[Factor]]:
    m, d = f.mother, f.father
    risk = t21_by_age(m.age)
    fs: list[Factor] = []
    age_rr = risk / CONDITIONS["chromo"]["baseline"]
    if age_rr > 1.05:
        fs.append(Factor(label=txt(f"Maternal age {m.age}", f"Âge maternel : {m.age} ans"), rr=age_rr))
    if d.age >= 45:
        fs.append(Factor(label=txt(f"Paternal age {d.age}", f"Âge paternel : {d.age} ans"), rr=1.15))
        risk *= 1.15
    return risk, fs


def genetics(f: FamilyInput) -> list[ConditionResult]:
    cf = recessive(f, "cf")
    scd = recessive(f, "scd")
    t21 = trisomy21(f)
    return [
        make_result("cf", cf[0], cf[1], "genetic"),
        make_result("scd", scd[0], scd[1], "genetic"),
        make_result("chromo", t21[0], t21[1], "genetic"),
    ]


def assess_rules(f: FamilyInput) -> list[ConditionResult]:
    multi = rules_multifactorial(f)
    return [make_result(c, *multi[c], "rules") for c in MULTIFACTORIAL] + genetics(f)
