"""Transactional email — Resend API or dev log fallback."""
from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger("ridemind")

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "").strip()
EMAIL_FROM = os.environ.get("EMAIL_FROM", "RIDE'UP <noreply@rideup.app>").strip()
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def email_configured() -> bool:
    return bool(RESEND_API_KEY and EMAIL_FROM)


async def _send_email(to_email: str, subject: str, html: str, dev_label: str, dev_link: str) -> bool:
    if not email_configured():
        logger.warning("[DEV] Email non configuré — %s pour %s : %s", dev_label, to_email, dev_link)
        return False

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {RESEND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "from": EMAIL_FROM,
                "to": [to_email],
                "subject": subject,
                "html": html,
            },
        )
    if resp.status_code not in (200, 201):
        logger.error("Resend error %s: %s", resp.status_code, resp.text[:300])
        return False
    return True


def _email_shell(title: str, body: str, link: str, link_label: str) -> str:
    return f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <h2 style="color:#9AB8FF;">RIDE'UP</h2>
      <p>{body}</p>
      <p><a href="{link}" style="background:#9AB8FF;color:#fff;padding:12px 24px;text-decoration:none;display:inline-block;">
        {link_label}
      </a></p>
      <p style="color:#999;font-size:11px;">Lien direct : {link}</p>
    </div>
    """


async def send_password_reset_email(to_email: str, reset_token: str) -> bool:
    link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    html = _email_shell(
        "Reset",
        "Tu as demandé à réinitialiser ton mot de passe. Clique ci-dessous (lien valable 1 heure). "
        "Si tu n'as pas fait cette demande, ignore cet email.",
        link,
        "Choisir un nouveau mot de passe",
    )
    return await _send_email(
        to_email,
        "RIDE'UP — Réinitialisation de ton mot de passe",
        html,
        "lien reset",
        link,
    )


async def send_verification_email(to_email: str, verify_token: str) -> bool:
    link = f"{FRONTEND_URL}/verify-email?token={verify_token}"
    html = _email_shell(
        "Verify",
        "Bienvenue sur RIDE'UP ! Confirme ton adresse email pour activer ton compte "
        "(analyse vidéo, abonnements, coach). Lien valable 24 heures.",
        link,
        "Confirmer mon email",
    )
    return await _send_email(
        to_email,
        "RIDE'UP — Confirme ton adresse email",
        html,
        "lien vérification",
        link,
    )
