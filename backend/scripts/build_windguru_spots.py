#!/usr/bin/env python3
"""Build Windguru spot catalog.

Preferred: import all ~6000 spots from official Windguru KMZ
  python scripts/import_windguru_kmz.py

Legacy (slow, ~150 spots): varun.surf enrichment — kept for reference only.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "windguru_spots.json"
CURATED = ROOT / "data" / "curated_spots.json"
INDEX_URL = "https://varun.surf/llms/spots.md"
SPOT_URL = "https://varun.surf/llms/spots/{wg_id}.md"

LINK_RE = re.compile(r"\[([^\]]+)\]\(/llms/spots/(\d+)\.md\)")
COORD_RE = re.compile(r"Coordinates:\s*([-\d.]+),\s*([-\d.]+)")
LEVEL_RE = re.compile(r"Experience:\s*([^\n]+)")
HAZARDS_RE = re.compile(r"Hazards:\s*([^\n]+)")


def infer_ideal_kts(level_text: str, min_level: str) -> list[int]:
    t = (level_text or "").lower()
    ml = (min_level or "").lower()
    if "beginner" in t or "début" in t or ml == "beginner":
        return [12, 22]
    if "advanced" in t or "expert" in t or "avanc" in t or ml in ("advanced", "pro"):
        return [18, 35]
    return [14, 28]


def infer_level(level_text: str) -> str:
    t = (level_text or "").lower()
    if "beginner" in t or "début" in t:
        return "beginner"
    if "pro" in t and "inter" not in t:
        return "pro"
    if "advanced" in t or "expert" in t or "avanc" in t:
        return "advanced"
    return "intermediate"


def infer_danger(hazards_text: str, level: str) -> int:
    t = (hazards_text or "").lower()
    danger = 2
    if any(w in t for w in ("shore break", "shorebreak", "rocher", "rock", "reef", "récif")):
        danger = max(danger, 3)
    if any(w in t for w in ("offshore", "dérive", "drift", "no rescue", "pas de secours")):
        danger = max(danger, 4)
    if any(w in t for w in ("shark", "requin", "xxl", "violent", "extrême")):
        danger = max(danger, 4)
    if level in ("advanced", "pro"):
        danger = max(danger, 3)
    if level == "beginner":
        danger = min(danger, 2)
    return danger


def spot_record(wg_id: int, base: dict) -> dict:
    level = base.get("level") or "intermediate"
    min_level = base.get("min_level") or level
    danger = int(base.get("danger") or infer_danger(" ".join(base.get("hazards", [])), min_level))
    rec = {
        "wg_id": wg_id,
        "name": base["name"],
        "country": base.get("country", ""),
        "lat": float(base["lat"]),
        "lon": float(base["lon"]),
        "min_level": min_level,
        "level": level,
        "danger": danger,
        "danger_label": {1: "faible", 2: "modéré", 3: "élevé", 4: "expert", 5: "extrême"}.get(danger, "modéré"),
        "type": base.get("type", "kite"),
        "ideal_kts": base.get("ideal_kts") or infer_ideal_kts("", min_level),
        "hazards": base.get("hazards") or [],
        "notes": base.get("notes", ""),
        "windguru_url": f"https://www.windguru.cz/{wg_id}",
    }
    if base.get("region"):
        rec["region"] = base["region"]
    return rec


def fetch_varun_spot(client: httpx.Client, wg_id: int, name: str) -> dict | None:
    try:
        detail = client.get(SPOT_URL.format(wg_id=wg_id)).text
    except Exception:
        return None
    m = COORD_RE.search(detail)
    if not m:
        return None
    level_text = (LEVEL_RE.search(detail) or [None, ""])[1]
    hazards_line = (HAZARDS_RE.search(detail) or [None, ""])[1]
    hazards = [h.strip() for h in re.split(r"[;,.]", hazards_line) if h.strip()] if hazards_line else []
    level = infer_level(level_text)
    country = name.split(",")[-1].strip() if "," in name else ""
    return {
        "name": name,
        "country": country,
        "lat": float(m.group(1)),
        "lon": float(m.group(2)),
        "level": level,
        "min_level": level,
        "hazards": hazards,
        "danger": infer_danger(hazards_line, level),
    }


def main() -> None:
    curated = json.loads(CURATED.read_text(encoding="utf-8"))
    overrides = curated.get("overrides", {})
    extra = curated.get("extra_spots", [])

    client = httpx.Client(timeout=30.0, follow_redirects=True)
    index = client.get(INDEX_URL).text
    links = LINK_RE.findall(index)
    print(f"Varun index: {len(links)} spots")

    by_id: dict[int, dict] = {}

    for i, (name, wg_id_s) in enumerate(links, 1):
        wg_id = int(wg_id_s)
        base = fetch_varun_spot(client, wg_id, name) or {}
        if not base:
            print(f"  skip varun {wg_id}")
            continue
        if str(wg_id) in overrides:
            base.update(overrides[str(wg_id)])
        by_id[wg_id] = spot_record(wg_id, base)
        if i % 25 == 0:
            print(f"  varun {i}/{len(links)}...")
        time.sleep(0.12)

    for item in extra:
        wg_id = int(item["wg_id"])
        base = dict(item)
        if str(wg_id) in overrides:
            base.update(overrides[str(wg_id)])
        by_id[wg_id] = spot_record(wg_id, base)

    spots = sorted(by_id.values(), key=lambda s: (s.get("country", ""), s["name"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(spots, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(spots)} spots → {OUT}")
    print(f"  danger≥3: {sum(1 for s in spots if s['danger']>=3)}")
    print(f"  advanced/pro: {sum(1 for s in spots if s['min_level'] in ('advanced','pro'))}")


if __name__ == "__main__":
    main()
