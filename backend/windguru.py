"""Windguru forecast integration (micro.windguru.cz — modèle GFS)."""
from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("ridemind")

MICRO_BASE = "https://micro.windguru.cz/"
DEFAULT_MODEL = "gfs"
CACHE_TTL_SEC = 3600
_SPOTS_PATH = Path(__file__).resolve().parent / "data" / "windguru_spots.json"

_forecast_cache: Dict[str, tuple[float, List["ForecastHour"]]] = {}
_weekend_cache: Dict[str, tuple[float, dict]] = {}
_spots_cache: Optional[List[dict]] = None
_countries_cache: Optional[List[dict]] = None

FORECAST_HTTP_TIMEOUT = 5.0
BATCH_CONCURRENT = 25
BATCH_OVERALL_TIMEOUT = 28.0
PUBLIC_SPOT_KEYS = frozenset({"windguru_url", "forecast_source", "forecast_model", "wg_id"})
_WEEKEND_DISK_PATH = Path(__file__).resolve().parent / "data" / "weekend_cache.json"
_COUNTRIES_PATH = Path(__file__).resolve().parent / "data" / "countries.json"
WARMUP_COUNTRIES: tuple[Optional[str], ...] = (
    None, "France", "Spain", "Portugal", "Morocco", "Italy", "Brazil", "United Kingdom",
)
_refresh_locks: Dict[str, asyncio.Lock] = {}

INIT_RE = re.compile(r"init:\s*(\d{4})-(\d{2})-(\d{2})")
SPOT_META_RE = re.compile(
    r"^(.+?),\s+lat:\s*([-\d.]+),\s+lon:\s*([-\d.]+)",
    re.MULTILINE,
)
HOUR_RE = re.compile(
    r"^\s*(\w{3})\s+(\d{1,2})\.\s+(\d{1,2})h\s+(\d+|-)\s+(\d+|-)\s+(\d+|-)",
    re.MULTILINE,
)


@dataclass
class ForecastHour:
    at: datetime
    wind_kts: float
    gust_kts: Optional[float]
    wind_deg: Optional[int]


def load_spots() -> List[dict]:
    global _spots_cache
    if _spots_cache is not None:
        return _spots_cache
    if not _SPOTS_PATH.exists():
        logger.warning("windguru_spots.json missing — run scripts/import_windguru_kmz.py")
        _spots_cache = []
        return _spots_cache
    _spots_cache = json.loads(_SPOTS_PATH.read_text(encoding="utf-8"))
    return _spots_cache


def list_countries() -> List[dict]:
    global _countries_cache
    if _countries_cache is not None:
        return _countries_cache
    if _COUNTRIES_PATH.exists():
        try:
            _countries_cache = json.loads(_COUNTRIES_PATH.read_text(encoding="utf-8"))
            return _countries_cache
        except Exception:
            pass
    from collections import Counter

    counts = Counter(s.get("country", "") for s in load_spots() if s.get("country"))
    _countries_cache = [{"name": name, "count": count} for name, count in counts.most_common()]
    return _countries_cache


def init_weekend_disk_cache() -> None:
    if not _WEEKEND_DISK_PATH.exists():
        return
    try:
        raw = json.loads(_WEEKEND_DISK_PATH.read_text(encoding="utf-8"))
        for key, entry in raw.items():
            _weekend_cache[key] = (float(entry["expires"]), entry["payload"])
        logger.info("Weekend cache loaded from disk (%s entries)", len(raw))
    except Exception as exc:
        logger.warning("Weekend disk cache load failed: %s", exc)


def _persist_weekend_disk_cache() -> None:
    try:
        raw = {
            key: {"expires": expires, "payload": payload}
            for key, (expires, payload) in _weekend_cache.items()
        }
        _WEEKEND_DISK_PATH.parent.mkdir(parents=True, exist_ok=True)
        _WEEKEND_DISK_PATH.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
    except Exception as exc:
        logger.warning("Weekend disk cache save failed: %s", exc)


def preload_catalog() -> None:
    """Charge spots + pays en mémoire (appel au démarrage)."""
    load_spots()
    list_countries()


def public_spot(spot: dict) -> dict:
    return {k: v for k, v in spot.items() if k not in PUBLIC_SPOT_KEYS}


DEFAULT_FORECAST_LIMIT = 12
FETCH_POOL_LIMIT = 40
MAX_FORECAST_LIMIT = 50
MAX_RECOMMEND_CANDIDATES = 40

