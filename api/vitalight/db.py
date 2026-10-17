"""Persistence: SQLite through SQLAlchemy 2.0 (swap DATABASE_URL for Azure PostgreSQL in production)."""

from __future__ import annotations

import os
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

DATABASE_URL = os.environ.get("VITALIGHT_DB", "sqlite:///./vitalight.db")


class Base(DeclarativeBase):
    pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserRow(Base):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String(120), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    initials: Mapped[str] = mapped_column(String(4))
    role: Mapped[str] = mapped_column(String(40))
    password_hash: Mapped[str] = mapped_column(String(200))


class FamilyRow(Base):
    __tablename__ = "families"
    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    clinician: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[str] = mapped_column(String(10))
    due_date: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(10), default="pending")
    consent: Mapped[bool] = mapped_column(Boolean, default=False)
    mother: Mapped[dict] = mapped_column(JSON)
    father: Mapped[dict] = mapped_column(JSON)
    pregnancy: Mapped[dict] = mapped_column(JSON)
    created_by: Mapped[str | None] = mapped_column(String(120), nullable=True)
    assessments: Mapped[list[AssessmentRow]] = relationship(
        back_populates="family", cascade="all, delete-orphan", order_by="AssessmentRow.id"
    )


class AssessmentRow(Base):
    __tablename__ = "assessments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    family_id: Mapped[str] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"))
    model_version: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    results: Mapped[list] = mapped_column(JSON)
    family: Mapped[FamilyRow] = relationship(back_populates="assessments")


class AuditRow(Base):
    """Append-only access log: who read, created, changed or deleted which file, and when."""

    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    user: Mapped[str] = mapped_column(String(120))
    action: Mapped[str] = mapped_column(String(40))
    family_id: Mapped[str | None] = mapped_column(String(20), nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)


engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def init_db() -> None:
    Base.metadata.create_all(engine)


def get_session():
    with SessionLocal() as s:
        yield s


def audit(s: Session, user: str, action: str, family_id: str | None = None, detail: str | None = None) -> None:
    s.add(AuditRow(user=user, action=action, family_id=family_id, detail=detail))


def next_family_id(s: Session) -> str:
    ids = s.scalars(select(FamilyRow.id)).all()
    nums = [int(i.split("-")[1]) for i in ids if i.startswith("VL-") and i.split("-")[1].isdigit()]
    return f"VL-{max(nums, default=1000) + 1}"
