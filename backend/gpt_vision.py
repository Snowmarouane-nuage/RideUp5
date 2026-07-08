"""GPT vision analysis for ride session videos."""
from __future__ import annotations

import json
import logging
import os
from typing import List, Optional, Union

import httpx

logger = logging.getLogger("ridemind")

DEFAULT_VISION_MODEL = os.environ.get("VIDEO_ANALYSIS_GPT_MODEL") or "gpt-4.1"
FALLBACK_VISION_MODEL = os.environ.get("VIDEO_ANALYSIS_GPT_MODEL_FALLBACK", "gpt-4o")
MAX_TOKENS = int(os.environ.get("VIDEO_ANALYSIS_MAX_TOKENS", "6000"))
FRAME_IMAGE_DETAIL = "high"  # always high for trick analysis
API_TIMEOUT_SEC = float(os.environ.get("VIDEO_ANALYSIS_API_TIMEOUT", "300"))
_PLACEHOLDER_MARKERS = ("replace_me", "sk-replace", "your_key", "xxx", "...")

_resolved_model: Optional[str] = None

VISION_SEQUENCE_RULE = (
    "Analyse l'ensemble des images avant de conclure. Ne prends jamais une décision à partir "
    "d'une seule image. Compare les positions successives du rider, de la planche, de l'aile, "
    "des mains et de la barre afin d'identifier le mouvement complet."
)


def openai_configured() -> bool:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key.startswith(("sk-proj-", "sk-", "rk-proj-", "rk-")):
        return False
    lowered = key.lower()
    return not any(marker in lowered for marker in _PLACEHOLDER_MARKERS)


def _openai_api_key() -> str:
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise RuntimeError(
            "OPENAI_API_KEY manquant. Ajoute ta clé sur https://platform.openai.com/account/api-keys "
            "dans backend/.env"
        )
    if not openai_configured():
        raise RuntimeError(
            "Clé OpenAI invalide ou placeholder. Remplace OPENAI_API_KEY dans backend/.env "
            "par une vraie clé (sk-...)."
        )
    return key


async def resolve_vision_model() -> str:
    """Return configured vision model (gpt-4.1 by default, overridable via env)."""
    global _resolved_model
    if _resolved_model:
        return _resolved_model
    _resolved_model = DEFAULT_VISION_MODEL
    return _resolved_model


def _normalize_frames(frames: Union[List[dict], List[str]]) -> List[dict]:
    out: List[dict] = []
    for i, item in enumerate(frames):
        if isinstance(item, dict):
            out.append(item)
        else:
            out.append({"b64": item, "time_sec": float(i), "index": i + 1})
    out.sort(key=lambda f: (f.get("time_sec", 0), f.get("index", 0)))
    return out


def _build_user_content(
    user_text: str,
    frames: Union[List[dict], List[str]],
    *,
    sport: str = "kitesurf",
) -> list:
    normalized = _normalize_frames(frames)
    sport_key = (sport or "kitesurf").lower().strip()

    if sport_key == "kitesurf":
        frame_intro = (
            f"{VISION_SEQUENCE_RULE}\n"
            f"{len(normalized)} images fournies dans l'ordre chronologique strict "
            "(approche → décollage → phase aérienne → réception). "
            "Chaque image est taguée par phase quand disponible. "
            "Kitesurf expert : stance, approach, rotation exacte, body rotation, "
            "kiteloop/downloop/heliloop (critères stricts), barre, mains, grab, réception. "
            "Confidence < 90 → Impossible à déterminer. Ne jamais inventer."
        )
    elif sport_key == "wakeboard":
        frame_intro = (
            f"{VISION_SEQUENCE_RULE} "
            "Analyse rider, handle, wake, rotation, atterrissage. "
            "Si non visible : Impossible à déterminer."
        )
    else:
        frame_intro = (
            f"{VISION_SEQUENCE_RULE} "
            "Si non visible : Impossible à déterminer."
        )

    content: list = [
        {
            "type": "text",
            "text": (
                user_text
                + f"\n\n=== {len(normalized)} FRAMES — ORDRE CHRONOLOGIQUE ===\n"
                + frame_intro
                + "\n"
            ),
        }
    ]
    for fr in normalized:
        t = fr.get("time_sec", 0)
        idx = fr.get("index", 0)
        phase = fr.get("phase", "")
        phase_tag = f" [{phase}]" if phase else ""
        content.append({"type": "text", "text": f"--- Frame {idx} @ {t:.2f}s{phase_tag} ---"})
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{fr['b64']}",
                "detail": FRAME_IMAGE_DETAIL,
            },
        })
    return content


