"""Smart motion-weighted frame extraction for kitesurf video analysis."""
from __future__ import annotations

import base64
import logging
import os
from io import BytesIO
from pathlib import Path
from typing import List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger("ridemind")

MAX_FRAMES = int(os.environ.get("VIDEO_ANALYSIS_MAX_FRAMES", "96"))
MAX_EDGE_PX = int(os.environ.get("VIDEO_ANALYSIS_MAX_EDGE_PX", "1024"))
JPEG_QUALITY = int(os.environ.get("VIDEO_ANALYSIS_JPEG_QUALITY", "85"))
MAX_DURATION_SECONDS = 20

# Motion scan: sample ~1 frame every MOTION_SCAN_INTERVAL source frames (cap ~500 scans)
MOTION_SCAN_INTERVAL = int(os.environ.get("VIDEO_ANALYSIS_MOTION_SCAN_INTERVAL", "2"))
MOTION_DOWNSCALE = 320  # px max edge for motion scoring

# Frame budget weights (must sum to 1.0)
_ZONE_WEIGHTS = {
    "approach": 0.08,
    "takeoff": 0.24,
    "aerial": 0.28,
    "landing": 0.25,
    "cruise": 0.15,
}


def get_video_duration_seconds(path: Path) -> float:
    cap = cv2.VideoCapture(str(path))
    if cap.isOpened():
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
        frames = float(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        cap.release()
        if fps > 0 and frames > 0:
            return frames / fps
    return 0.0


def _resize_frame_bgr(frame, max_edge: int = MAX_EDGE_PX) -> Image.Image:
    img = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    w, h = img.size
    longest = max(w, h)
    if longest > max_edge:
        scale = max_edge / longest
        img = img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    return img


def _encode_jpeg(img: Image.Image) -> str:
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _downscale_gray(frame_bgr) -> np.ndarray:
    h, w = frame_bgr.shape[:2]
    scale = MOTION_DOWNSCALE / max(h, w)
    if scale < 1.0:
        frame_bgr = cv2.resize(frame_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)


def _smooth(values: List[float], window: int = 5) -> List[float]:
    if not values:
        return []
    arr = np.array(values, dtype=np.float64)
    if len(arr) < window:
        return arr.tolist()
    kernel = np.ones(window) / window
    padded = np.pad(arr, (window // 2, window // 2), mode="edge")
    return np.convolve(padded, kernel, mode="valid").tolist()


def _motion_profile(path: Path) -> Tuple[List[int], List[float], List[float], float, int]:
    """
    Scan video for per-frame motion energy.
    Returns (frame_indices, times_sec, motion_scores, fps, total_frames).
    """
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        return [], [], [], 0.0, 0

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0)
    if total <= 0:
        cap.release()
        return [], [], [], fps, 0

    step = max(1, MOTION_SCAN_INTERVAL)
    indices: List[int] = []
    scores: List[float] = []
    prev_gray: Optional[np.ndarray] = None

    idx = 0
    while idx < total:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ok, frame = cap.read()
        if not ok or frame is None:
            break
        gray = _downscale_gray(frame)
        if prev_gray is not None and gray.shape == prev_gray.shape:
            diff = cv2.absdiff(gray, prev_gray)
            # Weight upper frame more (rider/kite in air)
            h = diff.shape[0]
            upper = diff[: max(1, h * 2 // 3), :]
            lower = diff[h // 3 :, :]
            score = float(np.mean(upper)) * 1.15 + float(np.mean(lower)) * 0.85
            indices.append(idx)
            scores.append(score)
        prev_gray = gray
        idx += step

    cap.release()
    times = [round(i / fps, 3) for i in indices]
    return indices, times, _smooth(scores), fps, total


def _detect_trick_window(
    indices: List[int],
    scores: List[float],
    total_frames: int,
) -> Tuple[int, int, int]:
    """Return (trick_start_idx, peak_idx, trick_end_idx) as source frame numbers."""
    if not indices or not scores:
        mid = total_frames // 2
        return 0, mid, total_frames - 1

    arr = np.array(scores, dtype=np.float64)
    threshold = float(np.percentile(arr, 72))
    peak_pos = int(np.argmax(arr))
    peak_idx = indices[peak_pos]

    # Expand around peak while motion stays elevated
    lo, hi = peak_pos, peak_pos
    while lo > 0 and arr[lo - 1] >= threshold * 0.55:
        lo -= 1
    while hi < len(arr) - 1 and arr[hi + 1] >= threshold * 0.55:
        hi += 1

    trick_start = indices[lo]
    trick_end = indices[hi]

    # Pad window slightly for approach / reception
    pad = max(int((trick_end - trick_start) * 0.25), int(total_frames * 0.05))
    trick_start = max(0, trick_start - pad)
    trick_end = min(total_frames - 1, trick_end + pad)
    return trick_start, peak_idx, trick_end


def _zone_for_index(frame_idx: int, trick_start: int, peak: int, trick_end: int) -> str:
    if frame_idx < trick_start:
        return "approach"
    if frame_idx < peak:
        return "takeoff"
    if frame_idx <= int(peak + (trick_end - peak) * 0.55):
        return "aerial"
    if frame_idx <= trick_end:
        return "landing"
    return "cruise"


def _pick_in_range(start: int, end: int, count: int) -> List[int]:
    if count <= 0 or end < start:
        return []
    if count == 1:
        return [start]
    span = end - start
    if span == 0:
        return [start] * count
    return sorted({start + int(round(span * i / (count - 1))) for i in range(count)})


def _allocate_smart_indices(
    total_frames: int,
    max_frames: int,
    trick_start: int,
    peak: int,
    trick_end: int,
) -> List[Tuple[int, str]]:
    """Allocate frame indices with higher density around takeoff, aerial, landing."""
    max_frames = min(max_frames, total_frames)
    if total_frames <= max_frames:
        return [(i, _zone_for_index(i, trick_start, peak, trick_end)) for i in range(total_frames)]

    counts = {z: max(1, int(round(max_frames * w))) for z, w in _ZONE_WEIGHTS.items()}
    # Adjust to exact budget
    while sum(counts.values()) > max_frames:
        z = max(counts, key=lambda k: counts[k])
        counts[z] -= 1
    while sum(counts.values()) < max_frames:
        counts["aerial"] += 1

    aerial_mid_end = int(peak + (trick_end - peak) * 0.55)
    zones = [
        ("approach", 0, max(0, trick_start - 1), counts["approach"]),
        ("takeoff", trick_start, max(trick_start, peak - 1), counts["takeoff"]),
        ("aerial", max(trick_start, peak - 1), max(peak, aerial_mid_end), counts["aerial"]),
        ("landing", max(peak, aerial_mid_end), trick_end, counts["landing"]),
        ("cruise", trick_end + 1, total_frames - 1, counts["cruise"]),
    ]

    chosen: set[int] = {0, total_frames - 1}
    result: List[Tuple[int, str]] = []

    for zone_name, z_start, z_end, n in zones:
        if z_start > z_end or n <= 0:
            continue
        picks = _pick_in_range(z_start, z_end, n)
        for p in picks:
            if p not in chosen:
                chosen.add(p)
                result.append((p, zone_name))

    # Fill remaining budget near peak (takeoff + landing priority)
    priority_ranges = [
        (max(0, peak - int(total_frames * 0.08)), peak, "takeoff"),
        (peak, min(total_frames - 1, peak + int(total_frames * 0.12)), "aerial"),
        (min(total_frames - 1, trick_end - int(total_frames * 0.05)), trick_end, "landing"),
    ]
    for start, end, zone_name in priority_ranges:
        if len(result) >= max_frames:
            break
        for p in range(start, end + 1):
            if len(result) >= max_frames:
                break
            if p not in chosen:
                chosen.add(p)
                result.append((p, zone_name))

    # Uniform fill if still under budget
    if len(result) < max_frames:
        step = max(1, total_frames // (max_frames - len(result) + 1))
        for p in range(0, total_frames, step):
            if len(result) >= max_frames:
                break
            if p not in chosen:
                chosen.add(p)
                result.append((p, _zone_for_index(p, trick_start, peak, trick_end)))

    result.sort(key=lambda x: x[0])
    return result[:max_frames]


def _read_frames_at_indices(path: Path, indexed: List[Tuple[int, str]], fps: float) -> List[dict]:
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        return []

    out: List[dict] = []
    for seq, (frame_idx, phase) in enumerate(indexed):
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ok, frame = cap.read()
        if not ok or frame is None:
            continue
        time_sec = round(frame_idx / fps, 3) if fps > 0 else float(seq)
        out.append({
            "b64": _encode_jpeg(_resize_frame_bgr(frame)),
            "time_sec": time_sec,
            "index": seq + 1,
            "source_frame": frame_idx,
            "phase": phase,
        })
    cap.release()
    return out


def extract_video_frames(path: Path, max_frames: int | None = None) -> List[dict]:
    """
    Motion-aware extraction: dense sampling around pop, aerial phase, and landing.
    Returns chronologically ordered frames with phase metadata.
    """
    budget = max_frames if max_frames is not None else MAX_FRAMES
    budget = max(24, min(budget, 96))

    scan_idx, _, scores, fps, total = _motion_profile(path)
    if total <= 0:
        raise ValueError("Impossible de lire cette vidéo. Utilise un format MP4 ou MOV standard.")

    if total <= budget:
        indexed = [(i, "cruise") for i in range(total)]
    else:
        trick_start, peak, trick_end = _detect_trick_window(scan_idx, scores, total)
        indexed = _allocate_smart_indices(total, budget, trick_start, peak, trick_end)
        logger.info(
            "Smart frames: total=%d budget=%d trick=[%d..%d] peak=%d zones=%s",
            total,
            budget,
            trick_start,
            trick_end,
            peak,
            {z: sum(1 for _, ph in indexed if ph == z) for z in _ZONE_WEIGHTS},
        )

    frames = _read_frames_at_indices(path, indexed, fps)
    if not frames:
        raise ValueError("Impossible d'extraire les images de la vidéo.")

    logger.info("Extracted %d frames (budget=%d, source_total=%d)", len(frames), budget, total)
    return frames
