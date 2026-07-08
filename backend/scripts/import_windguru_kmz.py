#!/usr/bin/env python3
"""Import all Windguru spots from official KMZ (~6000+ worldwide).

Source: https://old.windguru.cz/int/kml.php?typ=list&kmz=1&id_user=0
Personal use per Windguru terms — forecasts via micro.windguru.cz.
"""
from __future__ import annotations

import json
import re
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KMZ = ROOT / "data" / "windguru_all.kmz"
CURATED = ROOT / "data" / "curated_spots.json"
OUT = ROOT / "data" / "windguru_spots.json"
COUNTRIES_OUT = ROOT / "data" / "countries.json"
KML_NS = {"k": "http://earth.google.com/kml/2.0"}
ID_RE = re.compile(r"Spot ID:\s*(\d+)")
DANGER_LABELS = {1: "faible", 2: "modéré", 3: "élevé", 4: "expert", 5: "extrême"}


def download_kmz() -> None:
    import httpx

    url = "https://old.windguru.cz/int/kml.php?typ=list&kmz=1&id_user=0"
    KMZ.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {url} ...")
    r = httpx.get(url, timeout=120.0, follow_redirects=True)
    r.raise_for_status()
    KMZ.write_bytes(r.content)
    print(f"Saved {len(r.content) // 1024} KB → {KMZ}")


def parse_kmz(path: Path) -> list[dict]:
    with zipfile.ZipFile(path) as zf:
        kml_name = next(n for n in zf.namelist() if n.endswith(".kml"))
        root = ET.fromstring(zf.read(kml_name))

    spots = []
    for pm in root.iter("{http://earth.google.com/kml/2.0}Placemark"):
        name_el = pm.find("k:name", KML_NS)
        desc_el = pm.find("k:description", KML_NS)
        coord_el = pm.find("k:Point/k:coordinates", KML_NS)
        if name_el is None or desc_el is None or coord_el is None:
            continue
        name = (name_el.text or "").strip()
        desc = desc_el.text or ""
        m = ID_RE.search(desc)
        if not m:
            continue
        wg_id = int(m.group(1))
        parts = (coord_el.text or "").strip().split(",")
        if len(parts) < 2:
            continue
        lon, lat = float(parts[0]), float(parts[1])
        country = name.split(" - ", 1)[0].strip() if " - " in name else ""
        spot_name = name.split(" - ", 1)[1].strip() if " - " in name else name
        spots.append({
            "wg_id": wg_id,
            "name": name,
            "spot_name": spot_name,
            "country": country,
            "lat": lat,
            "lon": lon,
        })
    return spots


def spot_record(wg_id: int, base: dict) -> dict:
    level = base.get("level") or base.get("min_level") or "intermediate"
    min_level = base.get("min_level") or level
    danger = int(base.get("danger") or 2)
    return {
        "wg_id": wg_id,
        "name": base["name"],
        "spot_name": base.get("spot_name", base["name"]),
        "country": base.get("country", ""),
        "lat": float(base["lat"]),
        "lon": float(base["lon"]),
        "min_level": min_level,
        "level": level,
        "danger": danger,
        "danger_label": DANGER_LABELS.get(danger, "modéré"),
        "type": base.get("type", "wind"),
        "ideal_kts": base.get("ideal_kts", [14, 28]),
        "hazards": base.get("hazards", []),
        "notes": base.get("notes", ""),
        "windguru_url": f"https://www.windguru.cz/{wg_id}",
        **({k: base[k] for k in ("region",) if k in base}),
    }


def main() -> None:
    if not KMZ.exists():
        download_kmz()

    raw = parse_kmz(KMZ)
    print(f"Parsed {len(raw)} spots from KMZ")

    curated = json.loads(CURATED.read_text(encoding="utf-8")) if CURATED.exists() else {}
    overrides = curated.get("overrides", {})
    extras = {int(x["wg_id"]): x for x in curated.get("extra_spots", [])}

    by_id: dict[int, dict] = {}
    for s in raw:
        wg = s["wg_id"]
        base = dict(s)
        if str(wg) in overrides:
            base.update(overrides[str(wg)])
        if wg in extras:
            base.update(extras[wg])
        by_id[wg] = spot_record(wg, base)

    # Extra spots not in KMZ (rare)
    for wg, extra in extras.items():
        if wg not in by_id:
            base = dict(extra)
            if str(wg) in overrides:
                base.update(overrides[str(wg)])
            by_id[wg] = spot_record(wg, base)

    spots = sorted(by_id.values(), key=lambda x: (x.get("country", ""), x["name"]))
    OUT.write_text(json.dumps(spots, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    from collections import Counter

    counts = Counter(s.get("country", "") for s in spots if s.get("country"))
    countries = [{"name": name, "count": count} for name, count in counts.most_common()]
    COUNTRIES_OUT.write_text(json.dumps(countries, ensure_ascii=False), encoding="utf-8")
    size_mb = OUT.stat().st_size / 1024 / 1024
    print(f"Wrote {len(spots)} spots → {OUT} ({size_mb:.2f} MB)")
    print(f"  Countries: {len(countries)} → {COUNTRIES_OUT}")
    print(f"  danger≥3: {sum(1 for s in spots if s['danger']>=3)}")
    print(f"  Palm Beach: {any(s['wg_id']==997862 for s in spots)}")


if __name__ == "__main__":
    main()
