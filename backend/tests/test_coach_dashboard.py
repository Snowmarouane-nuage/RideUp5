"""RIDEMIND COACH + DASHBOARD endpoint tests (iteration 4)."""
import os
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8000').rstrip('/')
TOKEN = os.environ.get('TEST_SESSION_TOKEN', 'test_session_1781006912634')
AUTH = {"Authorization": f"Bearer {TOKEN}"}

MD_CHARS = ["#", "*", "_", "`"]


def assert_no_markdown(text, field=""):
    assert isinstance(text, str), f"{field} not a string"
    for ch in MD_CHARS:
        assert ch not in text, f"{field} contains markdown '{ch}': {text!r}"
    for line in text.splitlines():
        ls = line.lstrip()
        assert not ls.startswith("- "), f"{field} dash list: {line!r}"


def _delete_profile():
    import subprocess
    subprocess.check_call([
        "mongosh", "--quiet", "--eval",
        "use('test_database'); db.coach_profiles.deleteOne({user_id:'test-user-1781006912634'});",
    ])


# --- COACH ---
def test_coach_profile_null_initially():
    _delete_profile()
    r = requests.get(f"{BASE_URL}/api/coach/profile", headers=AUTH, timeout=15)
    assert r.status_code == 200
    assert r.json() is None


def test_coach_chat_without_profile_returns_404():
    _delete_profile()
    r = requests.post(f"{BASE_URL}/api/coach/chat", headers=AUTH,
                      json={"message": "salut"}, timeout=30)
    assert r.status_code == 404


def test_coach_onboarding_creates_roadmap():
    _delete_profile()
    payload = {
        "level": "Intermédiaire", "sport": "kitesurf",
        "current_tricks": ["water start", "transitions"],
        "goal": "Réussir mon premier backroll cet été",
    }
    r = requests.post(f"{BASE_URL}/api/coach/onboarding", headers=AUTH, json=payload, timeout=90)
    assert r.status_code == 200, r.text
    d = r.json()
    assert isinstance(d.get("welcome"), str) and len(d["welcome"]) > 0
    assert_no_markdown(d["welcome"], "welcome")
    rm = d.get("roadmap")
    assert isinstance(rm, list)
    assert 6 <= len(rm) <= 9, f"roadmap length={len(rm)}"
    for t in rm:
        assert "trick" in t and "why" in t and "difficulty" in t
        assert t["status"] == "todo"
        assert_no_markdown(t["trick"], "trick")
        assert_no_markdown(t["why"], "why")
    # GET should now return the saved profile
    r2 = requests.get(f"{BASE_URL}/api/coach/profile", headers=AUTH, timeout=15)
    assert r2.status_code == 200
    p = r2.json()
    assert p is not None
    assert len(p["roadmap"]) == len(rm)
    assert p["goal"] == payload["goal"]
    assert p["level"] == payload["level"]


def test_coach_trick_complete():
    # Profile already created from previous test
    profile = requests.get(f"{BASE_URL}/api/coach/profile", headers=AUTH, timeout=15).json()
    assert profile and profile["roadmap"]
    first = profile["roadmap"][0]["trick"]
    r = requests.post(f"{BASE_URL}/api/coach/trick/complete", headers=AUTH,
                      json={"trick": first}, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    matched = [t for t in d["roadmap"] if t["trick"] == first]
    assert matched and matched[0]["status"] == "done"
    assert "completed_at" in matched[0]


def test_coach_chat_returns_plain_prose():
    r = requests.post(f"{BASE_URL}/api/coach/chat", headers=AUTH,
                      json={"message": "Salut coach, j'ai du mal avec le pop, t'as un conseil ?"},
                      timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "reply" in d and "messages" in d
    assert isinstance(d["reply"], str) and len(d["reply"]) > 10
    assert_no_markdown(d["reply"], "reply")
    assert isinstance(d["messages"], list) and len(d["messages"]) >= 2
    assert d["messages"][-1]["role"] == "coach"
    assert d["messages"][-2]["role"] == "user"


# --- DASHBOARD ---
def test_dashboard_stats_structure():
    r = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=AUTH, timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ["total_analyses", "tricks_done", "tricks_total", "days_active",
              "weekly_chart", "encouragement", "recent_analyses", "has_coach_profile"]:
        assert k in d, f"missing key {k}"
    assert isinstance(d["weekly_chart"], list) and len(d["weekly_chart"]) == 8
    for wk in d["weekly_chart"]:
        assert "week_offset" in wk and "count" in wk
    assert isinstance(d["encouragement"], str) and len(d["encouragement"]) > 0
    assert_no_markdown(d["encouragement"], "encouragement")
    assert isinstance(d["has_coach_profile"], bool)
    assert d["has_coach_profile"] is True
    assert d["tricks_total"] >= 6


def test_dashboard_stats_unauth():
    r = requests.get(f"{BASE_URL}/api/dashboard/stats", timeout=15)
    assert r.status_code == 401