PRIORITY_COUNTRIES = [
    "France", "Spain", "Portugal", "Morocco", "Italy", "Greece", "Croatia",
    "Netherlands", "Germany", "Denmark", "United Kingdom", "Ireland",
    "Brazil", "Dominican Republic", "Mexico", "United States", "Australia",
    "South Africa", "Egypt", "Mauritius", "Sri Lanka", "Philippines", "Vietnam",
    "Thailand", "Indonesia", "Costa Rica", "Peru", "Colombia", "Chile",
    "Argentina", "Uruguay", "Poland", "Sweden", "Norway", "Belgium", "Turkey",
    "Israel", "Cape Verde", "Senegal", "Tanzania", "Madagascar", "New Zealand",
    "Canada", "Panama", "Nicaragua", "Ecuador", "Honduras", "Cuba", "Jamaica",
]


def filter_spots(
    spots: List[dict],
    *,
    country: Optional[str] = None,
    search: Optional[str] = None,
) -> List[dict]:
    if country:
        c = country.lower()
        spots = [s for s in spots if c in (s.get("country") or "").lower()]
    if search:
        q = search.lower().strip()
        spots = [
            s
            for s in spots
            if q in (s.get("name") or "").lower()
            or q in (s.get("spot_name") or "").lower()
            or q in (s.get("country") or "").lower()
        ]
    return spots


def prioritize_spots(
    spots: List[dict],
    *,
    user_lat: Optional[float] = None,
    user_lon: Optional[float] = None,
    priority_countries: bool = False,
) -> List[dict]:
    if user_lat is not None and user_lon is not None:
        enriched = [
            {**s, "distance_km": round(haversine_km(user_lat, user_lon, s["lat"], s["lon"]), 1)}
            for s in spots
        ]
        return sorted(enriched, key=lambda x: x["distance_km"])
    if priority_countries:
        pri_idx = {c: i for i, c in enumerate(PRIORITY_COUNTRIES)}

        def key(s: dict) -> tuple:
            c = s.get("country", "")
            return (pri_idx.get(c, 999), c, s.get("name", ""))

        return sorted(spots, key=key)
    return spots


