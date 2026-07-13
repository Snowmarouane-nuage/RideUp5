"""Stripe subscription billing."""
from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import stripe
from stripe import StripeError

stripe.api_key = os.environ.get("STRIPE_API_KEY", "")

logger = logging.getLogger("ridemind")


def refresh_stripe_api_key() -> None:
    stripe.api_key = (os.environ.get("STRIPE_API_KEY") or "").strip()


def stripe_field(obj: Any, key: str, default: Any = None) -> Any:
    """Read a field from Stripe SDK objects or plain dicts."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    try:
        return obj[key]
    except Exception:
        return getattr(obj, key, default)

PLAN_PRICES = {
    "standard": {"amount_cents": 999, "name": "RIDE'UP Standard"},
    "premium": {"amount_cents": 1599, "name": "RIDE'UP Premium"},
}

_PLACEHOLDER_MARKERS = ("replace_me", "sk_test_...", "your_key", "xxx")


def stripe_configured() -> bool:
    key = (os.environ.get("STRIPE_API_KEY") or "").strip()
    if not key.startswith(("sk_test_", "sk_live_", "rk_test_", "rk_live_")):
        return False
    lowered = key.lower()
    return not any(marker in lowered for marker in _PLACEHOLDER_MARKERS)


def is_stripe_customer_id(customer_id: Optional[str]) -> bool:
    """True only for real Stripe customer IDs (cus_...), not dev placeholders."""
    return bool(customer_id and str(customer_id).startswith("cus_"))


def resolve_stripe_customer_id(stored: Optional[str]) -> Optional[str]:
    return stored if is_stripe_customer_id(stored) else None


@dataclass
class CheckoutResult:
    session_id: str
    url: str


@dataclass
class CheckoutStatusResult:
    status: str
    payment_status: str
    subscription_id: Optional[str] = None
    customer_id: Optional[str] = None
    plan: Optional[str] = None
    period_end: Optional[int] = None


def _price_id(plan: str) -> Optional[str]:
    key = f"STRIPE_PRICE_ID_{plan.upper()}"
    return os.environ.get(key) or None


def _line_item(plan: str) -> dict:
    price_id = _price_id(plan)
    if price_id:
        return {"price": price_id, "quantity": 1}
    info = PLAN_PRICES[plan]
    return {
        "price_data": {
            "currency": "eur",
            "product_data": {"name": info["name"]},
            "unit_amount": info["amount_cents"],
            "recurring": {"interval": "month"},
        },
        "quantity": 1,
    }


async def create_subscription_checkout(
    *,
    user_id: str,
    email: str,
    plan: str,
    success_url: str,
    cancel_url: str,
    customer_id: Optional[str] = None,
) -> CheckoutResult:
    refresh_stripe_api_key()
    if not stripe_configured():
        raise ValueError(
            "Stripe n'est pas configuré. Ajoute STRIPE_API_KEY dans backend/.env "
            "(clé test depuis dashboard.stripe.com → Developers → API keys)."
        )

    def _create():
        params: Dict[str, Any] = {
            "mode": "subscription",
            "success_url": success_url,
            "cancel_url": cancel_url,
            "client_reference_id": user_id,
            "metadata": {"user_id": user_id, "plan": plan},
            "subscription_data": {"metadata": {"user_id": user_id, "plan": plan}},
            "line_items": [_line_item(plan)],
        }
        if customer_id and is_stripe_customer_id(customer_id):
            params["customer"] = customer_id
        else:
            params["customer_email"] = email
        return stripe.checkout.Session.create(**params)

    session = await asyncio.to_thread(_create)
    return CheckoutResult(session_id=session.id, url=session.url)


async def get_checkout_status(session_id: str) -> CheckoutStatusResult:
    refresh_stripe_api_key()
    def _get():
        return stripe.checkout.Session.retrieve(
            session_id,
            expand=["subscription"],
        )

    session = await asyncio.to_thread(_get)
    sub = session.subscription
    sub_id = stripe_field(sub, "id") or stripe_field(session, "subscription")
    plan = stripe_field(session.metadata, "plan")
    period_end = stripe_field(sub, "current_period_end")
    customer_id = stripe_field(session, "customer")
    return CheckoutStatusResult(
        status=stripe_field(session, "status", "open") or "open",
        payment_status=stripe_field(session, "payment_status", "unpaid") or "unpaid",
        subscription_id=sub_id if isinstance(sub_id, str) else stripe_field(sub_id, "id"),
        customer_id=customer_id if isinstance(customer_id, str) else stripe_field(customer_id, "id"),
        plan=plan,
        period_end=period_end,
    )


async def create_billing_portal(customer_id: str, return_url: str) -> str:
    def _portal():
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=return_url,
        )
        return session.url

    return await asyncio.to_thread(_portal)


def period_end_iso(timestamp: Optional[int]) -> Optional[str]:
    if not timestamp:
        return None
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()


async def parse_webhook(body: bytes, signature: str) -> Optional[Dict[str, Any]]:
    refresh_stripe_api_key()
    secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "").strip()
    is_prod = os.environ.get("ENV", "development") == "production"

    if is_prod and not secret:
        raise ValueError(
            "STRIPE_WEBHOOK_SECRET est obligatoire en production. "
            "Configure un endpoint webhook sur dashboard.stripe.com."
        )

    if secret:
        event = stripe.Webhook.construct_event(body, signature, secret)
    else:
        import json

        if not signature:
            logger.warning(
                "STRIPE_WEBHOOK_SECRET absent — webhook accepté sans signature (dev uniquement). "
                "Lance : stripe listen --forward-to localhost:8000/api/webhook/stripe"
            )
        event = stripe.Event.construct_from(json.loads(body), stripe.api_key)

    etype = event["type"]
    obj = event["data"]["object"]

    if etype == "checkout.session.completed":
        if stripe_field(obj, "mode") != "subscription":
            return None
        meta = stripe_field(obj, "metadata") or {}
        return {
            "kind": "checkout_completed",
            "user_id": stripe_field(meta, "user_id") or stripe_field(obj, "client_reference_id"),
            "plan": stripe_field(meta, "plan"),
            "subscription_id": stripe_field(obj, "subscription"),
            "customer_id": stripe_field(obj, "customer"),
            "session_id": stripe_field(obj, "id"),
        }

    if etype in ("customer.subscription.updated", "customer.subscription.created"):
        meta = stripe_field(obj, "metadata") or {}
        return {
            "kind": "subscription_updated",
            "user_id": stripe_field(meta, "user_id"),
            "plan": stripe_field(meta, "plan"),
            "subscription_id": stripe_field(obj, "id"),
            "customer_id": stripe_field(obj, "customer"),
            "status": stripe_field(obj, "status"),
            "period_end": stripe_field(obj, "current_period_end"),
        }

    if etype == "customer.subscription.deleted":
        meta = stripe_field(obj, "metadata") or {}
        return {
            "kind": "subscription_deleted",
            "user_id": stripe_field(meta, "user_id"),
            "subscription_id": stripe_field(obj, "id"),
            "customer_id": stripe_field(obj, "customer"),
        }

    return None
