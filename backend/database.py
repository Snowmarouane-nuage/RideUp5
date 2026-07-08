"""Database bootstrap — MongoDB in prod, SQLite fallback in local dev."""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Optional, Tuple

from motor.motor_asyncio import AsyncIOMotorClient

from local_store import LocalDatabase

logger = logging.getLogger("ridemind")

ROOT_DIR = Path(__file__).parent
_mongo_client: Optional[AsyncIOMotorClient] = None
_db: Any = None
_backend: str = "unknown"


async def init_database() -> Tuple[Any, str]:
    global _mongo_client, _db, _backend

    mongo_url = os.environ.get("MONGO_URL", "mongodb://127.0.0.1:27017")
    db_name = os.environ.get("DB_NAME", "ridemind")
    force_local = os.environ.get("USE_LOCAL_DB", "").lower() in ("1", "true", "yes")

    if not force_local:
        try:
            client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=3000)
            await client.admin.command("ping")
            _mongo_client = client
            _db = client[db_name]
            _backend = "mongo"
            logger.info("Connected to MongoDB at %s", mongo_url)
            return _db, _backend
        except Exception as exc:
            logger.warning("MongoDB unavailable (%s)", exc)

    is_dev = os.environ.get("ENV", "development").lower() in ("development", "dev", "local")
    if not is_dev and not force_local:
        raise RuntimeError(
            "MongoDB is required in production. Set MONGO_URL or USE_LOCAL_DB=true only for dev."
        )

    db_path = ROOT_DIR / "data" / "local.db"
    _db = LocalDatabase(db_path)
    _backend = "sqlite"
    logger.warning(
        "Using local SQLite database at %s (dev only — install MongoDB for production)",
        db_path,
    )
    return _db, _backend


def get_db() -> Any:
    if _db is None:
        raise RuntimeError("Database not initialized — wait for startup")
    return _db


def get_backend() -> str:
    return _backend


async def close_database() -> None:
    global _mongo_client, _db
    if _mongo_client is not None:
        _mongo_client.close()
        _mongo_client = None
    if _backend == "sqlite" and _db is not None:
        _db.close()
    _db = None
