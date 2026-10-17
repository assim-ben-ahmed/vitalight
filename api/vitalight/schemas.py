"""API contract. Mirrors the TypeScript types in src/lib/model.ts field for field."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ConditionId = Literal["asthma", "eczema", "t1d", "chd", "cf", "scd", "chromo"]
CarrierId = Literal["cf", "scd"]
Level = Literal["low", "moderate", "elevated", "high"]
Status = Literal["new", "pending", "reviewed"]


class Text(BaseModel):
    en: str
    fr: str


def txt(en: str, fr: str) -> Text:
    return Text(en=en, fr=fr)


class ParentProfile(BaseModel):
    age: int = Field(ge=12, le=80)
    conditions: list[ConditionId] = []
    carriers: list[CarrierId] = []
    familyHistory: list[ConditionId] = []
    smoker: bool = False


class Pregnancy(BaseModel):
    weeks: int = Field(ge=1, le=45)
    consanguinity: bool = False
    preexistingDiabetes: bool = False
    gestationalDiabetes: bool = False
    smokingDuringPregnancy: bool = False
    ivf: bool = False


class FamilyInput(BaseModel):
    """What a clinician submits. The server assigns id, dates and status."""

    name: str = Field(min_length=1, max_length=80)
    clinician: str = Field(min_length=1, max_length=80)
    dueDate: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    consent: bool = False
    mother: ParentProfile
    father: ParentProfile
    pregnancy: Pregnancy


class Factor(BaseModel):
    label: Text
    rr: float


class ConditionResult(BaseModel):
    id: ConditionId
    risk: float
    baseline: float
    rr: float
    level: Level
    factors: list[Factor]
    recommendations: list[Text]
    method: Literal["ml", "genetic", "rules"] = "rules"


class Assessment(BaseModel):
    modelVersion: str
    createdAt: str
    results: list[ConditionResult]


class Family(BaseModel):
    id: str
    name: str
    clinician: str
    createdAt: str
    dueDate: str
    status: Status
    consent: bool = True
    mother: ParentProfile
    father: ParentProfile
    pregnancy: Pregnancy
    assessment: Assessment | None = None


class LoginInput(BaseModel):
    email: str
    password: str


class User(BaseModel):
    email: str
    name: str
    initials: str
    role: str


class LoginOutput(BaseModel):
    token: str
    user: User


class AuditEntry(BaseModel):
    ts: str
    user: str
    action: str
    familyId: str | None
    detail: str | None
