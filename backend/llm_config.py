"""API keys for AI providers."""
from __future__ import annotations

import logging
import os

logger = logging.getLogger("ridemind")


def anthropic_api_key() -> str:
    """Anthropic key (sk-ant-...) for coach chat & Spot Finder."""
    key = (
        os.environ.get("ANTHROPIC_API_KEY")
        or os.environ.get("LLM_API_KEY")  # alias rétrocompat
        or os.environ.get("EMERGENT_LLM_KEY")  # ancien nom — à supprimer
        or ""
    ).strip()
    if not os.environ.get("ANTHROPIC_API_KEY") and os.environ.get("EMERGENT_LLM_KEY"):
        logger.warning(
            "EMERGENT_LLM_KEY est obsolète — renomme en ANTHROPIC_API_KEY dans backend/.env"
        )
    return key