def select_forecast_candidates(
    spots: List[dict],
    *,
    limit: int,
    user_lat: Optional[float] = None,
    user_lon: Optional[float] = None,
    max_distance_km: Optional[float] = None,
    country: Optional[str] = None,
    search: Optional[str] = None,
    priority_countries: bool = False,
) -> tuple[List[dict], int]:
    """Return (capped candidates for API calls, filtered pool size before cap)."""
    pool = filter_spots(spots, country=country, search=search)
    pool = prioritize_spots(
        pool,
        user_lat=user_lat,
        user_lon=user_lon,
        priority_countries=priority_countries,
    )
    if max_distance_km is not None and user_lat is not None and user_lon is not None:
        pool = [s for s in pool if s.get("distance_km", 0) <= max_distance_km]
    pool_size = len(pool)
    cap = max(1, min(limit, MAX_FORECAST_LIMIT))
    if len(pool) > cap:
        step = max(1, len(pool) // cap)
        pool = [pool[i] for i in range(0, len(pool), step)][:cap]
    else:
        pool = pool[:cap]
    return pool, pool_size


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    from math import atan2, cos, radians, sin, sqrt

    r = 6371.0
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlamb = radians(lon2 - lon1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlamb / 2) ** 2
    return 2 * r * atan2(sqrt(a), sqrt(1 - a))


def _num(val: str) -> Optional[float]:
    if val in ("-", "", None):
        return None
    try:
        return float(val)
    except ValueError:
        return None


def parse_micro_forecast(text: str) -> List[ForecastHour]:
    init_m = INIT_RE.search(text)
    if not init_m:
        return []
    year, month, day = int(init_m.group(1)), int(init_m.group(2)), int(init_m.group(3))
    cur_month, cur_year = month, year
    prev_day: Optional[int] = None
    hours: List[ForecastHour] = []

    for m in HOUR_RE.finditer(text):
        dom = int(m.group(2))
        hour = int(m.group(3))
        wspd = _num(m.group(4))
        gust = _num(m.group(5))
        wdeg = _num(m.group(6))
        if wspd is None:
            continue
        if prev_day is not None and dom < prev_day:
            cur_month += 1
            if cur_month > 12:
                cur_month = 1
                cur_year += 1
        prev_day = dom
        try:
            at = datetime(cur_year, cur_month, dom, hour, 0, 0)
        except ValueError:
            continue
        hours.append(
            ForecastHour(
                at=at,
                wind_kts=wspd,
                gust_kts=gust,
                wind_deg=int(wdeg) if wdeg is not None else None,
            )
        )
    return hours


async def fetch_forecast_hours(
    wg_id: int,
    *,
    model: str = DEFAULT_MODEL,
    client: Optional[httpx.AsyncClient] = None,
) -> List[ForecastHour]:
    cache_key = f"{wg_id}:{model}"
    now = time.time()
    if cache_key in _forecast_cache:
        expires, data = _forecast_cache[cache_key]
        if now < expires:
            return data

    url = f"{MICRO_BASE}?s={wg_id}&m={model}&v=WSPD,GUST,WDEG"
    own_client = client is None
    if own_client:
        client = httpx.AsyncClient(timeout=FORECAST_HTTP_TIMEOUT, follow_redirects=True)

    try:
        resp = await client.get(url)
        resp.raise_for_status()
        hours = parse_micro_forecast(resp.text)
        _forecast_cache[cache_key] = (now + CACHE_TTL_SEC, hours)
        return hours
    except Exception as exc:
        logger.warning("Windguru forecast failed wg_id=%s: %s", wg_id, exc)
        return []
    finally:
        if own_client:
            await client.aclose()


async def fetch_forecasts_batch(
    wg_ids: List[int],
    *,
    model: str = DEFAULT_MODEL,
    max_concurrent: int = BATCH_CONCURRENT,
    overall_timeout: float = BATCH_OVERALL_TIMEOUT,
) -> Dict[int, List[ForecastHour]]:
    if not wg_ids:
        return {}
    sem = asyncio.Semaphore(max_concurrent)
    results: Dict[int, List[ForecastHour]] = {}

    async with httpx.AsyncClient(timeout=FORECAST_HTTP_TIMEOUT, follow_redirects=True) as client:

        async def one(wg_id: int) -> None:
            async with sem:
                results[wg_id] = await fetch_forecast_hours(wg_id, model=model, client=client)

        try:
            await asyncio.wait_for(
                asyncio.gather(*(one(i) for i in wg_ids), return_exceptions=True),
                timeout=overall_timeout,
            )
        except asyncio.TimeoutError:
            logger.warning("forecast batch timeout after %.0fs (%s spots)", overall_timeout, len(wg_ids))
    return results


def _hours_on_date(hours: List[ForecastHour], target: date, hour_from: int = 9, hour_to: int = 19) -> List[ForecastHour]:
    return [h for h in hours if h.at.date() == target and hour_from <= h.at.hour <= hour_to]


def wind_at_datetime(hours: List[ForecastHour], target: date, hour: int) -> Optional[ForecastHour]:
    for h in hours:
        if h.at.date() == target and h.at.hour == hour:
            return h
    # nearest same day
    same_day = [h for h in hours if h.at.date() == target]
    if not same_day:
        return None
    return min(same_day, key=lambda h: abs(h.at.hour - hour))


def score_weekend_spot(spot: dict, hours: List[ForecastHour], saturday: date, sunday: date) -> Optional[dict]:
    if not hours:
        return None
    ideal_min, ideal_max = spot.get("ideal_kts", [14, 28])
    sat_hours = _hours_on_date(hours, saturday)
    sun_hours = _hours_on_date(hours, sunday)
    day_speeds = [h.wind_kts for h in sat_hours + sun_hours]
    if not day_speeds:
        return None
    avg_wind = sum(day_speeds) / len(day_speeds)
    max_wind = max(day_speeds)
    rideable_hours = sum(1 for w in day_speeds if ideal_min <= w <= ideal_max)
    sat_speeds = [h.wind_kts for h in sat_hours]
    sun_speeds = [h.wind_kts for h in sun_hours]
    weekend_peak = max(
        max(sat_speeds) if sat_speeds else 0,
        max(sun_speeds) if sun_speeds else 0,
    )
    return {
        **spot,
        "saturday": saturday.isoformat(),
        "sunday": sunday.isoformat(),
        "avg_wind_kts": round(avg_wind, 1),
        "max_wind_kts": round(max_wind, 1),
        "weekend_peak_kts": round(weekend_peak, 1),
        "sat_avg_kts": round(sum(sat_speeds) / len(sat_speeds), 1) if sat_speeds else None,
        "sun_avg_kts": round(sum(sun_speeds) / len(sun_speeds), 1) if sun_speeds else None,
        "rideable_hours": rideable_hours,
        "score": round(weekend_peak * 100 + avg_wind, 1),
    }


def current_wind_from_hours(hours: List[ForecastHour]) -> Optional[dict]:
    if not hours:
        return None
    now = datetime.now()
    # closest hour to now (micro uses local spot time — approximation)
    best = min(hours, key=lambda h: abs((h.at - now).total_seconds()))
    return {
        "wind_kts": best.wind_kts,
        "gust_kts": best.gust_kts,
        "wind_deg": best.wind_deg,
        "forecast_time": best.at.isoformat(),
    }


async def _compute_weekend_ranking(
    *,
    user_lat: Optional[float] = None,
    user_lon: Optional[float] = None,
    max_distance_km: Optional[float] = None,
    country: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = DEFAULT_FORECAST_LIMIT,
) -> dict:
    today = date.today()
    days_to_sat = (5 - today.weekday()) % 7
    if days_to_sat == 0 and today.weekday() != 5:
        days_to_sat = 7
    saturday = today + timedelta(days=days_to_sat)
    sunday = saturday + timedelta(days=1)

    all_spots = load_spots()
    has_geo = user_lat is not None and user_lon is not None
    use_priority = not country and not has_geo and not search

    fetch_limit = FETCH_POOL_LIMIT if country else max(limit, 30)
    candidates, _pool_size = select_forecast_candidates(
        all_spots,
        limit=fetch_limit,
        user_lat=user_lat,
        user_lon=user_lon,
        max_distance_km=max_distance_km,
        country=country,
        search=search,
        priority_countries=use_priority,
    )

    forecasts = await fetch_forecasts_batch([s["wg_id"] for s in candidates])
    results = []
    for s in candidates:
        scored = score_weekend_spot(s, forecasts.get(s["wg_id"], []), saturday, sunday)
        if scored:
            results.append(scored)
    results.sort(
        key=lambda x: (x.get("weekend_peak_kts", 0), x.get("max_wind_kts", 0), x.get("avg_wind_kts", 0)),
        reverse=True,
    )
    top = results[:limit]
    return {
        "saturday": saturday.isoformat(),
        "sunday": sunday.isoformat(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "country": country,
        "spots_count": len(top),
        "spots": [public_spot(s) for s in top],
    }


async def _refresh_weekend_cache(
    cache_key: str,
    *,
    user_lat: Optional[float] = None,
    user_lon: Optional[float] = None,
    max_distance_km: Optional[float] = None,
    country: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = DEFAULT_FORECAST_LIMIT,
) -> None:
    lock = _refresh_locks.setdefault(cache_key, asyncio.Lock())
    if lock.locked():
        return
    async with lock:
        try:
            payload = await _compute_weekend_ranking(
                user_lat=user_lat,
                user_lon=user_lon,
                max_distance_km=max_distance_km,
                country=country,
                search=search,
                limit=limit,
            )
            _weekend_cache[cache_key] = (time.time() + CACHE_TTL_SEC, payload)
            _persist_weekend_disk_cache()
        except Exception as exc:
            logger.warning("Weekend cache refresh failed %s: %s", cache_key, exc)


async def weekend_ranking(
    *,
    user_lat: Optional[float] = None,
    user_lon: Optional[float] = None,
    max_distance_km: Optional[float] = None,
    country: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = DEFAULT_FORECAST_LIMIT,
) -> dict:
    cache_key = f"wk2:{country or 'all'}:{search or ''}:{limit}"
    now = time.time()

    if cache_key in _weekend_cache:
        expires, cached = _weekend_cache[cache_key]
        if now < expires:
            return {**cached, "cached": True}
        asyncio.create_task(
            _refresh_weekend_cache(
                cache_key,
                user_lat=user_lat,
                user_lon=user_lon,
                max_distance_km=max_distance_km,
                country=country,
                search=search,
                limit=limit,
            )
        )
        return {**cached, "cached": True, "refreshing": True}

    payload = await _compute_weekend_ranking(
        user_lat=user_lat,
        user_lon=user_lon,
        max_distance_km=max_distance_km,
        country=country,
        search=search,
        limit=limit,
    )
    _weekend_cache[cache_key] = (now + CACHE_TTL_SEC, payload)
    _persist_weekend_disk_cache()
    return {**payload, "cached": False}


async def warmup_weekend_caches() -> None:
    preload_catalog()
    for country in WARMUP_COUNTRIES:
        try:
            await weekend_ranking(country=country, limit=DEFAULT_FORECAST_LIMIT)
            logger.info("Weekend cache warmed: %s", country or "all")
        except Exception as exc:
            logger.warning("Weekend warmup failed %s: %s", country, exc)


init_weekend_disk_cache()
