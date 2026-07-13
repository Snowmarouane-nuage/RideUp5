"""RIDE’UP backend - Coaching platform for kitesurf/wakeboard/foil/surf."""
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Cookie, UploadFile, File, Form, Depends
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from database import init_database, close_database, get_backend
import os
import logging
import uuid
import secrets
import httpx
import bcrypt
import stripe
import base64
import shutil
import json
from stripe import StripeError
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Database initialized on startup (MongoDB or SQLite fallback)
db = None

# Uploads dir
UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="RIDE’UP API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ridemind")

IS_DEV = os.environ.get("ENV", "development").lower() in ("development", "dev", "local")
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false" if IS_DEV else "true").lower() == "true"
_cors_raw = os.environ.get("CORS_ORIGINS", "").strip()
if _cors_raw:
    CORS_ORIGINS = [o.strip() for o in _cors_raw.split(",") if o.strip()]
elif IS_DEV:
    CORS_ORIGINS = ["http://localhost:3000"]
else:
    CORS_ORIGINS = ["*"]

ADMIN_EMAILS = {
    e.strip().lower()
    for e in os.environ.get("ADMIN_EMAILS", "").split(",")
    if e.strip()
}


def user_is_admin(user: dict) -> bool:
    email = (user.get("email") or "").lower().strip()
    return bool(email and email in ADMIN_EMAILS)


def public_user(user: dict) -> dict:
    out = {k: v for k, v in user.items() if k not in ("password_hash", "is_admin")}
    out["email_verified"] = user_email_verified(user)
    if user_is_admin(user):
        out["is_admin"] = True
        if not out.get("plan"):
            out["plan"] = "premium"
    return out


def user_email_verified(user: dict) -> bool:
    """Legacy accounts without the field are treated as verified."""
    if "email_verified" not in user:
        return True
    return bool(user.get("email_verified"))


async def require_admin(request: Request) -> dict:
    user = await require_user(request)
    if not user_is_admin(user):
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")
    return user

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
    quiver: List[float] = []  # list of kite sizes the rider owns (m²)
    board_size: float
    level: str  # beginner | intermediate | advanced | pro
    sport: str = "kitesurf"
    user_lat: Optional[float] = None
    user_lon: Optional[float] = None
    max_distance_km: Optional[float] = None
    target_date: Optional[str] = None  # YYYY-MM-DD; None = today
    target_hour: int = 14  # 0-23 local time; default afternoon

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
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    return user

async def require_user(request: Request) -> dict:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def require_verified_email(request: Request) -> dict:
    user = await require_user(request)
    if not user_email_verified(user):
        raise HTTPException(
            status_code=403,
            detail="Confirme ton adresse email avant d'utiliser cette fonctionnalité. "
            "Consulte ta boîte mail ou renvoie le lien depuis ton dashboard.",
        )
    return user


def user_has_active_plan(user: dict) -> bool:
    plan = user.get("plan")
    if not plan:
        return False
    if user.get("subscription_status") in ("active", "trialing"):
        return True
    expires_raw = user.get("plan_expires_at")
    if not expires_raw:
        return True
    expires_at = datetime.fromisoformat(expires_raw) if isinstance(expires_raw, str) else expires_raw
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at >= datetime.now(timezone.utc)


async def _issue_session(user_id: str, response: Response) -> dict:
    session_token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=30)
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
        secure=COOKIE_SECURE,
        samesite="none" if COOKIE_SECURE else "lax",
        path="/",
        max_age=30 * 24 * 3600,
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return public_user(user)


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except Exception:
        return False


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=2, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=32, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=32, max_length=128)


async def require_active_plan(request: Request) -> dict:
    user = await require_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if user_is_admin(user):
        return user
    user = await require_verified_email(request)
    if not user_has_active_plan(user):
        raise HTTPException(status_code=402, detail="Subscription required")
    return user


async def require_premium_plan(request: Request) -> dict:
    user = await require_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if user_is_admin(user):
        return user
    user = await require_verified_email(request)
    if not user_has_active_plan(user):
        raise HTTPException(status_code=402, detail="Subscription required")
    if user.get("plan") != "premium":
        raise HTTPException(status_code=403, detail="Premium plan required")
    return user

