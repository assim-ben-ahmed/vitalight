"""End-to-end API tests on a throwaway SQLite database."""

import os
import tempfile

_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_db.close()
os.environ["VITALIGHT_DB"] = f"sqlite:///{_db.name}"
os.environ["VITALIGHT_DIST"] = os.path.join(tempfile.gettempdir(), "vitalight-no-dist")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from vitalight.main import app  # noqa: E402
from vitalight.seed import DEMO_PASSWORD  # noqa: E402

NEW = {
    "name": "Garnier",
    "clinician": "Dr. L. Moreau",
    "dueDate": "2027-04-10",
    "consent": True,
    "mother": {"age": 38, "conditions": ["asthma"], "carriers": [], "familyHistory": ["t1d"], "smoker": False},
    "father": {"age": 40, "conditions": ["t1d"], "carriers": ["cf"], "familyHistory": [], "smoker": True},
    "pregnancy": {"weeks": 13, "ivf": True},
}


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def auth(client):
    r = client.post("/api/auth/login", json={"email": "l.moreau@vitalight.demo", "password": DEMO_PASSWORD})
    assert r.status_code == 200
    assert r.json()["user"]["name"] == "Dr. L. Moreau"
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_health_reports_trained_model(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok" and body["engine"] == "ml"


def test_wrong_password_and_missing_token_are_rejected(client):
    assert client.post("/api/auth/login", json={"email": "l.moreau@vitalight.demo", "password": "x"}).status_code == 401
    assert client.get("/api/families").status_code == 401
    assert client.get("/api/families", headers={"Authorization": "Bearer forged.token"}).status_code == 401


def test_repeated_failed_logins_are_locked_out(client):
    creds = {"email": "a.petit@vitalight.demo", "password": "wrong"}
    codes = [client.post("/api/auth/login", json=creds).status_code for _ in range(6)]
    assert codes == [401] * 5 + [429]
    # even the right password is refused while locked
    ok = {"email": "a.petit@vitalight.demo", "password": DEMO_PASSWORD}
    assert client.post("/api/auth/login", json=ok).status_code == 429


def test_seed_families_come_with_assessments(client, auth):
    fams = client.get("/api/families", headers=auth).json()
    assert len(fams) == 8
    martin = next(f for f in fams if f["name"] == "Martin")
    cf = next(r for r in martin["assessment"]["results"] if r["id"] == "cf")
    assert cf["risk"] == pytest.approx(0.25) and cf["level"] == "high"


def test_consent_is_required(client, auth):
    r = client.post("/api/families", json={**NEW, "consent": False}, headers=auth)
    assert r.status_code == 422


def test_invalid_input_is_rejected(client, auth):
    bad = {**NEW, "mother": {**NEW["mother"], "conditions": ["flu"]}}
    assert client.post("/api/families", json=bad, headers=auth).status_code == 422


def test_full_lifecycle(client, auth):
    created = client.post("/api/families", json=NEW, headers=auth)
    assert created.status_code == 201
    fam = created.json()
    fid = fam["id"]
    assert fid == "VL-1043" and fam["status"] == "pending"
    t1d = next(r for r in fam["assessment"]["results"] if r["id"] == "t1d")
    assert t1d["method"] == "ml" and t1d["level"] == "high"

    assert client.get(f"/api/families/{fid}", headers=auth).json()["name"] == "Garnier"
    assert client.post(f"/api/families/{fid}/review", headers=auth).json()["status"] == "reviewed"
    again = client.post(f"/api/families/{fid}/reassess", headers=auth).json()
    assert again["assessment"]["modelVersion"] == fam["assessment"]["modelVersion"]

    assert client.delete(f"/api/families/{fid}", headers=auth).status_code == 204
    assert client.get(f"/api/families/{fid}", headers=auth).status_code == 404

    actions = [(e["action"], e["familyId"]) for e in client.get("/api/audit", headers=auth).json()]
    for a in ("create", "read", "review", "reassess", "delete"):
        assert (a, fid) in actions


def test_stateless_assess_does_not_store(client, auth):
    before = len(client.get("/api/families", headers=auth).json())
    res = client.post("/api/assess", json=NEW, headers=auth).json()
    assert len(res) == 7
    assert len(client.get("/api/families", headers=auth).json()) == before


def test_model_card_is_public(client):
    card = client.get("/api/model").json()
    assert set(card["metrics"]) == {"asthma", "eczema", "t1d", "chd"}