async def _call_openai_http(
    system_prompt: str,
    user_text: str,
    frames: Union[List[dict], List[str]],
    *,
    sport: str = "kitesurf",
    model_override: Optional[str] = None,
) -> str:
    normalized = _normalize_frames(frames)
    model = model_override or await resolve_vision_model()
    user_content = _build_user_content(user_text, normalized, sport=sport)

    image_parts = sum(1 for p in user_content if p.get("type") == "image_url")
    if image_parts != len(normalized):
        logger.error("Frame count mismatch: extracted=%d sent=%d", len(normalized), image_parts)
        raise RuntimeError("Erreur interne : toutes les images n'ont pas été préparées pour l'API.")

    logger.info(
        "OpenAI vision request: model=%s frames=%d detail=%s max_tokens=%d",
        model,
        image_parts,
        FRAME_IMAGE_DETAIL,
        MAX_TOKENS,
    )

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "max_tokens": MAX_TOKENS,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
    }
    async with httpx.AsyncClient(timeout=API_TIMEOUT_SEC) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {_openai_api_key()}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    if resp.status_code == 401:
        raise RuntimeError("Clé OpenAI refusée (401). Vérifie OPENAI_API_KEY dans backend/.env.")
    if resp.status_code == 429:
        try:
            err_type = resp.json().get("error", {}).get("type", "")
        except Exception:
            err_type = ""
        if err_type == "insufficient_quota":
            raise RuntimeError(
                "Quota OpenAI épuisé. Ajoute du crédit sur "
                "https://platform.openai.com/account/billing."
            )
        raise RuntimeError("Trop de requêtes OpenAI (429). Réessaie dans quelques minutes.")
    if resp.status_code == 404:
        if model != FALLBACK_VISION_MODEL:
            global _resolved_model
            logger.warning("Model %s unavailable (404), falling back to %s", model, FALLBACK_VISION_MODEL)
            _resolved_model = FALLBACK_VISION_MODEL
            return await _call_openai_http(
                system_prompt, user_text, frames, sport=sport, model_override=FALLBACK_VISION_MODEL
            )
        raise RuntimeError(f"Modèle OpenAI introuvable (404): {model}")
    if resp.status_code != 200:
        logger.error("OpenAI vision error %s: %s", resp.status_code, resp.text[:500])
        raise RuntimeError(f"Erreur OpenAI API ({resp.status_code})")
    data = resp.json()
    return data["choices"][0]["message"]["content"]


def get_active_vision_model() -> str:
    return _resolved_model or os.environ.get("VIDEO_ANALYSIS_GPT_MODEL", DEFAULT_VISION_MODEL)


def _prediction_field(data: dict, key: str) -> str:
    val = data.get(key)
    if isinstance(val, dict):
        return str(val.get("prediction") or "").strip()
    if isinstance(val, str):
        return val.strip()
    return ""


def generate_dev_analysis(
    sport: str,
    level: str,
    trick: str,
    problem: str,
    frame_count: int,
) -> str:
    sport_key = (sport or "kitesurf").lower().strip()
    uncertain = "Impossible à déterminer"

    def pred(conf: int = 0):
        return {"prediction": uncertain, "confidence": conf, "alternatives": []}

    if sport_key == "kitesurf":
        payload = {
            "video_valide": True,
            "raison_rejet": "",
            "stance": pred(),
            "approach": pred(),
            "rotation_degrees": pred(),
            "rotation_direction": pred(),
            "body_rotation": pred(),
            "kiteloop": pred(),
            "downloop": pred(),
            "heliloop": pred(),
            "bar_position": pred(),
            "hands": pred(),
            "grab": pred(),
            "board_off": pred(),
            "one_foot": pred(),
            "kite_position": pred(),
            "landing": pred(),
            "execution": {
                "height": uncertain,
                "amplitude": uncertain,
                "control": uncertain,
                "timing": uncertain,
            },
            "frames_analyzed": frame_count,
            "_dev_mode": True,
        }
        return json.dumps(payload, ensure_ascii=False)

    payload = {
        "video_valide": True,
        "raison_rejet": "",
        "figure_observee": trick or uncertain,
        "probleme_identifie": problem or uncertain,
        "headline": f"{sport_key} — analyse démo ({frame_count} frames)",
        "diagnostic": "Mode démo — configure OPENAI_API_KEY pour une analyse vision réelle.",
        "corrections": [],
        "drills": [],
        "securite": "",
        "niveau_estime": level,
        "_dev_mode": True,
    }
    return json.dumps(payload, ensure_ascii=False)


async def analyze_session_video(
    system_prompt: str,
    user_text: str,
    frames: Union[List[dict], List[str]],
    *,
    dev_fallback: bool = False,
    sport: str = "kitesurf",
    level: str = "Intermédiaire",
    trick: str = "",
    problem: str = "",
) -> str:
    normalized = _normalize_frames(frames)
    if not normalized:
        raise ValueError("Aucune frame extraite de la vidéo")

    logger.info("analyze_session_video: %d frames queued for vision", len(normalized))

    if dev_fallback and not openai_configured():
        logger.warning("OpenAI non configuré — analyse vidéo en mode démo")
        return generate_dev_analysis(sport, level, trick, problem, len(normalized))

    try:
        return await _call_openai_http(system_prompt, user_text, normalized, sport=sport)
    except RuntimeError as exc:
        if dev_fallback and "Quota OpenAI" in str(exc):
            logger.warning("Quota OpenAI — mode démo: %s", exc)
            return generate_dev_analysis(sport, level, trick, problem, len(normalized))
        raise


def parse_structured_json(ai_response: str, fallback_level: str) -> dict:
    cleaned = ai_response.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned
        if cleaned.rstrip().endswith("```"):
            cleaned = cleaned.rstrip()[:-3]
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return {
            "figure_observee": "",
            "probleme_identifie": "",
            "headline": "Analyse de ta session",
            "diagnostic": ai_response,
            "corrections": [],
            "drills": [],
            "securite": "",
            "niveau_estime": fallback_level,
        }
    return data
