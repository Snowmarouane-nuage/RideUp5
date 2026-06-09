"""RIDEMIND backend - Coaching platform for kitesurf/wakeboard/foil/surf."""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Cookie, UploadFile, File, Form, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import httpx
from pathlib import Path
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Uploads dir
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="RIDEMIND API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ridemind")

# ============================================================
# PLANS (server-side, never trust frontend prices)
# ============================================================
PLANS = {
    "standard": {"name": "Standard", "price": 9.99, "currency": "eur", "features": ["video_analysis", "courses"]},
    "premium": {"name": "Premium", "price": 15.99, "currency": "eur", "features": ["video_analysis", "courses", "spot_recommender"]},
}

# ============================================================
# Models
# ============================================================
class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    plan: Optional[str] = None  # "standard" | "premium" | None
    plan_expires_at: Optional[str] = None  # ISO string

class CheckoutRequest(BaseModel):
    plan: str  # "standard" | "premium"
    origin_url: str

class VideoAnalysisRequest(BaseModel):
    sport: str  # kitesurf | wakeboard | foil | surf
    level: str
    description: str

class SpotRecommendRequest(BaseModel):
    weight_kg: float
    kite_size: float
    board_size: float
    level: str  # beginner | intermediate | advanced | pro
    wind_kts: float
    sport: str = "kitesurf"
    user_lat: Optional[float] = None
    user_lon: Optional[float] = None
    max_distance_km: Optional[float] = None  # None = no filter

class QuestionPayload(BaseModel):
    question: str

# ============================================================
# Auth helpers
# ============================================================
async def get_current_user(request: Request) -> Optional[dict]:
    """Get user from session cookie or Authorization header."""
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        return None
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    return user

