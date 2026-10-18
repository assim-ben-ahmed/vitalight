"""VitaLight API.

    uvicorn vitalight.main:app --reload --port 8000     (from api/)

Every route lives under /api. When the built frontend exists in ../dist it is served from /, so one process
runs the whole system.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import __version__
from .auth import clear_failures, current_user, is_locked, issue_token, record_failure, verify_password
from .db import AssessmentRow, AuditRow, FamilyRow, UserRow, audit, get_session, init_db, next_family_id, SessionLocal
from .engine import CONDITIONS, CONDITION_ORDER
from .ml import load_card, model_version, predict
from .schemas import (
    Assessment,
    AuditEntry,
    ConditionResult,
    Family,
    FamilyInput,
    LoginInput,
    LoginOutput,
    User,
)
from .seed import seed

DIST = Path(os.environ.get("VITALIGHT_DIST", Path(__file__).resolve().parents[2] / "dist"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    if os.environ.get("VITALIGHT_SEED", "1") == "1":
        with SessionLocal() as s:
            seed(s)
    yield


app = FastAPI(
    title="VitaLight API",
    version=__version__,
    description="Newborn health-risk estimates from parental history. Synthetic data only, not a medical device.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("VITALIGHT_CORS", "http://localhost:5180,http://127.0.0.1:5180").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------- helpers


def to_user(u: UserRow) -> User:
    return User(email=u.email, name=u.name, initials=u.initials, role=u.role)


def to_family(row: FamilyRow) -> Family:
    last = row.assessments[-1] if row.assessments else None
    return Family(
        id=row.id,
        name=row.name,
        clinician=row.clinician,
        createdAt=row.created_at,
        dueDate=row.due_date,
        status=row.status,  # type: ignore[arg-type]
        consent=row.consent,
        mother=row.mother,  # type: ignore[arg-type]
        father=row.father,  # type: ignore[arg-type]
        pregnancy=row.pregnancy,  # type: ignore[arg-type]
        assessment=Assessment(
            modelVersion=last.model_version,
            createdAt=last.created_at.isoformat(timespec="seconds"),
            results=last.results,  # type: ignore[arg-type]
        )
        if last
        else None,
    )


def get_row(s: Session, fid: str) -> FamilyRow:
    row = s.get(FamilyRow, fid)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Family {fid} not found")
    return row


def run_assessment(inp: FamilyInput) -> AssessmentRow:
    return AssessmentRow(model_version=model_version(), results=[r.model_dump() for r in predict(inp)])


def as_input(row: FamilyRow) -> FamilyInput:
    return FamilyInput(name=row.name, clinician=row.clinician, dueDate=row.due_date, consent=row.consent,
                       mother=row.mother, father=row.father, pregnancy=row.pregnancy)  # type: ignore[arg-type]  # fmt: skip


# ---------------------------------------------------------------- public


@app.get("/api/health")
def health():
    card = load_card()
    return {"status": "ok", "version": __version__, "model": model_version(), "engine": "ml" if card else "rules"}


@app.post("/api/auth/login", response_model=LoginOutput)
def login(body: LoginInput, request: Request, s: Session = Depends(get_session)):
    email = body.email.strip().lower()[:120]
    ip = request.client.host if request.client else "?"
    if is_locked(email, ip):
        audit(s, email, "login-locked", detail=ip)
        s.commit()
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many failed attempts, try again in 15 minutes")
    user = s.get(UserRow, email)
    if user is None or not verify_password(body.password, user.password_hash):
        record_failure(email, ip)
        audit(s, email, "login-failed", detail=ip)
        s.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    clear_failures(email, ip)
    audit(s, user.email, "login")
    s.commit()
    return LoginOutput(token=issue_token(user.email), user=to_user(user))


@app.get("/api/conditions")
def conditions():
    return [{"id": c, **{k: v for k, v in CONDITIONS[c].items()}} for c in CONDITION_ORDER]


@app.get("/api/model")
def model_card():
    """Model card: algorithm, training data, held-out metrics vs. benchmarks, calibration, learned RRs."""
    card = load_card()
    if card is None:
        return {"version": model_version(), "algorithm": "Reference rule engine (no trained artifact found)"}
    return card


# ---------------------------------------------------------------- authenticated


@app.get("/api/me", response_model=User)
def me(user: UserRow = Depends(current_user)):
    return to_user(user)


@app.post("/api/assess", response_model=list[ConditionResult])
def assess(body: FamilyInput, user: UserRow = Depends(current_user), s: Session = Depends(get_session)):
    """Stateless what-if assessment: nothing about the family is stored, only the fact that it ran."""
    audit(s, user.email, "assess-preview")
    s.commit()
    return predict(body)


@app.get("/api/families", response_model=list[Family])
def list_families(user: UserRow = Depends(current_user), s: Session = Depends(get_session)):
    rows = s.scalars(select(FamilyRow).order_by(FamilyRow.created_at.desc(), FamilyRow.id.desc())).all()
    audit(s, user.email, "list-families", detail=f"{len(rows)} files")
    s.commit()
    return [to_family(r) for r in rows]


@app.post("/api/families", response_model=Family, status_code=status.HTTP_201_CREATED)
def create_family(body: FamilyInput, user: UserRow = Depends(current_user), s: Session = Depends(get_session)):
    if not body.consent:
        raise HTTPException(422, "Parental consent is required before processing")
    row = FamilyRow(
        id=next_family_id(s),
        name=body.name.strip(),
        clinician=body.clinician.strip(),
        created_at=date.today().isoformat(),
        due_date=body.dueDate,
        status="pending",
        consent=True,
        mother=body.mother.model_dump(),
        father=body.father.model_dump(),
        pregnancy=body.pregnancy.model_dump(),
        created_by=user.email,
    )
    row.assessments.append(run_assessment(body))
    s.add(row)
    audit(s, user.email, "create", row.id, f"model {model_version()}")
    s.commit()
    return to_family(row)


@app.get("/api/families/{fid}", response_model=Family)
def get_family(fid: str, user: UserRow = Depends(current_user), s: Session = Depends(get_session)):
    row = get_row(s, fid)
    audit(s, user.email, "read", fid)
    s.commit()
    return to_family(row)


@app.post("/api/families/{fid}/review", response_model=Family)
def review_family(fid: str, user: UserRow = Depends(current_user), s: Session = Depends(get_session)):
    row = get_row(s, fid)
    row.status = "reviewed"
    audit(s, user.email, "review", fid, "report shared with parents")
    s.commit()
    return to_family(row)


@app.post("/api/families/{fid}/reassess", response_model=Family)
def reassess_family(fid: str, user: UserRow = Depends(current_user), s: Session = Depends(get_session)):
    """Re-run the current model on a stored file (e.g. after a model update). History is kept."""
    row = get_row(s, fid)
    row.assessments.append(run_assessment(as_input(row)))
    audit(s, user.email, "reassess", fid, f"model {model_version()}")
    s.commit()
    return to_family(row)


@app.delete("/api/families/{fid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_family(fid: str, user: UserRow = Depends(current_user), s: Session = Depends(get_session)):
    """Right to erasure (GDPR art. 17): removes the file and its assessments. The audit trail keeps the id only."""
    s.delete(get_row(s, fid))
    audit(s, user.email, "delete", fid, "erasure request")
    s.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@app.get("/api/audit", response_model=list[AuditEntry])
def audit_log(limit: int = 100, user: UserRow = Depends(current_user), s: Session = Depends(get_session)):
    rows = s.scalars(select(AuditRow).order_by(AuditRow.id.desc()).limit(min(limit, 500))).all()
    return [
        AuditEntry(ts=r.ts.isoformat(timespec="seconds"), user=r.user, action=r.action, familyId=r.family_id,
                   detail=r.detail)  # fmt: skip
        for r in rows
    ]


# ---------------------------------------------------------------- frontend

if DIST.is_dir():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="frontend")
