"""Spot safety levels, danger scoring, rider matching."""
from __future__ import annotations

LEVEL_RANK = {"beginner": 1, "intermediate": 2, "advanced": 3, "pro": 4}

DANGER_LABELS = {
    1: "faible",
    2: "modéré",
    3: "élevé",
    4: "expert",
    5: "extrême",
}


def spot_min_level(spot: dict) -> str:
    return (spot.get("min_level") or spot.get("level") or "intermediate").lower()


def spot_danger(spot: dict) -> int:
    return int(spot.get("danger") or 2)


def rider_may_use_spot(user_level: str, spot: dict) -> bool:
    """Hard filter — spot excluded from recommendations if unsafe for rider level."""
    user = LEVEL_RANK.get((user_level or "").lower(), 2)
    danger = spot_danger(spot)
    min_lvl = LEVEL_RANK.get(spot_min_level(spot), 2)

    if user < min_lvl:
        return False
    if user <= 1 and danger >= 3:
        return False
    if user == 2 and danger >= 4:
        return False
    return True


def level_match_bonus(user_level: str, spot: dict) -> float:
    user = LEVEL_RANK.get((user_level or "").lower(), 2)
    danger = spot_danger(spot)
    min_lvl = LEVEL_RANK.get(spot_min_level(spot), 2)
    bonus = 0.0
    if user == min_lvl:
        bonus += 20
    elif user == min_lvl + 1:
        bonus += 8
    # Advanced/pro seek challenge
    if user >= 3 and danger >= 3:
        bonus += 18
    if user >= 4 and danger >= 4:
        bonus += 12
    # Penalize easy spots for pros (boring)
    if user >= 4 and danger <= 1:
        bonus -= 10
    return bonus


def safety_ok_flag(user_level: str, spot: dict) -> bool:
    return rider_may_use_spot(user_level, spot)