async def require_user(request: Request) -> dict:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# ============================================================
# AUTH endpoints (Emergent Google OAuth)
# ============================================================
@api.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id from Emergent for a backend session."""
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient(timeout=10.0) as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session")
    data = r.json()

    email = data["email"]
    name = data["name"]
    picture = data.get("picture")
    session_token = data["session_token"]

    # Find or create user
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "plan": None,
            "plan_expires_at": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    # Store session (7 days)
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 3600,
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user

@api.get("/auth/me")
async def auth_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

# ============================================================
# STRIPE Subscriptions (using emergentintegrations)
# ============================================================
@api.post("/checkout/session")
async def create_checkout_session(req: CheckoutRequest, request: Request, user: dict = Depends(require_user)):
    if req.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest

    plan_info = PLANS[req.plan]
    api_key = os.environ["STRIPE_API_KEY"]
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    success_url = f"{req.origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{req.origin_url}/pricing"

    checkout_req = CheckoutSessionRequest(
        amount=plan_info["price"],
        currency=plan_info["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["user_id"],
            "plan": req.plan,
            "email": user["email"],
        },
    )
    session = await stripe_checkout.create_checkout_session(checkout_req)

    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": user["user_id"],
        "email": user["email"],
        "plan": req.plan,
        "amount": plan_info["price"],
        "currency": plan_info["currency"],
        "payment_status": "initiated",
        "status": "pending",
        "metadata": {"user_id": user["user_id"], "plan": req.plan},
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": session.url, "session_id": session.session_id}

@api.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, request: Request, user: dict = Depends(require_user)):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    api_key = os.environ["STRIPE_API_KEY"]
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    status = await stripe_checkout.get_checkout_status(session_id)

    # If paid and not yet provisioned, grant the plan
    if status.payment_status == "paid" and tx["payment_status"] != "paid":
        plan = tx["plan"]
        expires = datetime.now(timezone.utc) + timedelta(days=30)
        await db.users.update_one(
            {"user_id": tx["user_id"]},
            {"$set": {"plan": plan, "plan_expires_at": expires.isoformat()}},
        )
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid", "status": status.status, "paid_at": datetime.now(timezone.utc).isoformat()}},
        )
    else:
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": status.payment_status, "status": status.status}},
        )

    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
    }

@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    api_key = os.environ["STRIPE_API_KEY"]
    host_url = str(request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        evt = await stripe_checkout.handle_webhook(body, sig)
        if evt.payment_status == "paid":
            tx = await db.payment_transactions.find_one({"session_id": evt.session_id})
            if tx and tx.get("payment_status") != "paid":
                plan = (evt.metadata or {}).get("plan") or tx.get("plan")
                expires = datetime.now(timezone.utc) + timedelta(days=30)
                await db.users.update_one(
                    {"user_id": tx["user_id"]},
                    {"$set": {"plan": plan, "plan_expires_at": expires.isoformat()}},
                )
                await db.payment_transactions.update_one(
                    {"session_id": evt.session_id},
                    {"$set": {"payment_status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}},
                )
    except Exception as e:
        logger.exception("webhook failure: %s", e)
    return {"received": True}

# ============================================================
# COURSES (static catalog)
# ============================================================
COURSES = [
    {"id": "c1", "title": "Maîtriser la fenêtre de vent", "sport": "kitesurf", "level": "Débutant", "duration": "12 min",
     "thumbnail": "https://images.unsplash.com/photo-1627068477565-3a66d5f76d5e?w=800",
     "description": "Comprendre où placer ton kite et comment lire la fenêtre de vent.",
     "coming_soon": True},
    {"id": "c2", "title": "Le water start parfait", "sport": "kitesurf", "level": "Débutant", "duration": "18 min",
     "thumbnail": "https://images.unsplash.com/photo-1578060124065-41f863eb9ebe?w=800",
     "description": "Décolle proprement de l'eau à chaque essai.",
     "coming_soon": True},
    {"id": "c3", "title": "Premier saut & pop", "sport": "kitesurf", "level": "Intermédiaire", "duration": "22 min",
     "thumbnail": "https://images.unsplash.com/photo-1667323567346-ea4048f36c58?fm=jpg&q=85&w=800&auto=format&fit=crop",
     "description": "Construis ton premier saut: edge, send, pop, réception.",
     "coming_soon": True},
    {"id": "c4", "title": "Backroll & rotations", "sport": "kitesurf", "level": "Avancé", "duration": "26 min",
     "thumbnail": "https://images.unsplash.com/photo-1632990848833-2e7007adb204?w=800",
     "description": "Décompose le backroll étape par étape avec drills.",
     "coming_soon": True},
    {"id": "c5", "title": "Initiation au foil", "sport": "foil", "level": "Débutant", "duration": "20 min",
     "thumbnail": "https://images.unsplash.com/photo-1777897161531-5fdeec1e9a4c?fm=jpg&q=85&w=800&auto=format&fit=crop",
     "description": "Apprends à voler stable sur ton foil.",
     "coming_soon": True},
    {"id": "c6", "title": "Pop wakeboard derrière bateau", "sport": "wakeboard", "level": "Intermédiaire", "duration": "16 min",
     "thumbnail": "https://images.unsplash.com/photo-1666032234128-abc3e45bd1dc?fm=jpg&q=85&w=800&auto=format&fit=crop",
     "description": "Edge agressif et pop explosif au wake.",
     "coming_soon": True},
]

@api.get("/courses")
async def list_courses():
    return COURSES

# ============================================================
# VIDEO ANALYSIS (Claude Sonnet 4.5 via Emergent LLM key)
# ============================================================
@api.post("/video-analysis")
async def video_analysis(
    request: Request,
    sport: str = Form(...),
    level: str = Form(...),
    description: str = Form(...),
    video: Optional[UploadFile] = File(None),
):
    user = await require_user(request)
    if not user.get("plan"):
        raise HTTPException(status_code=402, detail="Subscription required")

    video_filename = None
    video_size = 0
    if video:
        ext = (video.filename or "video.mp4").split(".")[-1][:5]
        video_filename = f"{uuid.uuid4().hex}.{ext}"
        path = UPLOAD_DIR / video_filename
        content = await video.read()
        video_size = len(content)
        with open(path, "wb") as f:
            f.write(content)

    # Call Claude via emergentintegrations
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    system_prompt = (
        "Tu es RIDEMIND COACH, un coach mondial de sports de glisse (kitesurf, wakeboard, foil, surf). "
        "Tu reçois la description d'une session ou d'une figure et tu dois fournir une analyse "
        "technique précise et structurée. Tu DOIS répondre uniquement avec un objet JSON valide "
        "(pas de markdown, pas de ```json, juste l'objet), respectant strictement ce schéma :\n"
        "{\n"
        '  "headline": "phrase courte qui résume ta lecture de la session (max 12 mots)",\n'
        '  "diagnostic": "2-3 phrases d\'analyse de la situation décrite",\n'
        '  "corrections": [\n'
        '    {"titre": "titre court", "detail": "1-2 phrases d\'explication concrète"},\n'
        '    ... (3 à 5 items)\n'
        '  ],\n'
        '  "drills": [\n'
        '    {"nom": "nom du drill", "description": "comment l\'exécuter, 1-2 phrases"},\n'
        '    ... (2 à 3 items progressifs)\n'
        '  ],\n'
        '  "securite": "1 phrase de conseil sécurité pertinent",\n'
        '  "niveau_estime": "Débutant | Intermédiaire | Avancé | Pro - selon ce que tu lis"\n'
        "}\n\n"
        "REGLES DE STYLE STRICTES dans tous les champs texte :\n"
        "- Écris en français, ton technique mais bienveillant.\n"
        "- AUCUN caractère markdown : pas de #, pas de *, pas de **, pas de _, pas de backticks, pas de tirets de liste en début de ligne.\n"
        "- Pas de titres, pas de mise en gras, pas d'italique. Juste du texte courant lisible.\n"
        "- Pas d'emojis.\n"
        "- Phrases complètes et naturelles, comme à l'oral d'un coach pro."
    )

    session_id = f"va_{uuid.uuid4().hex}"
    chat = LlmChat(
        api_key=os.environ["EMERGENT_LLM_KEY"],
        session_id=session_id,
        system_message=system_prompt,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    user_text = (
        f"Sport : {sport}\n"
        f"Niveau du rider : {level}\n"
        f"Ce que je cherche à analyser / améliorer :\n{description}\n\n"
        + (f"(Une vidéo de {round(video_size/1024/1024,2)} MB a été téléversée pour référence.)" if video_filename else "")
    )
    msg = UserMessage(text=user_text)
    try:
        ai_response = await chat.send_message(msg)
    except Exception as e:
        logger.exception("LLM error")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {e}")

    # Parse JSON response (strip markdown fences if present)
    import json as _json
    cleaned = ai_response.strip()
    if cleaned.startswith("```"):
        # remove leading fence and language tag
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
        if cleaned.rstrip().endswith("```"):
            cleaned = cleaned.rstrip()[:-3]
    try:
        structured = _json.loads(cleaned)
    except Exception:
        # Fallback: return as plain text in a single field
        structured = {
            "headline": "Analyse de ta session",
            "diagnostic": ai_response,
            "corrections": [],
            "drills": [],
            "securite": "",
            "niveau_estime": level,
        }

    # Defensive: strip any markdown that slipped through
    structured = clean_structured(structured)

    record = {
        "analysis_id": f"an_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "sport": sport,
        "level": level,
        "description": description,
        "video_filename": video_filename,
        "feedback": ai_response,  # keep raw for backwards compat
        "structured": structured,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.video_analyses.insert_one(record)
    record.pop("_id", None)
    return record

@api.get("/video-analysis/history")
async def video_history(request: Request):
    user = await require_user(request)
    items = await db.video_analyses.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return items

# ============================================================
# SPOT RECOMMENDER (Premium) - Open-Meteo + AI
# ============================================================
SPOTS = [
    # France
    {"name": "Leucate, France", "lat": 42.9171, "lon": 3.0322, "best_wind_dir": "Tramontane", "ideal_kts": [18, 35], "level": "intermediate", "type": "chop"},
    {"name": "Beauduc, France", "lat": 43.3667, "lon": 4.5667, "best_wind_dir": "Mistral", "ideal_kts": [18, 30], "level": "intermediate", "type": "flat"},
    {"name": "Almanarre (Hyères), France", "lat": 43.0913, "lon": 6.1392, "best_wind_dir": "Mistral/Est", "ideal_kts": [15, 30], "level": "beginner", "type": "flat-chop"},
    {"name": "La Tranche-sur-Mer, France", "lat": 46.3439, "lon": -1.4256, "best_wind_dir": "O/SO", "ideal_kts": [15, 28], "level": "beginner", "type": "flat-chop"},
    {"name": "Wissant, France", "lat": 50.8867, "lon": 1.6592, "best_wind_dir": "O/SO", "ideal_kts": [18, 32], "level": "intermediate", "type": "chop-wave"},
    {"name": "Quiberon, France", "lat": 47.4830, "lon": -3.1188, "best_wind_dir": "O/NO", "ideal_kts": [16, 30], "level": "intermediate", "type": "flat-chop"},
    {"name": "Le Crotoy, France", "lat": 50.2186, "lon": 1.6206, "best_wind_dir": "O/SO", "ideal_kts": [16, 30], "level": "beginner", "type": "flat"},
    # Spain
    {"name": "Tarifa, Espagne", "lat": 36.0143, "lon": -5.6044, "best_wind_dir": "Levante/Poniente", "ideal_kts": [18, 30], "level": "intermediate", "type": "flat-chop"},
    {"name": "Roses, Espagne", "lat": 42.2625, "lon": 3.1764, "best_wind_dir": "Tramontane", "ideal_kts": [18, 32], "level": "intermediate", "type": "chop"},
    # Italy / Sicily
    {"name": "Lo Stagnone, Sicile", "lat": 37.8675, "lon": 12.4500, "best_wind_dir": "O/NO/SO", "ideal_kts": [13, 25], "level": "beginner", "type": "flat"},
    # Portugal
    {"name": "Guincho, Portugal", "lat": 38.7325, "lon": -9.4744, "best_wind_dir": "N/NO", "ideal_kts": [18, 35], "level": "advanced", "type": "wave"},
    {"name": "Lagoa de Albufeira, Portugal", "lat": 38.4747, "lon": -9.1808, "best_wind_dir": "N", "ideal_kts": [15, 28], "level": "beginner", "type": "flat-chop"},
    # Netherlands
    {"name": "Workum (Ijsselmeer), Pays-Bas", "lat": 52.9750, "lon": 5.4422, "best_wind_dir": "O/SO", "ideal_kts": [14, 28], "level": "beginner", "type": "flat"},
    # Germany
    {"name": "Fehmarn, Allemagne", "lat": 54.4350, "lon": 11.1850, "best_wind_dir": "O/SO/NO", "ideal_kts": [15, 30], "level": "intermediate", "type": "chop"},
    # Maroc
    {"name": "Dakhla, Maroc", "lat": 23.7136, "lon": -15.9355, "best_wind_dir": "NE", "ideal_kts": [15, 25], "level": "beginner", "type": "flat"},
    {"name": "Essaouira, Maroc", "lat": 31.5085, "lon": -9.7595, "best_wind_dir": "N/NE", "ideal_kts": [18, 35], "level": "intermediate", "type": "chop-wave"},
    # Far destinations
    {"name": "Le Morne, Maurice", "lat": -20.4540, "lon": 57.3127, "best_wind_dir": "SE", "ideal_kts": [16, 28], "level": "advanced", "type": "wave-flat"},
    {"name": "Cumbuco, Brésil", "lat": -3.6258, "lon": -38.7253, "best_wind_dir": "E", "ideal_kts": [16, 26], "level": "beginner", "type": "flat"},
    {"name": "Hood River, USA", "lat": 45.7054, "lon": -121.5215, "best_wind_dir": "W", "ideal_kts": [20, 32], "level": "advanced", "type": "river-chop"},
]

def haversine_km(lat1, lon1, lat2, lon2):
    """Great-circle distance in km."""
    from math import radians, sin, cos, atan2, sqrt
    r = 6371.0
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlamb = radians(lon2 - lon1)
    a = sin(dphi/2)**2 + cos(phi1) * cos(phi2) * sin(dlamb/2)**2
    return 2 * r * atan2(sqrt(a), sqrt(1 - a))


_MD_PATTERNS = [
    (__import__("re").compile(r"```[a-zA-Z]*\n?"), ""),     # code fences
    (__import__("re").compile(r"`([^`]+)`"), r"\1"),         # inline code
    (__import__("re").compile(r"\*\*([^*]+)\*\*"), r"\1"),  # bold
    (__import__("re").compile(r"__([^_]+)__"), r"\1"),       # bold underscore
    (__import__("re").compile(r"(?<!\*)\*([^*\n]+)\*(?!\*)"), r"\1"),  # italic *...*
    (__import__("re").compile(r"(?<!_)_([^_\n]+)_(?!_)"), r"\1"),       # italic _..._
    (__import__("re").compile(r"^\s*#{1,6}\s+", __import__("re").MULTILINE), ""),  # headings
    (__import__("re").compile(r"^\s*[-*+]\s+", __import__("re").MULTILINE), ""),    # list bullets
    (__import__("re").compile(r"^\s*\d+\.\s+", __import__("re").MULTILINE), ""),    # numbered lists
    (__import__("re").compile(r"^>\s+", __import__("re").MULTILINE), ""),           # blockquotes
]

def strip_markdown(text: str) -> str:
    """Strip common markdown characters so the AI text reads as plain prose."""
    if not isinstance(text, str):
        return text
    out = text
    for pat, repl in _MD_PATTERNS:
        out = pat.sub(repl, out)
    # Collapse 3+ newlines
    out = __import__("re").sub(r"\n{3,}", "\n\n", out)
    return out.strip()


def clean_structured(obj):
    """Apply strip_markdown recursively to all string values in a dict/list."""
    if isinstance(obj, str):
        return strip_markdown(obj)
    if isinstance(obj, dict):
        return {k: clean_structured(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [clean_structured(x) for x in obj]
    return obj

@api.get("/spots/weather")
async def spots_weather():
    """Get current wind conditions for all spots from Open-Meteo."""
    results = []
    async with httpx.AsyncClient(timeout=10.0) as hc:
        for s in SPOTS:
            try:
                r = await hc.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": s["lat"], "longitude": s["lon"],
                        "current": "wind_speed_10m,wind_direction_10m,temperature_2m",
                        "wind_speed_unit": "kn",
                    },
                )
                d = r.json().get("current", {})
                results.append({**s, "wind_kts": d.get("wind_speed_10m"), "wind_dir": d.get("wind_direction_10m"), "temp_c": d.get("temperature_2m")})
            except Exception:
                results.append({**s, "wind_kts": None, "wind_dir": None, "temp_c": None})
    return results

@api.post("/spot-recommend")
async def spot_recommend(req: SpotRecommendRequest, request: Request):
    user = await require_user(request)
    if user.get("plan") != "premium":
        raise HTTPException(status_code=403, detail="Premium plan required")

    # Filter spots by distance if user location provided
    candidate_spots = SPOTS
    if req.user_lat is not None and req.user_lon is not None:
        with_dist = [
            {**s, "distance_km": round(haversine_km(req.user_lat, req.user_lon, s["lat"], s["lon"]), 1)}
            for s in SPOTS
        ]
        if req.max_distance_km:
            with_dist = [s for s in with_dist if s["distance_km"] <= req.max_distance_km]
        candidate_spots = with_dist

    if not candidate_spots:
        return {"top_spots": [], "ai_advice": "Aucun spot trouvé dans ce rayon. Augmente la distance pour découvrir d'autres options.", "requested": req.model_dump()}

    # Fetch live wind for filtered spots
    spots = []
    async with httpx.AsyncClient(timeout=10.0) as hc:
        for s in candidate_spots:
            try:
                r = await hc.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": s["lat"], "longitude": s["lon"],
                        "current": "wind_speed_10m,wind_direction_10m",
                        "wind_speed_unit": "kn",
                    },
                )
                d = r.json().get("current", {})
                spots.append({**s, "wind_kts_now": d.get("wind_speed_10m"), "wind_dir_now": d.get("wind_direction_10m")})
            except Exception:
                spots.append({**s, "wind_kts_now": None, "wind_dir_now": None})

    # Score each spot
    level_rank = {"beginner": 1, "intermediate": 2, "advanced": 3, "pro": 4}
    user_lvl = level_rank.get(req.level.lower(), 2)
    scored = []
    for s in spots:
        if s["wind_kts_now"] is None:
            continue
        wind = s["wind_kts_now"]
        ideal_min, ideal_max = s["ideal_kts"]
        in_range = ideal_min <= wind <= ideal_max
        spot_lvl = level_rank.get(s["level"], 2)
        safety_ok = spot_lvl <= user_lvl + 1
        score = 0
        if in_range:
            score += 50
        else:
            dist = min(abs(wind - ideal_min), abs(wind - ideal_max))
            score += max(0, 30 - dist * 2)
        if safety_ok:
            score += 30
        if spot_lvl == user_lvl:
            score += 20
        # Bonus for closer spots when user location known
        if "distance_km" in s and req.max_distance_km:
            score += max(0, 10 - (s["distance_km"] / req.max_distance_km) * 10)
        scored.append({**s, "score": round(score, 1), "in_ideal_range": in_range, "safety_ok": safety_ok})

    scored.sort(key=lambda x: x["score"], reverse=True)
    top3 = scored[:3]

    # AI commentary
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=os.environ["EMERGENT_LLM_KEY"],
        session_id=f"sr_{uuid.uuid4().hex}",
        system_message="Tu es un expert en spots de kitesurf. Donne en français un conseil concis (3-5 phrases) sur le meilleur spot pour le rider donné, en justifiant techniquement (vent, niveau, sécurité, matériel). REGLES DE STYLE: texte courant uniquement, aucun caractère markdown (pas de #, pas de *, pas de **, pas de _, pas de backticks, pas de tirets de liste), pas de titres, pas de gras, pas d'italique, pas d'emojis. Juste des phrases naturelles, fluides, comme à l'oral.",
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    if not top3:
        return {"top_spots": [], "ai_advice": "Pas de spot ventilé dans ce rayon. Essaie un autre jour ou élargis ta zone.", "requested": req.model_dump()}
    dist_info = f", à {top3[0]['distance_km']} km" if "distance_km" in top3[0] else ""
    user_msg = (
        f"Rider: {req.weight_kg} kg, niveau {req.level}, kite {req.kite_size}m, "
        f"board {req.board_size} cm, sport {req.sport}.\n"
        f"Top spot proposé: {top3[0]['name']}{dist_info} avec vent actuel {top3[0]['wind_kts_now']} kts (idéal {top3[0]['ideal_kts'][0]}-{top3[0]['ideal_kts'][1]} kts, type {top3[0]['type']}).\n"
        "Donne ton verdict et une recommandation matériel/sécurité."
    )
    try:
        ai_comment = await chat.send_message(UserMessage(text=user_msg))
    except Exception:
        ai_comment = "Conseil IA indisponible pour le moment."

    ai_comment = strip_markdown(ai_comment)

    return {"top_spots": top3, "ai_advice": ai_comment, "requested": req.model_dump()}

# ============================================================
# Health
# ============================================================
@api.get("/spots/weekend-forecast")
async def spots_weekend_forecast(user_lat: Optional[float] = None, user_lon: Optional[float] = None, max_distance_km: Optional[float] = None):
    """Public endpoint: returns wind forecast for the upcoming weekend (Sat+Sun) for all spots.
    Used by the SEO page 'Meilleurs spots de kitesurf ce week-end'."""
    from datetime import date

    today = date.today()
    # Find next Saturday (or today if today is Saturday)
    days_to_sat = (5 - today.weekday()) % 7
    if days_to_sat == 0 and today.weekday() != 5:
        days_to_sat = 7
    saturday = today + timedelta(days=days_to_sat)
    sunday = saturday + timedelta(days=1)

    # Filter spots by distance if provided
    candidate = SPOTS
    if user_lat is not None and user_lon is not None:
        candidate = [
            {**s, "distance_km": round(haversine_km(user_lat, user_lon, s["lat"], s["lon"]), 1)}
            for s in SPOTS
        ]
        if max_distance_km:
            candidate = [s for s in candidate if s["distance_km"] <= max_distance_km]

    results = []
    async with httpx.AsyncClient(timeout=15.0) as hc:
        for s in candidate:
            try:
                r = await hc.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": s["lat"], "longitude": s["lon"],
                        "hourly": "wind_speed_10m,wind_direction_10m",
                        "wind_speed_unit": "kn",
                        "start_date": saturday.isoformat(),
                        "end_date": sunday.isoformat(),
                        "timezone": "auto",
                    },
                )
                d = r.json().get("hourly", {})
                speeds = d.get("wind_speed_10m") or []
                if not speeds:
                    continue
                # Compute stats only for "rideable hours" between 9h and 19h local
                # Open-Meteo returns 48 hours of data (Sat 0h - Sun 23h). We'll filter via index.
                # Index 9-18 (Sat day), 33-42 (Sun day)
                day_hours = list(range(9, 19)) + list(range(33, 43))
                day_speeds = [speeds[i] for i in day_hours if i < len(speeds) and speeds[i] is not None]
                if not day_speeds:
                    continue
                avg_wind = sum(day_speeds) / len(day_speeds)
                max_wind = max(day_speeds)
                ideal_min, ideal_max = s["ideal_kts"]
                rideable_hours = sum(1 for w in day_speeds if ideal_min <= w <= ideal_max)
                # Score: rideable hours weighted by avg quality
                score = rideable_hours * 5
                if ideal_min <= avg_wind <= ideal_max:
                    score += 30
                # Per-day split
                sat_speeds = [speeds[i] for i in range(9, 19) if i < len(speeds) and speeds[i] is not None]
                sun_speeds = [speeds[i] for i in range(33, 43) if i < len(speeds) and speeds[i] is not None]
                results.append({
                    **s,
                    "saturday": saturday.isoformat(),
                    "sunday": sunday.isoformat(),
                    "avg_wind_kts": round(avg_wind, 1),
                    "max_wind_kts": round(max_wind, 1),
                    "sat_avg_kts": round(sum(sat_speeds) / len(sat_speeds), 1) if sat_speeds else None,
                    "sun_avg_kts": round(sum(sun_speeds) / len(sun_speeds), 1) if sun_speeds else None,
                    "rideable_hours": rideable_hours,
                    "score": round(score, 1),
                })
            except Exception:
                continue

    results.sort(key=lambda x: x["score"], reverse=True)
    return {
        "saturday": saturday.isoformat(),
        "sunday": sunday.isoformat(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "spots": results,
    }


@api.get("/")
async def root():
    return {"app": "RIDEMIND", "status": "ok"}

# Mount router
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
