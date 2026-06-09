"""RIDEMIND backend integration tests."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://wave-coach-3.preview.emergentagent.com').rstrip('/')
TOKEN = os.environ.get('TEST_SESSION_TOKEN', 'test_session_1781006912634')
AUTH = {"Authorization": f"Bearer {TOKEN}"}


# --- Health & public endpoints ---
def test_root():
    r = requests.get(f"{BASE_URL}/api/", timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d.get("app") == "RIDEMIND" and d.get("status") == "ok"


def test_courses():
    r = requests.get(f"{BASE_URL}/api/courses", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) == 6
    sports = {c["sport"] for c in data}
    assert {"kitesurf", "wakeboard", "foil"}.issubset(sports)


def test_spots_weather():
    r = requests.get(f"{BASE_URL}/api/spots/weather", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 6
    assert all("wind_kts" in s for s in data)


# --- Auth ---
def test_auth_me_no_cookie():
    r = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
    assert r.status_code == 401


def test_auth_session_invalid():
    r = requests.post(f"{BASE_URL}/api/auth/session", json={"session_id": "invalid_xxx"}, timeout=15)
    assert r.status_code == 401


def test_auth_me_with_bearer():
    r = requests.get(f"{BASE_URL}/api/auth/me", headers=AUTH, timeout=15)
    assert r.status_code == 200
    u = r.json()
    assert u["plan"] == "premium"
    assert u["email"] == "rider.test@ridemind.com"


# --- Checkout ---
def test_checkout_no_auth():
    r = requests.post(f"{BASE_URL}/api/checkout/session",
                      json={"plan": "standard", "origin_url": BASE_URL}, timeout=20)
    assert r.status_code == 401


def test_checkout_invalid_plan():
    r = requests.post(f"{BASE_URL}/api/checkout/session", headers=AUTH,
                      json={"plan": "gold", "origin_url": BASE_URL}, timeout=20)
    assert r.status_code == 400


@pytest.fixture(scope="module")
def stripe_session():
    r = requests.post(f"{BASE_URL}/api/checkout/session", headers=AUTH,
                      json={"plan": "standard", "origin_url": BASE_URL}, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "url" in d and "session_id" in d
    assert "stripe.com" in d["url"]
    return d


def test_checkout_status(stripe_session):
    sid = stripe_session["session_id"]
    r = requests.get(f"{BASE_URL}/api/checkout/status/{sid}", headers=AUTH, timeout=30)
    assert r.status_code == 200
    d = r.json()
    assert "status" in d and "payment_status" in d


# --- Video analysis ---
def test_video_analysis_no_auth():
    r = requests.post(f"{BASE_URL}/api/video-analysis",
                      data={"sport": "kitesurf", "level": "Débutant", "description": "test"},
                      timeout=20)
    assert r.status_code == 401


def test_video_analysis_premium():
    r = requests.post(
        f"{BASE_URL}/api/video-analysis", headers=AUTH,
        data={
            "sport": "kitesurf",
            "level": "Intermédiaire",
            "description": "I keep crashing my backroll, falling on my back, wind 22kts, kite 9m",
        }, timeout=60,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert "feedback" in d and len(d["feedback"]) > 100
    fb = d["feedback"].lower()
    assert any(k in fb for k in ["diagnostic", "drill", "technique"])


# --- Spot recommend ---
def test_spot_recommend_premium():
    payload = {"weight_kg": 75, "kite_size": 9, "board_size": 138, "level": "intermediate", "wind_kts": 22, "sport": "kitesurf"}
    r = requests.post(f"{BASE_URL}/api/spot-recommend", headers=AUTH, json=payload, timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert len(d["top_spots"]) == 3
    assert all("score" in s and "wind_kts_now" in s for s in d["top_spots"])
    assert isinstance(d["ai_advice"], str)


def test_spot_recommend_standard_forbidden():
    """Create standard user via mongosh, verify 403."""
    import subprocess
    out = subprocess.check_output([
        "mongosh", "--quiet", "--eval",
        "use('test_database');"
        "var u='std-'+Date.now();var t='std_tok_'+Date.now();"
        "db.users.insertOne({user_id:u,email:'std@t.com',name:'Std',plan:'standard',plan_expires_at:new Date(Date.now()+30*864e5).toISOString()});"
        "db.user_sessions.insertOne({user_id:u,session_token:t,expires_at:new Date(Date.now()+7*864e5).toISOString()});"
        "print(t);"
    ]).decode().strip().splitlines()[-1]
    headers = {"Authorization": f"Bearer {out}"}
    payload = {"weight_kg": 75, "kite_size": 9, "board_size": 138, "level": "intermediate", "wind_kts": 22}
    r = requests.post(f"{BASE_URL}/api/spot-recommend", headers=headers, json=payload, timeout=30)
    assert r.status_code == 403


def test_video_analysis_no_plan():
    """User with plan=null returns 402."""
    import subprocess
    out = subprocess.check_output([
        "mongosh", "--quiet", "--eval",
        "use('test_database');"
        "var u='free-'+Date.now();var t='free_tok_'+Date.now();"
        "db.users.insertOne({user_id:u,email:'free@t.com',name:'F',plan:null});"
        "db.user_sessions.insertOne({user_id:u,session_token:t,expires_at:new Date(Date.now()+7*864e5).toISOString()});"
        "print(t);"
    ]).decode().strip().splitlines()[-1]
    headers = {"Authorization": f"Bearer {out}"}
    r = requests.post(f"{BASE_URL}/api/video-analysis", headers=headers,
                      data={"sport": "kitesurf", "level": "Débutant", "description": "x"}, timeout=20)
    assert r.status_code == 402

# ============================================================
# v2: Geolocation + radius filter on /spot-recommend
# ============================================================
def test_spot_recommend_with_geo_paris_600km():
    """Paris (48.8566, 2.3522), 600km radius - should include French Atlantic/Channel spots
    but exclude Tarifa, Dakhla, far destinations."""
    payload = {
        "weight_kg": 75, "kite_size": 9, "board_size": 138,
        "level": "intermediate", "wind_kts": 22, "sport": "kitesurf",
        "user_lat": 48.8566, "user_lon": 2.3522, "max_distance_km": 600,
    }
    r = requests.post(f"{BASE_URL}/api/spot-recommend", headers=AUTH, json=payload, timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    # Each returned spot must have distance_km field
    for s in d["top_spots"]:
        assert "distance_km" in s
        assert s["distance_km"] <= 600
    names = {s["name"] for s in d["top_spots"]}
    # Should NOT include far spots
    assert not any("Tarifa" in n or "Dakhla" in n or "Maurice" in n or "Brésil" in n or "USA" in n for n in names)


def test_spot_recommend_no_geo_backwards_compat():
    """Without user_lat/user_lon - returns top_spots without distance_km filter, global."""
    payload = {
        "weight_kg": 75, "kite_size": 9, "board_size": 138,
        "level": "intermediate", "wind_kts": 22, "sport": "kitesurf",
    }
    r = requests.post(f"{BASE_URL}/api/spot-recommend", headers=AUTH, json=payload, timeout=60)
    assert r.status_code == 200, r.text
    d = r.json()
    assert len(d["top_spots"]) == 3
    # No distance_km when no geo
    for s in d["top_spots"]:
        assert "distance_km" not in s


def test_spot_recommend_tiny_radius_empty():
    """Paris with 50km radius - no kite spots that close, expect empty list + friendly advice."""
    payload = {
        "weight_kg": 75, "kite_size": 9, "board_size": 138,
        "level": "intermediate", "wind_kts": 22, "sport": "kitesurf",
        "user_lat": 48.8566, "user_lon": 2.3522, "max_distance_km": 50,
    }
    r = requests.post(f"{BASE_URL}/api/spot-recommend", headers=AUTH, json=payload, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["top_spots"] == []
    assert isinstance(d["ai_advice"], str) and len(d["ai_advice"]) > 0


# ============================================================
# v2: Structured JSON response on /video-analysis
# ============================================================
def test_video_analysis_structured():
    desc = ("Je tente mon premier backroll mais je tombe sur le dos systématiquement. "
            "Vent 22 kts, kite 9m, board twintip 138.")
    r = requests.post(
        f"{BASE_URL}/api/video-analysis", headers=AUTH,
        data={"sport": "kitesurf", "level": "Intermédiaire", "description": desc},
        timeout=90,
    )
    assert r.status_code == 200, r.text
    d = r.json()
    assert "structured" in d
    s = d["structured"]
    # Required fields
    for k in ["headline", "diagnostic", "corrections", "drills", "securite", "niveau_estime"]:
        assert k in s, f"missing key {k} in structured: {s}"
    assert isinstance(s["headline"], str) and len(s["headline"]) > 0
    assert isinstance(s["diagnostic"], str) and len(s["diagnostic"]) > 0
    assert isinstance(s["corrections"], list)
    # Expect 3-5 corrections (with some tolerance: at least 2)
    assert 2 <= len(s["corrections"]) <= 6, f"corrections count={len(s['corrections'])}"
    for c in s["corrections"]:
        assert "titre" in c and "detail" in c
    assert isinstance(s["drills"], list)
    assert 1 <= len(s["drills"]) <= 4, f"drills count={len(s['drills'])}"
    for dr in s["drills"]:
        assert "nom" in dr and "description" in dr
    assert isinstance(s["securite"], str)
    assert isinstance(s["niveau_estime"], str) and len(s["niveau_estime"]) > 0


def test_video_history_includes_structured():
    """History endpoint must still work and return previous analyses with structured field."""
    r = requests.get(f"{BASE_URL}/api/video-analysis/history", headers=AUTH, timeout=20)
    assert r.status_code == 200, r.text
    items = r.json()
    assert isinstance(items, list)
    assert len(items) >= 1
    latest = items[0]
    assert "feedback" in latest
    # New analyses should have structured key
    assert "structured" in latest

