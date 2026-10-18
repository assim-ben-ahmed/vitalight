"""Demo data: clinician accounts and the 8 fictional families from src/data/families.ts. No real patients."""

from __future__ import annotations

import os

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import hash_password
from .db import AssessmentRow, FamilyRow, UserRow
from .ml import model_version, predict
from .schemas import FamilyInput

DEMO_PASSWORD = os.environ.get("VITALIGHT_DEMO_PASSWORD", "vitalight-demo")

# role is a key the frontend translates (shell.roles in src/i18n/strings.ts)
USERS = [
    ("l.moreau@vitalight.demo", "Dr. L. Moreau", "LM", "obstetrics"),
    ("s.haddad@vitalight.demo", "Dr. S. Haddad", "SH", "paediatrics"),
    ("a.petit@vitalight.demo", "Dr. A. Petit", "AP", "midwifery"),
]


def _parent(age: int, **kw) -> dict:
    return {"age": age, "conditions": [], "carriers": [], "familyHistory": [], "smoker": False, **kw}


def _preg(weeks: int, **kw) -> dict:
    base = dict(consanguinity=False, preexistingDiabetes=False, gestationalDiabetes=False,
                smokingDuringPregnancy=False, ivf=False)  # fmt: skip
    return {"weeks": weeks, **base, **kw}


FAMILIES = [
    ("VL-1042", "Martin", "Dr. L. Moreau", "2026-10-15", "2027-02-08", "pending",
     _parent(34, conditions=["asthma"], carriers=["cf"], familyHistory=["eczema"]),
     _parent(36, conditions=["eczema"], carriers=["cf"]), _preg(22)),
    ("VL-1039", "Benali", "Dr. S. Haddad", "2026-10-13", "2027-03-21", "reviewed",
     _parent(29, familyHistory=["t1d"]), _parent(31, conditions=["t1d"]), _preg(16)),
    ("VL-1037", "Dubois", "Dr. L. Moreau", "2026-10-11", "2027-01-30", "reviewed",
     _parent(41, familyHistory=["chd"]), _parent(44), _preg(23, ivf=True)),
    ("VL-1036", "Nguyen", "Dr. A. Petit", "2026-10-10", "2027-04-02", "reviewed",
     _parent(27), _parent(30), _preg(14)),
    ("VL-1033", "Diallo", "Dr. S. Haddad", "2026-10-08", "2027-02-19", "pending",
     _parent(32, carriers=["scd"]), _parent(35, conditions=["asthma"]), _preg(21)),
    ("VL-1030", "Rossi", "Dr. A. Petit", "2026-10-06", "2027-03-04", "reviewed",
     _parent(33, conditions=["t1d", "chd"]), _parent(34, smoker=True), _preg(18, preexistingDiabetes=True)),
    ("VL-1028", "Lefèvre", "Dr. L. Moreau", "2026-10-03", "2027-01-12", "reviewed",
     _parent(30, conditions=["eczema"]), _parent(32, conditions=["asthma"]), _preg(26)),
    ("VL-1025", "Haddou", "Dr. S. Haddad", "2026-09-29", "2027-02-27", "reviewed",
     _parent(26), _parent(28), _preg(20, consanguinity=True)),
]  # fmt: skip


def seed(s: Session) -> None:
    if s.scalar(select(UserRow).limit(1)) is None:
        for email, name, initials, role in USERS:
            s.add(UserRow(email=email, name=name, initials=initials, role=role,
                          password_hash=hash_password(DEMO_PASSWORD)))  # fmt: skip
    if s.scalar(select(FamilyRow).limit(1)) is None:
        for fid, name, clin, created, due, status, mother, father, preg in FAMILIES:
            inp = FamilyInput(name=name, clinician=clin, dueDate=due, consent=True,
                              mother=mother, father=father, pregnancy=preg)  # fmt: skip
            row = FamilyRow(id=fid, name=name, clinician=clin, created_at=created, due_date=due, status=status,
                            consent=True, mother=mother, father=father, pregnancy=preg, created_by="seed")  # fmt: skip
            row.assessments.append(
                AssessmentRow(model_version=model_version(), results=[r.model_dump() for r in predict(inp)])
            )
            s.add(row)
    s.commit()
