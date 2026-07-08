"""SQLite-backed store when MongoDB is unavailable (local dev only)."""
from __future__ import annotations

import asyncio
import json
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional


def _match(doc: dict, filt: dict) -> bool:
    for key, val in filt.items():
        if doc.get(key) != val:
            return False
    return True


def _apply_projection(doc: dict, projection: Optional[dict]) -> dict:
    if not projection:
        return dict(doc)
    out = dict(doc)
    if projection.get("_id") == 0:
        out.pop("_id", None)
    for key, include in projection.items():
        if key == "_id":
            continue
        if include == 0:
            out.pop(key, None)
    return out


class LocalCursor:
    def __init__(self, items: List[dict], projection: Optional[dict]):
        self._items = items
        self._projection = projection
        self._sort_field: Optional[str] = None
        self._sort_dir = 1

    def sort(self, field: str, direction: int = 1):
        self._sort_field = field
        self._sort_dir = direction
        return self

    async def to_list(self, length: int) -> List[dict]:
        items = list(self._items)
        if self._sort_field:
            reverse = self._sort_dir == -1
            items.sort(key=lambda x: x.get(self._sort_field) or "", reverse=reverse)
        if length:
            items = items[:length]
        return [_apply_projection(i, self._projection) for i in items]


class LocalCollection:
    def __init__(self, conn: sqlite3.Connection, table: str):
        self._conn = conn
        self._table = table

    def _rows(self) -> List[dict]:
        cur = self._conn.execute(f"SELECT doc FROM {self._table}")
        return [json.loads(row[0]) for row in cur.fetchall()]

    def _save_all(self, docs: List[dict]) -> None:
        self._conn.execute(f"DELETE FROM {self._table}")
        for doc in docs:
            self._conn.execute(
                f"INSERT INTO {self._table} (doc) VALUES (?)",
                (json.dumps(doc, default=str),),
            )
        self._conn.commit()

    async def find_one(self, filt: dict, projection: Optional[dict] = None) -> Optional[dict]:
        def _run():
            for doc in self._rows():
                if _match(doc, filt):
                    return _apply_projection(doc, projection)
            return None

        return await asyncio.to_thread(_run)

    async def insert_one(self, doc: dict) -> None:
        def _run():
            self._conn.execute(
                f"INSERT INTO {self._table} (doc) VALUES (?)",
                (json.dumps(doc, default=str),),
            )
            self._conn.commit()

        await asyncio.to_thread(_run)

    async def update_one(self, filt: dict, update: dict) -> None:
        def _run():
            docs = self._rows()
            changed = False
            for i, doc in enumerate(docs):
                if _match(doc, filt):
                    if "$set" in update:
                        docs[i] = {**doc, **update["$set"]}
                    changed = True
                    break
            if changed:
                self._save_all(docs)

        await asyncio.to_thread(_run)

    async def delete_one(self, filt: dict) -> None:
        def _run():
            docs = [d for d in self._rows() if not _match(d, filt)]
            self._save_all(docs)

        await asyncio.to_thread(_run)

    async def replace_one(self, filt: dict, doc: dict, upsert: bool = False) -> None:
        def _run():
            docs = self._rows()
            replaced = False
            for i, existing in enumerate(docs):
                if _match(existing, filt):
                    docs[i] = doc
                    replaced = True
                    break
            if not replaced and upsert:
                docs.append(doc)
            if replaced or upsert:
                self._save_all(docs)

        await asyncio.to_thread(_run)

    def find(self, filt: dict, projection: Optional[dict] = None) -> LocalCursor:
        docs = self._rows()
        items = [d for d in docs if _match(d, filt)]
        return LocalCursor(items, projection)


class LocalDatabase:
    COLLECTIONS = (
        "users",
        "user_sessions",
        "password_reset_tokens",
        "email_verification_tokens",
        "payment_transactions",
        "video_analyses",
        "coach_profiles",
    )

    def __init__(self, path: Path):
        path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        for name in self.COLLECTIONS:
            self._conn.execute(
                f"CREATE TABLE IF NOT EXISTS {name} (id INTEGER PRIMARY KEY AUTOINCREMENT, doc TEXT NOT NULL)"
            )
        self._conn.commit()
        for name in self.COLLECTIONS:
            setattr(self, name, LocalCollection(self._conn, name))

    def close(self) -> None:
        self._conn.close()