# ============================================================
# AUTH — email / password (RIDE'UP)
# ============================================================
async def _send_email_verification(user_id: str, email: str) -> None:
    import hashlib
    from email_service import send_verification_email

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()

    await db.email_verification_tokens.insert_one({
        "token_hash": token_hash,
        "user_id": user_id,
        "email": email,
        "expires_at": expires,
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await send_verification_email(email, raw_token)


def _initial_email_verified(email: str) -> bool:
    """Admins auto-verified; dev without Resend skips verification."""
    from email_service import email_configured

    if email.lower().strip() in ADMIN_EMAILS:
        return True
    if IS_DEV and not email_configured():
        return True
    return False


@api.post("/auth/register")
async def auth_register(payload: RegisterRequest, response: Response):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Un compte existe déjà avec cet email")

    user_id = f"user_{uuid.uuid4().hex[:12]}"
    verified = _initial_email_verified(email)
    await db.users.insert_one({
        "user_id": user_id,
        "email": email,
        "name": payload.name.strip(),
        "picture": None,
        "password_hash": _hash_password(payload.password),
        "email_verified": verified,
        "plan": None,
        "plan_expires_at": None,
        "subscription_status": None,
        "stripe_customer_id": None,
        "stripe_subscription_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    if not verified:
        await _send_email_verification(user_id, email)
    session_user = await _issue_session(user_id, response)
    if not verified:
        session_user["verification_sent"] = True
    return session_user


@api.post("/auth/login")
async def auth_login(payload: LoginRequest, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    if not _verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    return await _issue_session(user["user_id"], response)


async def _invalidate_user_sessions(user_id: str) -> None:
    # SQLite local store: delete_one only deletes first match — clear all via find+delete
    sessions = await db.user_sessions.find({"user_id": user_id}, {"_id": 0}).to_list(500)
    for s in sessions:
        await db.user_sessions.delete_one({"session_token": s["session_token"]})


@api.post("/auth/forgot-password")
async def auth_forgot_password(payload: ForgotPasswordRequest):
    """Always returns the same message — no account enumeration."""
    import hashlib
    from email_service import send_password_reset_email

    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})

    generic = {
        "ok": True,
        "message": (
            "Si un compte existe avec cet email, tu recevras un lien de réinitialisation "
            "dans quelques minutes. Vérifie aussi tes spams."
        ),
    }

    if not user:
        return generic

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

    await db.password_reset_tokens.insert_one({
        "token_hash": token_hash,
        "user_id": user["user_id"],
        "email": email,
        "expires_at": expires,
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    await send_password_reset_email(email, raw_token)
    return generic


@api.post("/auth/reset-password")
async def auth_reset_password(payload: ResetPasswordRequest):
    import hashlib

    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()
    record = await db.password_reset_tokens.find_one(
        {"token_hash": token_hash, "used": False},
        {"_id": 0},
    )
    if not record:
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré. Redemande un email.")

    expires_at = datetime.fromisoformat(record["expires_at"].replace("Z", "+00:00"))
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Lien expiré. Redemande un email.")

    await db.users.update_one(
        {"user_id": record["user_id"]},
        {"$set": {"password_hash": _hash_password(payload.new_password)}},
    )
    await db.password_reset_tokens.update_one(
        {"token_hash": token_hash},
        {"$set": {"used": True}},
    )
    await _invalidate_user_sessions(record["user_id"])
    return {"ok": True, "message": "Mot de passe mis à jour. Connecte-toi avec ton nouveau mot de passe."}


@api.post("/auth/verify-email")
async def auth_verify_email(payload: VerifyEmailRequest):
    import hashlib

    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()
    record = await db.email_verification_tokens.find_one(
        {"token_hash": token_hash, "used": False},
        {"_id": 0},
    )
    if not record:
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré.")

    expires_at = datetime.fromisoformat(record["expires_at"].replace("Z", "+00:00"))
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Lien expiré. Redemande un email depuis ton dashboard.")

    await db.users.update_one(
        {"user_id": record["user_id"]},
        {"$set": {"email_verified": True}},
    )
    await db.email_verification_tokens.update_one(
        {"token_hash": token_hash},
        {"$set": {"used": True}},
    )
    return {"ok": True, "message": "Email confirmé ! Tu peux utiliser toutes les fonctionnalités."}


@api.post("/auth/resend-verification")
async def auth_resend_verification(request: Request):
    user = await require_user(request)
    if user_email_verified(user):
        return {"ok": True, "message": "Ton email est déjà vérifié."}
    await _send_email_verification(user["user_id"], user["email"])
    return {
        "ok": True,
        "message": "Email de confirmation renvoyé. Vérifie ta boîte mail et tes spams.",
    }


@api.get("/auth/me")
async def auth_me(request: Request):
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return public_user(user)


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@api.post("/auth/session")
async def create_session_legacy(request: Request, response: Response):
    raise HTTPException(
        status_code=410,
        detail="Route obsolète. Utilise /api/auth/login ou /api/auth/register.",
    )


async def _clear_dev_stripe_ids(user_id: str, user: dict) -> None:
    """Remove fake dev_* Stripe IDs so real Stripe checkout can proceed."""
    import billing

    updates = {}
    cid = user.get("stripe_customer_id")
    sid = user.get("stripe_subscription_id")
    if cid and not billing.is_stripe_customer_id(cid):
        updates["stripe_customer_id"] = None
    if sid and str(sid).startswith("dev_sub_"):
        updates["stripe_subscription_id"] = None
    if updates:
        await db.users.update_one({"user_id": user_id}, {"$set": updates})


async def _apply_subscription(user_id: str, plan: str, subscription_id: str, customer_id: str, period_end: Optional[int], status: str = "active"):
    import billing
    update = {
        "plan": plan,
        "plan_expires_at": billing.period_end_iso(period_end),
        "subscription_status": status,
        "stripe_subscription_id": subscription_id or None,
    }
    if customer_id and billing.is_stripe_customer_id(customer_id):
        update["stripe_customer_id"] = customer_id
    await db.users.update_one({"user_id": user_id}, {"$set": update})


async def _clear_subscription(user_id: str):
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "plan": None,
            "plan_expires_at": None,
            "subscription_status": "canceled",
            "stripe_subscription_id": None,
        }},
    )


# ============================================================
# STRIPE Subscriptions (direct)
# ============================================================
@api.get("/billing/stripe-health")
async def stripe_health():
    """Public Stripe config check — never exposes secret keys."""
    import asyncio
    import billing

    billing.refresh_stripe_api_key()
    key = (os.environ.get("STRIPE_API_KEY") or "").strip()
    configured = billing.stripe_configured()
    mode = None
    if key.startswith(("sk_test_", "rk_test_")):
        mode = "test"
    elif key.startswith(("sk_live_", "rk_live_")):
        mode = "live"
    elif key.startswith(("pk_test_", "pk_live_")):
        mode = "publishable_key_wrong_type"

    if not configured:
        detail = "STRIPE_API_KEY missing, placeholder, or invalid format (need sk_test_... on Railway)."
        if mode == "publishable_key_wrong_type":
            detail = "Wrong key type: use Secret key sk_test_..., not Publishable key pk_test_..."
        return {
            "configured": False,
            "mode": mode,
            "ok": False,
            "webhook_secret_set": bool(os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()),
            "detail": detail,
        }

    try:
        acct = await asyncio.to_thread(stripe.Account.retrieve)
        return {
            "configured": True,
            "mode": mode,
            "ok": True,
            "webhook_secret_set": bool(os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()),
            "charges_enabled": bool(billing.stripe_field(acct, "charges_enabled")),
            "details_submitted": bool(billing.stripe_field(acct, "details_submitted")),
        }
    except StripeError as e:
        return {
            "configured": True,
            "mode": mode,
            "ok": False,
            "webhook_secret_set": bool(os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()),
            "detail": e.user_message or str(e),
        }
    except Exception as e:
        return {
            "configured": True,
            "mode": mode,
            "ok": False,
            "webhook_secret_set": bool(os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()),
            "detail": str(e),
        }


@api.post("/checkout/session")
async def create_checkout_session(req: CheckoutRequest, request: Request, user: dict = Depends(require_verified_email)):
    if req.plan not in PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan")

    import billing

    success_url = f"{req.origin_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{req.origin_url}/pricing"

    # Dev: activate plan locally when Stripe is not configured
    if IS_DEV and not billing.stripe_configured():
        session_id = f"dev_{uuid.uuid4().hex[:16]}"
        period_end = int((datetime.now(timezone.utc) + timedelta(days=30)).timestamp())
        customer_id = user.get("stripe_customer_id") or f"dev_cus_{user['user_id']}"
        sub_id = f"dev_sub_{uuid.uuid4().hex[:12]}"
        await _apply_subscription(
            user["user_id"],
            req.plan,
            sub_id,
            customer_id,
            period_end,
        )
        await db.payment_transactions.insert_one({
            "session_id": session_id,
            "user_id": user["user_id"],
            "email": user["email"],
            "plan": req.plan,
            "amount": PLANS[req.plan]["price"],
            "currency": PLANS[req.plan]["currency"],
            "payment_status": "paid",
            "status": "complete",
            "metadata": {"user_id": user["user_id"], "plan": req.plan, "dev_mode": True},
            "created_at": datetime.now(timezone.utc).isoformat(),
            "paid_at": datetime.now(timezone.utc).isoformat(),
        })
        url = success_url.replace("{CHECKOUT_SESSION_ID}", session_id)
        logger.info("Dev checkout: activated %s for user %s", req.plan, user["user_id"])
        return {"url": url, "session_id": session_id, "dev_mode": True}

    try:
        await _clear_dev_stripe_ids(user["user_id"], user)
        session = await billing.create_subscription_checkout(
            user_id=user["user_id"],
            email=user["email"],
            plan=req.plan,
            success_url=success_url,
            cancel_url=cancel_url,
            customer_id=billing.resolve_stripe_customer_id(user.get("stripe_customer_id")),
        )
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except StripeError as e:
        logger.exception("Stripe checkout failed")
        raise HTTPException(status_code=502, detail=f"Stripe: {e.user_message or str(e)}")

    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": user["user_id"],
        "email": user["email"],
        "plan": req.plan,
        "amount": PLANS[req.plan]["price"],
        "currency": PLANS[req.plan]["currency"],
        "payment_status": "initiated",
        "status": "pending",
        "metadata": {"user_id": user["user_id"], "plan": req.plan},
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": session.url, "session_id": session.session_id}


@api.get("/checkout/status/{session_id}")
async def checkout_status(session_id: str, request: Request):
    import billing

    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    user = await get_current_user(request)
    if user and tx.get("user_id") != user.get("user_id"):
        raise HTTPException(
            status_code=403,
            detail="Cette session de paiement ne correspond pas à ton compte",
        )
    owner_id = tx["user_id"]

    if session_id.startswith("dev_") or (tx.get("metadata") or {}).get("dev_mode"):
        return {
            "status": tx.get("status", "complete"),
            "payment_status": tx.get("payment_status", "paid"),
            "plan": tx.get("plan"),
        }

    if not billing.stripe_configured():
        raise HTTPException(status_code=503, detail="Stripe non configuré")

    try:
        status = await billing.get_checkout_status(session_id)
    except StripeError as e:
        raise HTTPException(status_code=502, detail=f"Stripe: {e.user_message or str(e)}")
    except Exception as e:
        logger.exception("checkout status failed for %s", session_id)
        raise HTTPException(status_code=502, detail=f"Checkout status error: {e}")

    if status.payment_status == "paid" and tx["payment_status"] != "paid":
        await _apply_subscription(
            owner_id,
            tx["plan"],
            status.subscription_id or "",
            billing.resolve_stripe_customer_id(status.customer_id)
            or billing.resolve_stripe_customer_id(
                (await db.users.find_one({"user_id": owner_id}, {"_id": 0}) or {}).get("stripe_customer_id")
            )
            or "",
            status.period_end,
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
        "plan": tx.get("plan"),
    }


@api.post("/billing/portal")
async def billing_portal(request: Request, user: dict = Depends(require_user)):
    import billing

    await _clear_dev_stripe_ids(user["user_id"], user)
    customer_id = billing.resolve_stripe_customer_id(user.get("stripe_customer_id"))
    if not customer_id:
        raise HTTPException(
            status_code=400,
            detail="Aucun abonnement Stripe actif. Souscris d'abord via la page Abonnements.",
        )
    body = await request.json()
    return_url = body.get("return_url") or str(request.base_url)
    url = await billing.create_billing_portal(customer_id, return_url)
    return {"url": url}


@api.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    import billing

    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        event = await billing.parse_webhook(body, sig)
    except Exception as e:
        logger.exception("Stripe webhook error")
        raise HTTPException(status_code=400, detail=str(e))

    if not event:
        return {"ok": True}

    if event["kind"] == "checkout_completed":
        user_id = event.get("user_id")
        plan = event.get("plan")
        if user_id and plan:
            status = await billing.get_checkout_status(event["session_id"])
            await _apply_subscription(
                user_id,
                plan,
                event.get("subscription_id") or "",
                event.get("customer_id") or "",
                status.period_end,
            )
            await db.payment_transactions.update_one(
                {"session_id": event["session_id"]},
                {"$set": {"payment_status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}},
            )

    elif event["kind"] == "subscription_updated":
        user_id = event.get("user_id")
        if user_id and event.get("status") in ("active", "trialing"):
            plan = event.get("plan")
            if plan:
                await _apply_subscription(
                    user_id,
                    plan,
                    event.get("subscription_id") or "",
                    event.get("customer_id") or "",
                    event.get("period_end"),
                    event.get("status"),
                )
        elif user_id and event.get("status") in ("canceled", "unpaid", "past_due"):
            await _clear_subscription(user_id)

    elif event["kind"] == "subscription_deleted":
        user_id = event.get("user_id")
        if user_id:
            await _clear_subscription(user_id)

    return {"ok": True}

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
# VIDEO ANALYSIS (GPT-4o vision — reads extracted video frames)
# ============================================================
VIDEO_ANALYSIS_MAX_MB = 100
VIDEO_ANALYSIS_MAX_SECONDS = 20
CHUNK_UPLOAD_DIR = UPLOAD_DIR / "chunks"
CHUNK_UPLOAD_DIR.mkdir(exist_ok=True)

# Pending uploads (upload_id -> path) — cleaned after analyze or after 2h
_pending_uploads: dict[str, dict] = {}


def _session_token_from_request(request: Request) -> Optional[str]:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization") or ""
        if auth.startswith("Bearer "):
            token = auth[7:].strip()
    return token or None


@api.get("/auth/upload-config")
async def auth_upload_config(request: Request):
    """Return direct API URL + session token for large uploads (bypasses Vercel proxy limits)."""
    user = await require_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = _session_token_from_request(request)
    if not token:
        raise HTTPException(status_code=401, detail="Session requise")
    from gpt_vision import openai_configured, get_active_vision_model

    direct = os.environ.get("PUBLIC_API_URL", "").strip().rstrip("/")
    if not direct:
        # Never use request.base_url — behind Vercel proxy it can point back to the frontend.
        direct = "https://rideup5-production.up.railway.app"
    return {
        "direct_api_url": direct,
        "session_token": token,
        "vision_ready": openai_configured(),
        "vision_model": get_active_vision_model(),
    }


async def _save_video_upload(video: UploadFile) -> tuple[Path, str, int]:
    if not video.filename:
        raise HTTPException(status_code=400, detail="Vidéo requise pour l'analyse visuelle")

    ext = (video.filename or "video.mp4").split(".")[-1][:5]
    upload_id = uuid.uuid4().hex
    video_filename = f"{upload_id}.{ext}"
    path = UPLOAD_DIR / video_filename
    content = await video.read()
    video_size = len(content)
    if video_size > VIDEO_ANALYSIS_MAX_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Vidéo trop lourde (max {VIDEO_ANALYSIS_MAX_MB} MB)")
    if video_size == 0:
        raise HTTPException(status_code=400, detail="Fichier vidéo vide")

    with open(path, "wb") as f:
        f.write(content)

    import asyncio
    from video_frames import get_video_duration_seconds

    duration_sec = await asyncio.to_thread(get_video_duration_seconds, path)
    if duration_sec > VIDEO_ANALYSIS_MAX_SECONDS:
        path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail=(
                f"Vidéo trop longue ({duration_sec:.1f}s). "
                f"Maximum {VIDEO_ANALYSIS_MAX_SECONDS} secondes pour l'analyse."
            ),
        )

    _pending_uploads[upload_id] = {
        "path": path,
        "filename": video_filename,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    return path, upload_id, int(duration_sec * 10) / 10.0


def _resolve_pending_upload(upload_id: str) -> tuple[Path, str]:
    pending = _pending_uploads.pop(upload_id, None)
    if pending:
        return pending["path"], pending["filename"]
    matches = sorted(UPLOAD_DIR.glob(f"{upload_id}.*"))
    if not matches:
        raise HTTPException(status_code=404, detail="Upload expiré ou introuvable. Renvoie ta vidéo.")
    path = matches[0]
    return path, path.name


class VideoAnalyzeRequest(BaseModel):
    upload_id: str = Field(min_length=8, max_length=64)
    sport: str
    level: str
    description: str = ""
    trick: str = ""
    problem: str = ""
    conditions: str = ""


class VideoChunkRequest(BaseModel):
    upload_id: str = Field(min_length=8, max_length=64)
    chunk_index: int = Field(ge=0)
    chunk_total: int = Field(ge=1, le=500)
    data: str = Field(min_length=1)


class VideoCompleteRequest(BaseModel):
    upload_id: str = Field(min_length=8, max_length=64)
    filename: str = Field(min_length=1, max_length=200)
    sport: str
    level: str
    description: str = ""
    trick: str = ""
    problem: str = ""
    conditions: str = ""


async def _enqueue_analysis_job(
    user: dict,
    path: Path,
    *,
    sport_key: str,
    level: str,
    trick_text: str,
    problem_text: str,
    conditions_text: str,
    description_saved: str,
    duration_sec: float,
) -> str:
    job_id = f"job_{uuid.uuid4().hex[:16]}"
    now = datetime.now(timezone.utc).isoformat()
    await db.video_analysis_jobs.insert_one({
        "job_id": job_id,
        "user_id": user["user_id"],
        "status": "queued",
        "progress": "uploaded",
        "path": str(path),
        "video_filename": path.name,
        "sport_key": sport_key,
        "level": level,
        "trick_text": trick_text,
        "problem_text": problem_text,
        "conditions_text": conditions_text,
        "description_saved": description_saved,
        "duration_sec": duration_sec,
        "error": None,
        "result": None,
        "created_at": now,
        "updated_at": now,
    })
    import asyncio
    asyncio.create_task(_execute_analysis_job(job_id))
    return job_id


async def _run_video_analysis_for_user(
    user: dict,
    path: Path,
    video_filename: str,
    *,
    sport_key: str,
    level: str,
    trick_text: str,
    problem_text: str,
    conditions_text: str,
    description_saved: str,
    duration_sec: float,
    job_id: Optional[str] = None,
):
    import asyncio
    from video_frames import extract_video_frames
    from gpt_vision import analyze_session_video, get_active_vision_model, parse_structured_json
    from video_analysis_prompts import (
        build_rider_context,
        kitesurf_problem_label,
        kitesurf_trick_label,
        video_analysis_system_prompt,
    )

    if job_id:
        await _update_analysis_job(job_id, progress="extracting_frames")

    try:
        frame_list = await asyncio.to_thread(extract_video_frames, path)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Frame extraction failed")
        raise HTTPException(status_code=500, detail=f"Impossible d'extraire les images de la vidéo: {e}")

    frame_times = [f["time_sec"] for f in frame_list]
    user_text = build_rider_context(
        sport=sport_key,
        level=level,
        trick=trick_text,
        problem=problem_text,
        conditions=conditions_text,
        duration_sec=duration_sec or 0.0,
        frame_count=len(frame_list),
        frame_times=frame_times,
    )

    if job_id:
        await _update_analysis_job(job_id, progress="analyzing")

    try:
        ai_response = await analyze_session_video(
            video_analysis_system_prompt(sport_key),
            user_text,
            frame_list,
            dev_fallback=IS_DEV,
            sport=sport_key,
            level=level,
            trick=trick_text,
            problem=problem_text,
        )
    except RuntimeError as e:
        logger.exception("GPT vision error")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("GPT vision error")
        raise HTTPException(status_code=500, detail=f"Analyse vidéo IA échouée: {e}")

    structured = clean_structured(parse_structured_json(ai_response, level))
    if isinstance(structured, dict):
        structured["frames_analyzed"] = len(frame_list)
    dev_mode = structured.pop("_dev_mode", None) if isinstance(structured, dict) else None

    detected_trick = (structured.get("figure_observee") or "").strip()
    detected_problem = (structured.get("probleme_identifie") or "").strip()
    if sport_key == "kitesurf":
        trick_saved = kitesurf_trick_label(structured)
        problem_saved = kitesurf_problem_label(structured) or problem_text
    else:
        trick_saved = trick_text or detected_trick
        problem_saved = problem_text or detected_problem
        if not trick_saved and structured.get("figure_declaree"):
            trick_saved = (structured.get("figure_declaree") or "").strip()
    if trick_saved or problem_saved:
        if sport_key == "kitesurf":
            description_saved = (
                f"Figure (vidéo) : {trick_saved or '—'}"
                + (f"\nRéception : {problem_saved}" if problem_saved else "")
                + (f"\nContexte : {conditions_text}" if conditions_text else "")
            )
        elif not trick_text and not problem_text:
            description_saved = (
                f"Figure (IA) : {trick_saved or '—'}\nProblème (IA) : {problem_saved or '—'}"
                + (f"\nContexte : {conditions_text}" if conditions_text else "")
            )
        else:
            description_saved = (
                f"Figure : {trick_saved or '—'}\nProblème : {problem_saved or '—'}"
                + (f"\nContexte : {conditions_text}" if conditions_text else "")
            )

    if structured.get("video_valide") is False:
        path.unlink(missing_ok=True)
        reason = (structured.get("raison_rejet") or "").strip()
        raise HTTPException(
            status_code=422,
            detail=reason or (
                "Cette vidéo ne correspond pas au sport ou à la figure décrite. "
                "Envoie un clip de ta session (kite, wake, foil ou surf)."
            ),
        )
    structured.pop("video_valide", None)
    structured.pop("raison_rejet", None)

    if job_id:
        await _update_analysis_job(job_id, progress="saving")

    record = {
        "analysis_id": f"an_{uuid.uuid4().hex[:12]}",
        "user_id": user["user_id"],
        "sport": sport_key,
        "level": level,
        "description": description_saved,
        "trick": trick_saved,
        "problem": problem_saved,
        "conditions": conditions_text,
        "video_filename": video_filename,
        "analysis_mode": "dev-demo" if dev_mode else get_active_vision_model() + "-vision",
        "frames_analyzed": len(frame_list),
        "feedback": ai_response,
        "structured": structured,
        "dev_mode": bool(dev_mode),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.video_analyses.insert_one(record)
    record.pop("_id", None)
    return record


def _video_form_metadata(
    sport: str,
    level: str,
    description: str,
    trick: str,
    problem: str,
    conditions: str,
) -> tuple[str, str, str, str, str, str]:
    from video_analysis_prompts import SUPPORTED_SPORTS

    sport_key = (sport or "").lower().strip()
    if sport_key not in SUPPORTED_SPORTS:
        raise HTTPException(
            status_code=400,
            detail=f"Sport non supporté. Choisis : {', '.join(SUPPORTED_SPORTS)}.",
        )

    trick_text = (trick or "").strip()
    problem_text = (problem or "").strip()
    conditions_text = (conditions or "").strip()
    legacy_desc = (description or "").strip()

    if not trick_text and legacy_desc:
        trick_text = legacy_desc
    if not problem_text and legacy_desc and not trick:
        problem_text = legacy_desc

    if trick_text and problem_text:
        description_saved = (
            f"Figure : {trick_text}\nProblème : {problem_text}"
            + (f"\nContexte : {conditions_text}" if conditions_text else "")
        )
    elif trick_text or problem_text:
        parts = []
        if trick_text:
            parts.append(f"Figure : {trick_text}")
        if problem_text:
            parts.append(f"Problème : {problem_text}")
        if conditions_text:
            parts.append(f"Contexte : {conditions_text}")
        description_saved = "\n".join(parts)
    else:
        description_saved = (
            "Auto-détection (figure et problème identifiés par l'IA)"
            + (f"\nContexte : {conditions_text}" if conditions_text else "")
        )

    return sport_key, trick_text, problem_text, conditions_text, description_saved, level


async def _update_analysis_job(job_id: str, **fields) -> None:
    fields["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.video_analysis_jobs.update_one({"job_id": job_id}, {"$set": fields})


async def _execute_analysis_job(job_id: str) -> None:
    job = await db.video_analysis_jobs.find_one({"job_id": job_id})
    if not job:
        return

    path = Path(job["path"])
    user = {"user_id": job["user_id"]}

    try:
        await _update_analysis_job(job_id, status="processing", progress="extracting_frames")
        result = await _run_video_analysis_for_user(
            user,
            path,
            job["video_filename"],
            sport_key=job["sport_key"],
            level=job["level"],
            trick_text=job.get("trick_text", ""),
            problem_text=job.get("problem_text", ""),
            conditions_text=job.get("conditions_text", ""),
            description_saved=job.get("description_saved", ""),
            duration_sec=float(job.get("duration_sec") or 0),
            job_id=job_id,
        )
        await _update_analysis_job(
            job_id,
            status="completed",
            progress="done",
            result=result,
            error=None,
        )
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
        logger.exception("Analysis job %s failed (HTTP)", job_id)
        await _update_analysis_job(job_id, status="failed", progress="done", error=detail)
    except Exception as exc:
        logger.exception("Analysis job %s failed", job_id)
        await _update_analysis_job(job_id, status="failed", progress="done", error=str(exc))
    finally:
        path.unlink(missing_ok=True)
        await db.video_analysis_jobs.update_one(
            {"job_id": job_id},
            {"$set": {"path": None, "updated_at": datetime.now(timezone.utc).isoformat()}},
        )


@api.post("/video-analysis/upload")
async def video_analysis_upload(request: Request, video: UploadFile = File(...)):
    """Upload video only — prefer single-shot /video-analysis on direct Railway URL."""
    await require_active_plan(request)
    path, upload_id, duration_sec = await _save_video_upload(video)
    return {
        "upload_id": upload_id,
        "duration_sec": duration_sec,
        "filename": path.name,
    }


@api.post("/video-analysis/analyze")
async def video_analysis_analyze(payload: VideoAnalyzeRequest, request: Request):
    user = await require_active_plan(request)
    path, filename = _resolve_pending_upload(payload.upload_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Fichier vidéo introuvable. Renvoie ta vidéo.")

    sport_key, trick_text, problem_text, conditions_text, description_saved, level = _video_form_metadata(
        payload.sport,
        payload.level,
        payload.description,
        payload.trick,
        payload.problem,
        payload.conditions,
    )

    import asyncio
    from video_frames import get_video_duration_seconds

    duration_sec = await asyncio.to_thread(get_video_duration_seconds, path)

    try:
        return await _run_video_analysis_for_user(
            user,
            path,
            filename,
            sport_key=sport_key,
            level=level,
            trick_text=trick_text,
            problem_text=problem_text,
            conditions_text=conditions_text,
            description_saved=description_saved,
            duration_sec=duration_sec,
        )
    finally:
        path.unlink(missing_ok=True)


@api.post("/video-analysis")
async def video_analysis(
    request: Request,
    sport: str = Form(...),
    level: str = Form(...),
    description: str = Form(""),
    trick: str = Form(""),
    problem: str = Form(""),
    conditions: str = Form(""),
    video: UploadFile = File(...),
):
    """Accept video upload, queue background analysis, return job_id for polling."""
    user = await require_active_plan(request)
    sport_key, trick_text, problem_text, conditions_text, description_saved, level = _video_form_metadata(
        sport, level, description, trick, problem, conditions,
    )
    path, upload_id, duration_sec = await _save_video_upload(video)
    _pending_uploads.pop(upload_id, None)

    job_id = await _enqueue_analysis_job(
        user,
        path,
        sport_key=sport_key,
        level=level,
        trick_text=trick_text,
        problem_text=problem_text,
        conditions_text=conditions_text,
        description_saved=description_saved,
        duration_sec=duration_sec,
    )

    return JSONResponse(
        status_code=202,
        content={
            "job_id": job_id,
            "status": "queued",
            "duration_sec": duration_sec,
            "message": "Analyse lancée — suis la progression via le job_id.",
        },
    )


@api.post("/video-analysis/chunk")
async def video_analysis_chunk(payload: VideoChunkRequest, request: Request):
    """Receive one base64 chunk (same-origin, avoids Vercel/CORS upload limits)."""
    user = await require_active_plan(request)
    try:
        raw = base64.b64decode(payload.data, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Chunk vidéo invalide")
    if len(raw) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Chunk trop volumineux (max 2 Mo)")

    chunk_dir = CHUNK_UPLOAD_DIR / payload.upload_id
    chunk_dir.mkdir(parents=True, exist_ok=True)
    meta_path = chunk_dir / "meta.json"
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        if meta.get("user_id") != user["user_id"]:
            raise HTTPException(status_code=403, detail="Upload non autorisé")
        if meta.get("chunk_total") != payload.chunk_total:
            raise HTTPException(status_code=400, detail="Nombre de chunks incohérent")
    else:
        meta_path.write_text(
            json.dumps({"user_id": user["user_id"], "chunk_total": payload.chunk_total}),
            encoding="utf-8",
        )

    (chunk_dir / f"{payload.chunk_index:05d}").write_bytes(raw)
    return {"ok": True, "chunk_index": payload.chunk_index, "chunk_total": payload.chunk_total}


@api.post("/video-analysis/complete")
async def video_analysis_complete(payload: VideoCompleteRequest, request: Request):
    """Assemble chunked upload and queue background analysis."""
    user = await require_active_plan(request)
    chunk_dir = CHUNK_UPLOAD_DIR / payload.upload_id
    meta_path = chunk_dir / "meta.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Upload introuvable — renvoie la vidéo")

    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    if meta.get("user_id") != user["user_id"]:
        raise HTTPException(status_code=403, detail="Upload non autorisé")

    parts = sorted(p for p in chunk_dir.iterdir() if p.name.isdigit())
    expected = int(meta.get("chunk_total") or 0)
    if len(parts) != expected:
        raise HTTPException(
            status_code=400,
            detail=f"Chunks manquants ({len(parts)}/{expected}). Réessaie l'envoi.",
        )

    ext = (payload.filename or "video.mp4").split(".")[-1][:5]
    path = UPLOAD_DIR / f"{payload.upload_id}.{ext}"
    with open(path, "wb") as out:
        for part in parts:
            out.write(part.read_bytes())
    shutil.rmtree(chunk_dir, ignore_errors=True)

    import asyncio
    from video_frames import get_video_duration_seconds

    video_size = path.stat().st_size
    if video_size > VIDEO_ANALYSIS_MAX_MB * 1024 * 1024:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Vidéo trop lourde (max {VIDEO_ANALYSIS_MAX_MB} MB)")
    if video_size == 0:
        path.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Fichier vidéo vide")

    duration_sec = await asyncio.to_thread(get_video_duration_seconds, path)
    if duration_sec > VIDEO_ANALYSIS_MAX_SECONDS:
        path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail=(
                f"Vidéo trop longue ({duration_sec:.1f}s). "
                f"Maximum {VIDEO_ANALYSIS_MAX_SECONDS} secondes pour l'analyse."
            ),
        )

    sport_key, trick_text, problem_text, conditions_text, description_saved, level = _video_form_metadata(
        payload.sport,
        payload.level,
        payload.description,
        payload.trick,
        payload.problem,
        payload.conditions,
    )

    job_id = await _enqueue_analysis_job(
        user,
        path,
        sport_key=sport_key,
        level=level,
        trick_text=trick_text,
        problem_text=problem_text,
        conditions_text=conditions_text,
        description_saved=description_saved,
        duration_sec=duration_sec,
    )

    return JSONResponse(
        status_code=202,
        content={
            "job_id": job_id,
            "status": "queued",
            "duration_sec": duration_sec,
            "message": "Analyse lancée — suis la progression via le job_id.",
        },
    )


@api.get("/video-analysis/jobs/{job_id}")
async def get_video_analysis_job(job_id: str, request: Request):
    user = await require_user(request)
    job = await db.video_analysis_jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job or job.get("user_id") != user["user_id"]:
        raise HTTPException(status_code=404, detail="Analyse introuvable")
    return {
        "job_id": job_id,
        "status": job.get("status", "queued"),
        "progress": job.get("progress"),
        "error": job.get("error"),
        "result": job.get("result"),
        "duration_sec": job.get("duration_sec"),
    }


@api.get("/video-analysis/history")
async def video_history(request: Request):
    user = await require_user(request)
    items = await db.video_analyses.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return items

# ============================================================
# SPOT RECOMMENDER (Premium) — Windguru GFS + AI
# ============================================================
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

@api.get("/spots/countries")
async def spots_countries():
    """Pays du catalogue Windguru avec nombre de spots."""
    from windguru import list_countries, load_spots

    return {
        "catalog_total": len(load_spots()),
        "countries": list_countries(),
    }


@api.get("/spots/catalog")
async def spots_catalog(
    country: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
):
    """Catalogue Windguru (~6000+ spots). Prévisions à la demande."""
    from windguru import filter_spots, load_spots, public_spot

    all_spots = load_spots()
    spots = filter_spots(all_spots, country=country, search=search)
    offset = max(0, offset)
    limit = max(1, min(limit, 500))
    page = spots[offset : offset + limit]
    return {
        "catalog_total": len(all_spots),
        "count": len(spots),
        "offset": offset,
        "limit": limit,
        "spots": [public_spot(s) for s in page],
    }


@api.get("/spots/weather")
async def spots_weather(country: Optional[str] = None, search: Optional[str] = None, limit: int = 40):
    """Vent actuel par spot."""
    from windguru import current_wind_from_hours, fetch_forecasts_batch, filter_spots, load_spots, public_spot

    spots = filter_spots(load_spots(), country=country, search=search)
    spots = spots[: max(1, min(limit, 80))]
    forecasts = await fetch_forecasts_batch([s["wg_id"] for s in spots])
    results = []
    for s in spots:
        cur = current_wind_from_hours(forecasts.get(s["wg_id"], []))
        results.append(public_spot({
            **s,
            "wind_kts": cur["wind_kts"] if cur else None,
            "wind_dir": cur["wind_deg"] if cur else None,
            "gust_kts": cur.get("gust_kts") if cur else None,
        }))
    return results


@api.post("/spot-recommend")
async def spot_recommend(req: SpotRecommendRequest, request: Request):
    user = await require_premium_plan(request)
    from datetime import date as _date
    from windguru import (
        MAX_RECOMMEND_CANDIDATES,
        fetch_forecasts_batch,
        load_spots,
        public_spot,
        select_forecast_candidates,
        wind_at_datetime,
    )

    today = _date.today()
    try:
        target_date = _date.fromisoformat(req.target_date) if req.target_date else today
    except Exception:
        target_date = today
    max_date = today + timedelta(days=10)
    if target_date < today:
        target_date = today
    if target_date > max_date:
        target_date = max_date
    target_hour = max(0, min(23, int(req.target_hour)))

    all_spots = load_spots()
    has_geo = req.user_lat is not None and req.user_lon is not None
    candidate_spots, _ = select_forecast_candidates(
        all_spots,
        limit=MAX_RECOMMEND_CANDIDATES,
        user_lat=req.user_lat if has_geo else None,
        user_lon=req.user_lon if has_geo else None,
        max_distance_km=req.max_distance_km if has_geo else None,
        priority_countries=not has_geo,
    )

    if not candidate_spots:
        return {"top_spots": [], "ai_advice": "Aucun spot trouvé dans ce rayon. Augmente la distance pour découvrir d'autres options.", "requested": req.model_dump(), "target_date": target_date.isoformat(), "target_hour": target_hour}

    forecasts = await fetch_forecasts_batch([s["wg_id"] for s in candidate_spots])
    spots = []
    for s in candidate_spots:
        hour = wind_at_datetime(forecasts.get(s["wg_id"], []), target_date, target_hour)
        spots.append({
            **s,
            "wind_kts_now": hour.wind_kts if hour else None,
            "wind_dir_now": hour.wind_deg if hour else None,
        })

    def best_kite(quiver, wind_kts, weight_kg):
        if not quiver or wind_kts is None:
            return None
        # Heuristic: ideal kite size ≈ 600 / wind_kts (adjusted by weight: heavier rider => bigger kite)
        weight_factor = weight_kg / 75.0
        ideal = (600 / max(8, wind_kts)) * weight_factor
        # Pick closest size in quiver
        return min(quiver, key=lambda k: abs(k - ideal))

    # Score each spot
    from spot_safety import level_match_bonus, rider_may_use_spot, safety_ok_flag

    level_rank = {"beginner": 1, "intermediate": 2, "advanced": 3, "pro": 4}
    user_lvl = level_rank.get(req.level.lower(), 2)
    scored = []
    for s in spots:
        if s["wind_kts_now"] is None:
            continue
        if not rider_may_use_spot(req.level, s):
            continue
        wind = s["wind_kts_now"]
        ideal_min, ideal_max = s["ideal_kts"]
        in_range = ideal_min <= wind <= ideal_max
        kite_pick = best_kite(req.quiver, wind, req.weight_kg)
        quiver_ok = True
        if req.quiver and kite_pick is not None:
            ideal_size = (600 / max(8, wind)) * (req.weight_kg / 75.0)
            quiver_ok = abs(kite_pick - ideal_size) <= 3
        score = 0
        if in_range:
            score += 50
        else:
            d = min(abs(wind - ideal_min), abs(wind - ideal_max))
            score += max(0, 30 - d * 2)
        score += level_match_bonus(req.level, s)
        if quiver_ok:
            score += 15
        if "distance_km" in s and req.max_distance_km:
            score += max(0, 10 - (s["distance_km"] / req.max_distance_km) * 10)
        scored.append({
            **s,
            "score": round(score, 1),
            "in_ideal_range": in_range,
            "safety_ok": safety_ok_flag(req.level, s),
            "recommended_kite": kite_pick,
            "quiver_ok": quiver_ok,
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    top3 = [public_spot(s) for s in scored[:3]]

    # AI commentary
    from ridemind_llm.llm.chat import LlmChat, UserMessage
    from llm_config import anthropic_api_key
    chat = LlmChat(
        api_key=anthropic_api_key(),
        session_id=f"sr_{uuid.uuid4().hex}",
        system_message=(
            "Tu es un expert en spots de kitesurf. Donne en français un conseil concis (3-5 phrases) "
            "sur le meilleur spot pour le rider donné, en justifiant vent, niveau, danger du spot et sécurité. "
            "Si le spot est engagé (danger élevé/expert), rappelle les risques sans minimiser. "
            "REGLES DE STYLE: texte courant uniquement, aucun markdown, pas d'emojis."
        ),
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    if not top3:
        return {"top_spots": [], "ai_advice": "Pas de spot ventilé à cette date/heure. Essaie un autre créneau ou élargis ta zone.", "requested": req.model_dump(), "target_date": target_date.isoformat(), "target_hour": target_hour}
    dist_info = f", à {top3[0]['distance_km']} km" if "distance_km" in top3[0] else ""
    quiver_str = ", ".join([f"{k}m" for k in req.quiver]) if req.quiver else "non renseigné"
    kite_pick_str = f"{top3[0]['recommended_kite']}m" if top3[0].get("recommended_kite") else "à adapter"
    user_msg = (
        f"Rider: {req.weight_kg} kg, niveau {req.level}, quiver {quiver_str}, board {req.board_size} cm, sport {req.sport}.\n"
        f"Créneau visé: {target_date.isoformat()} à {target_hour}h locale.\n"
        f"Top spot proposé: {top3[0]['name']}{dist_info} avec vent prévu {top3[0]['wind_kts_now']} kts (idéal {top3[0]['ideal_kts'][0]}-{top3[0]['ideal_kts'][1]} kts, danger {top3[0].get('danger_label', 'modéré')}, type {top3[0]['type']}).\n"
        f"Alertes spot: {', '.join(top3[0].get('hazards', [])[:4]) or 'aucune renseignée'}.\n"
        f"Kite recommandé du quiver: {kite_pick_str}.\n"
        "Donne ton verdict, le choix du kite, et une recommandation sécurité."
    )
    try:
        ai_comment = await chat.send_message(UserMessage(text=user_msg))
    except Exception:
        ai_comment = "Conseil IA indisponible pour le moment."

    ai_comment = strip_markdown(ai_comment)

    return {
        "top_spots": top3,
        "ai_advice": ai_comment,
        "requested": req.model_dump(),
        "target_date": target_date.isoformat(),
        "target_hour": target_hour,
    }

# ============================================================
# Health
# ============================================================
@api.get("/spots/weekend-page")
async def spots_weekend_page(country: Optional[str] = None, limit: int = 12):
    """Pays + classement week-end en une seule requête (cache serveur)."""
    from windguru import list_countries, preload_catalog, weekend_ranking

    preload_catalog()
    forecast = await weekend_ranking(country=country, limit=limit)
    return {"countries": list_countries(), "forecast": forecast}


@api.get("/spots/weekend-forecast")
async def spots_weekend_forecast(
    user_lat: Optional[float] = None,
    user_lon: Optional[float] = None,
    max_distance_km: Optional[float] = None,
    country: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 12,
):
    """Classement week-end par pays — prévisions météo sur les meilleurs candidats."""
    from windguru import weekend_ranking

    return await weekend_ranking(
        user_lat=user_lat,
        user_lon=user_lon,
        max_distance_km=max_distance_km,
        country=country,
        search=search,
        limit=limit,
    )


@api.get("/")
async def root():
    return {"app": "RIDE'UP", "status": "ok", "db": get_backend()}


# ============================================================
# COACH (personal trick-by-trick progression)
# ============================================================

class CoachOnboarding(BaseModel):
    level: str  # Débutant | Intermédiaire | Avancé | Pro
    sport: str = "kitesurf"
    current_tricks: List[str] = []  # tricks already mastered
    goal: str = ""  # free-text goal


class CoachChatRequest(BaseModel):
    message: str


@api.get("/coach/profile")
async def get_coach_profile(request: Request):
    user = await require_active_plan(request)
    profile = await db.coach_profiles.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return profile  # may be None if not onboarded yet


@api.post("/coach/onboarding")
async def coach_onboarding(payload: CoachOnboarding, request: Request):
    user = await require_active_plan(request)

    # Build a personalised roadmap via the AI
    from ridemind_llm.llm.chat import LlmChat, UserMessage
    from llm_config import anthropic_api_key
    import json as _json
    chat = LlmChat(
        api_key=anthropic_api_key(),
        session_id=f"coach_ob_{uuid.uuid4().hex}",
        system_message=(
            "Tu es RIDE’UP COACH, un coach personnel de kitesurf. Pour le rider donné, "
            "construis une roadmap de 6 à 9 tricks ordonnés du plus simple au plus avancé, "
            "à partir de son niveau et de ses tricks déjà acquis. Réponds UNIQUEMENT par un objet JSON valide :\n"
            "{\n"
            '  "welcome": "phrase d\'accueil personnalisée 1-2 phrases",\n'
            '  "roadmap": [\n'
            '    {"trick": "nom du trick", "why": "1 phrase: pourquoi cette étape", "difficulty": "1 à 5"}\n'
            "  ]\n"
            "}\n"
            "REGLES DE STYLE STRICTES: texte courant, aucun caractère markdown (#, *, **, _, backticks, tirets de liste), "
            "pas d'emojis, pas de mise en gras, phrases naturelles comme à l'oral."
        ),
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    user_msg = (
        f"Sport: {payload.sport}. Niveau: {payload.level}. "
        f"Tricks acquis: {', '.join(payload.current_tricks) if payload.current_tricks else 'aucun'}. "
        f"Objectif: {payload.goal or 'progresser globalement'}."
    )
    try:
        resp = await chat.send_message(UserMessage(text=user_msg))
        cleaned = resp.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
            if cleaned.rstrip().endswith("```"):
                cleaned = cleaned.rstrip()[:-3]
        data = _json.loads(cleaned)
        data = clean_structured(data)
    except Exception:
        data = {
            "welcome": "Bienvenue ! On va construire ensemble ta progression étape par étape.",
            "roadmap": [
                {"trick": "Water start propre", "why": "Base de toute session", "difficulty": "2"},
                {"trick": "Remonter au vent", "why": "Condition pour revenir au point de départ", "difficulty": "2"},
                {"trick": "Transitions douces", "why": "Maîtrise du kite dans la fenêtre", "difficulty": "3"},
                {"trick": "Premier saut", "why": "Pop, send, edge, réception", "difficulty": "3"},
                {"trick": "Back roll", "why": "Première rotation aérienne", "difficulty": "4"},
                {"trick": "Front roll", "why": "Variante rotation avant", "difficulty": "4"},
            ],
        }

    roadmap = [
        {**t, "status": "todo"}
        for t in data.get("roadmap", [])
    ]

    profile = {
        "user_id": user["user_id"],
        "sport": payload.sport,
        "level": payload.level,
        "current_tricks": payload.current_tricks,
        "goal": payload.goal,
        "welcome": data.get("welcome", ""),
        "roadmap": roadmap,
        "messages": [],  # chat history
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    # Upsert (replace previous onboarding)
    await db.coach_profiles.replace_one({"user_id": user["user_id"]}, profile, upsert=True)
    profile.pop("_id", None)
    return profile


@api.post("/coach/trick/complete")
async def complete_trick(request: Request):
    user = await require_active_plan(request)
    body = await request.json()
    trick = body.get("trick")
    profile = await db.coach_profiles.find_one({"user_id": user["user_id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="No coach profile")
    roadmap = profile.get("roadmap", [])
    found = False
    for t in roadmap:
        if t["trick"] == trick:
            t["status"] = "done"
            t["completed_at"] = datetime.now(timezone.utc).isoformat()
            found = True
            break
    if not found:
        raise HTTPException(status_code=404, detail="Trick not found in roadmap")
    await db.coach_profiles.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"roadmap": roadmap, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    profile["roadmap"] = roadmap
    profile.pop("_id", None)
    return profile


@api.post("/coach/chat")
async def coach_chat(payload: CoachChatRequest, request: Request):
    user = await require_active_plan(request)
    profile = await db.coach_profiles.find_one({"user_id": user["user_id"]})
    if not profile:
        raise HTTPException(status_code=404, detail="No coach profile - please complete onboarding first")

    from ridemind_llm.llm.chat import LlmChat, UserMessage
    from llm_config import anthropic_api_key
    history = profile.get("messages", [])
    completed = [t["trick"] for t in profile.get("roadmap", []) if t.get("status") == "done"]
    todo = [t["trick"] for t in profile.get("roadmap", []) if t.get("status") != "done"]
    next_trick = todo[0] if todo else None

    next_trick_or_default = next_trick or "roadmap terminée, propose d'aller plus loin"
    acquired = ', '.join(profile['current_tricks'] + completed) if (profile['current_tricks'] or completed) else 'aucun'
    goal = profile.get('goal') or 'progression continue'
    system = (
        f"Tu es RIDE’UP COACH, coach personnel kitesurf du rider. Niveau actuel: {profile['level']}. "
        f"Tricks déjà acquis: {acquired}. "
        f"Prochain trick visé: {next_trick_or_default}. "
        f"Objectif rider: {goal}. "
        "Tu réponds en français, ton chaleureux et motivant de coach pro, en 2-4 phrases naturelles. "
        "REGLES DE STYLE STRICTES: pas de markdown (#, *, **, _, backticks, listes -), pas d'emojis, "
        "texte courant fluide comme à l'oral."
    )
    # Build a session continuing previous messages
    chat = LlmChat(
        api_key=anthropic_api_key(),
        session_id=f"coach_chat_{user['user_id']}",
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    # Append previous user/assistant turns as context in a single user message (simplified)
    context_chunks = []
    for m in history[-6:]:
        prefix = "Rider:" if m["role"] == "user" else "Coach:"
        context_chunks.append(f"{prefix} {m['text']}")
    context_chunks.append(f"Rider: {payload.message}")
    full_msg = "\n".join(context_chunks)
    try:
        ai_resp = await chat.send_message(UserMessage(text=full_msg))
        ai_resp = strip_markdown(ai_resp)
    except Exception as e:
        logger.exception("coach chat error")
        raise HTTPException(status_code=500, detail=f"Coach error: {e}")

    now_iso = datetime.now(timezone.utc).isoformat()
    history.append({"role": "user", "text": payload.message, "at": now_iso})
    history.append({"role": "coach", "text": ai_resp, "at": now_iso})
    await db.coach_profiles.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"messages": history, "updated_at": now_iso}},
    )
    return {"reply": ai_resp, "messages": history[-20:]}


# ============================================================
# DASHBOARD STATS
# ============================================================

@api.get("/dashboard/stats")
async def dashboard_stats(request: Request):
    user = await require_user(request)
    user_id = user["user_id"]

    # Counters
    analyses = await db.video_analyses.find({"user_id": user_id}, {"_id": 0}).to_list(500)
    total_analyses = len(analyses)

    profile = await db.coach_profiles.find_one({"user_id": user_id}, {"_id": 0})
    roadmap = (profile or {}).get("roadmap", [])
    tricks_done = sum(1 for t in roadmap if t.get("status") == "done")
    tricks_total = len(roadmap)

    # Weekly buckets for last 8 weeks
    from collections import defaultdict
    week_buckets = defaultdict(int)
    now = datetime.now(timezone.utc)
    for a in analyses:
        try:
            d = datetime.fromisoformat(a["created_at"].replace("Z", "+00:00"))
        except Exception:
            continue
        delta_days = (now - d).days
        if delta_days < 0:
            continue
        wk = delta_days // 7
        if wk < 8:
            week_buckets[wk] += 1
    # Build chart array oldest-to-newest (7 weeks ago -> this week)
    chart = []
    for i in range(7, -1, -1):
        chart.append({"week_offset": i, "count": week_buckets.get(i, 0)})

    # Days since onboarding / first analysis
    start_iso = None
    if profile:
        start_iso = profile.get("created_at")
    elif analyses:
        start_iso = min(a["created_at"] for a in analyses)
    days_active = 0
    if start_iso:
        try:
            start_dt = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
            days_active = max(1, (now - start_dt).days)
        except Exception:
            days_active = 1

    # Generate an AI encouragement message
    encouragement = ""
    if total_analyses > 0 or tricks_done > 0:
        try:
            from ridemind_llm.llm.chat import LlmChat, UserMessage
            from llm_config import anthropic_api_key
            ai = LlmChat(
                api_key=anthropic_api_key(),
                session_id=f"dash_{user_id}_{now.date().isoformat()}",
                system_message=(
                    "Tu es RIDE’UP COACH. Tu écris un message d'encouragement court (2-3 phrases) "
                    "pour le rider, en t'appuyant sur ses stats. Ton positif, motivant, sport. "
                    "REGLES DE STYLE STRICTES: pas de markdown, pas d'emojis, texte courant fluide."
                ),
            ).with_model("anthropic", "claude-sonnet-4-5-20250929")
            msg = (
                f"Stats du rider {user['name'].split(' ')[0]}: "
                f"{total_analyses} analyses vidéo réalisées, "
                f"{tricks_done}/{tricks_total} tricks de la roadmap validés, "
                f"actif depuis {days_active} jours. "
                "Écris-lui un message court d'encouragement et un point de focus pour la suite."
            )
            r = await ai.send_message(UserMessage(text=msg))
            encouragement = strip_markdown(r)
        except Exception:
            encouragement = "Continue comme ça, chaque session compte. La régularité bat le talent."
    else:
        encouragement = "Bienvenue dans RIDE’UP. Commence par configurer ton coach personnel, puis lance ta première analyse vidéo."

    # Recent activity
    recent = sorted(analyses, key=lambda a: a["created_at"], reverse=True)[:3]
    recent_simple = [
        {"sport": a["sport"], "level": a["level"], "created_at": a["created_at"], "headline": (a.get("structured") or {}).get("headline") or a.get("description", "")[:80]}
        for a in recent
    ]

    return {
        "total_analyses": total_analyses,
        "tricks_done": tricks_done,
        "tricks_total": tricks_total,
        "days_active": days_active,
        "weekly_chart": chart,
        "encouragement": encouragement,
        "recent_analyses": recent_simple,
        "has_coach_profile": profile is not None,
    }


# ============================================================
# ADMIN — tableau de bord du site
# ============================================================

@api.get("/admin/access")
async def admin_access(_admin: dict = Depends(require_admin)):
    return {"ok": True}


@api.get("/admin/overview")
async def admin_overview(_admin: dict = Depends(require_admin)):
    from collections import defaultdict

    users = await db.users.find({}, {"password_hash": 0}).to_list(2000)
    analyses = await db.video_analyses.find({}, {"_id": 0}).to_list(5000)
    profiles = await db.coach_profiles.find({}, {"_id": 0}).to_list(2000)
    transactions = await db.payment_transactions.find({}, {"_id": 0}).to_list(1000)

    plans = {"free": 0, "standard": 0, "premium": 0}
    for u in users:
        plan = u.get("plan")
        if plan in ("standard", "premium"):
            plans[plan] += 1
        else:
            plans["free"] += 1

    mrr = plans["standard"] * PLANS["standard"]["price"] + plans["premium"] * PLANS["premium"]["price"]
    now = datetime.now(timezone.utc)

    signup_buckets = defaultdict(int)
    analysis_buckets = defaultdict(int)
    for u in users:
        created = u.get("created_at")
        if not created:
            continue
        try:
            d = datetime.fromisoformat(created.replace("Z", "+00:00"))
            wk = (now - d).days // 7
            if 0 <= wk < 8:
                signup_buckets[wk] += 1
        except Exception:
            pass

    for a in analyses:
        created = a.get("created_at")
        if not created:
            continue
        try:
            d = datetime.fromisoformat(created.replace("Z", "+00:00"))
            wk = (now - d).days // 7
            if 0 <= wk < 8:
                analysis_buckets[wk] += 1
        except Exception:
            pass

    def _week_chart(buckets: dict) -> list:
        return [{"week_offset": i, "count": buckets.get(i, 0)} for i in range(7, -1, -1)]

    recent_users = sorted(users, key=lambda u: u.get("created_at") or "", reverse=True)[:10]
    recent_users_out = [
        {
            "user_id": u.get("user_id"),
            "name": u.get("name"),
            "email": u.get("email"),
            "plan": u.get("plan"),
            "subscription_status": u.get("subscription_status"),
            "created_at": u.get("created_at"),
        }
        for u in recent_users
    ]

    paid = [t for t in transactions if t.get("payment_status") == "paid"]
    recent_payments = sorted(paid, key=lambda t: t.get("paid_at") or t.get("created_at") or "", reverse=True)[:10]
    recent_payments_out = [
        {
            "session_id": t.get("session_id"),
            "email": t.get("email"),
            "plan": t.get("plan"),
            "amount": t.get("amount"),
            "currency": t.get("currency"),
            "paid_at": t.get("paid_at") or t.get("created_at"),
            "dev_mode": (t.get("metadata") or {}).get("dev_mode"),
        }
        for t in recent_payments
    ]

    sports = defaultdict(int)
    for a in analyses:
        sports[a.get("sport") or "unknown"] += 1
    top_sports = sorted(sports.items(), key=lambda x: x[1], reverse=True)[:5]

    return {
        "totals": {
            "users": len(users),
            "analyses": len(analyses),
            "coach_profiles": len(profiles),
            "active_subscriptions": plans["standard"] + plans["premium"],
            "mrr_eur": round(mrr, 2),
            "payments_total": len(paid),
        },
        "plans": plans,
        "weekly_signups": _week_chart(signup_buckets),
        "weekly_analyses": _week_chart(analysis_buckets),
        "top_sports": [{"sport": s, "count": c} for s, c in top_sports],
        "recent_users": recent_users_out,
        "recent_payments": recent_payments_out,
        "db_backend": get_backend(),
    }


# Mount router
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_db_client():
    global db
    db, backend = await init_database()
    logger.info("Database ready (%s)", backend)

    import asyncio
    from windguru import preload_catalog, warmup_weekend_caches

    preload_catalog()
    asyncio.create_task(warmup_weekend_caches())

    from email_service import email_configured
    import billing

    if os.environ.get("ENV", "development").lower() == "production":
        if not email_configured():
            logger.warning(
                "RESEND_API_KEY / EMAIL_FROM non configurés — emails (reset, vérification) ne partiront pas."
            )
        if not billing.stripe_configured():
            logger.warning("STRIPE_API_KEY non configuré — paiements désactivés.")
        elif not os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip():
            logger.warning(
                "STRIPE_WEBHOOK_SECRET absent — les abonnements ne s'activeront pas automatiquement après paiement."
            )


@app.on_event("shutdown")
async def shutdown_db_client():
    await close_database()
