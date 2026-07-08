"""LLM client — Anthropic & OpenAI via HTTP (coach, spots, vision fallback)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, List, Optional

import httpx


@dataclass
class UserMessage:
    text: str = ""
    images: Optional[List[str]] = None
    image_urls: Optional[List[str]] = None

    def __init__(self, text: str = "", images=None, image_urls=None, **kwargs):
        self.text = text or kwargs.get("content", "")
        self.images = images
        self.image_urls = image_urls


class LlmChat:
    def __init__(self, api_key: str, session_id: str, system_message: str):
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message
        self.provider = "anthropic"
        self.model = "claude-sonnet-4-5-20250929"

    def with_model(self, provider: str, model: str):
        self.provider = provider
        self.model = model
        return self

    async def send_message(self, msg: UserMessage) -> str:
        if self.provider == "openai":
            return await self._openai(msg)
        return await self._anthropic(msg)

    async def _anthropic(self, msg: UserMessage) -> str:
        payload = {
            "model": self.model,
            "max_tokens": 4096,
            "system": self.system_message,
            "messages": [{"role": "user", "content": msg.text}],
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json=payload,
            )
        resp.raise_for_status()
        data = resp.json()
        return data["content"][0]["text"]

    async def _openai(self, msg: UserMessage) -> str:
        content: Any = msg.text
        if msg.images or msg.image_urls:
            parts: List[dict] = [{"type": "text", "text": msg.text}]
            for b64 in msg.images or []:
                parts.append(
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "low"},
                    }
                )
            for url in msg.image_urls or []:
                parts.append({"type": "image_url", "image_url": {"url": url, "detail": "low"}})
            content = parts

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": self.system_message},
                {"role": "user", "content": content},
            ],
            "max_tokens": 4096,
        }
        openai_key = os.environ.get("OPENAI_API_KEY") or self.api_key
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {openai_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
