from __future__ import annotations

import math
from collections import Counter

import numpy as np
import pandas as pd

from .types import WellData

TRACT_LEGEND = [
    {"id": 0, "name": "UNDEF", "color": "#888888"},
    {"id": 1, "name": "Progradation - Regression", "color": "#d34a4a"},
    {"id": 2, "name": "Retrogradation - Transgression", "color": "#4779d8"},
    {"id": 3, "name": "Steady Aggradation", "color": "#6cba65"},
]

TRACT_BY_ID = {row["id"]: row["name"] for row in TRACT_LEGEND}


def _safe_round(value: float | None, n: int = 4) -> float | None:
    if value is None:
        return None
    try:
        if not math.isfinite(float(value)):
            return None
        return round(float(value), n)
    except Exception:
        return None


def _pick_source_curve(well: WellData) -> tuple[str | None, str | None]:
    preference = ["GR", "SP", "NPHI", "RESD", "DT", "RHOB"]
    for canonical in preference:
        col = well.curve_map.get(canonical)
        if col and col in well.data.columns:
            return canonical, col
    return None, None


def _rolling_window_size(n: int) -> int:
    if n < 80:
        return 7
    if n < 180:
        return 11
    if n < 420:
        return 17
    return 25


def _sanitize_depth_signal(depth: pd.Series, signal: pd.Series) -> tuple[np.ndarray, np.ndarray]:
    work = pd.DataFrame({"depth": pd.to_numeric(depth, errors="coerce"), "signal": pd.to_numeric(signal, errors="coerce")})
    work = work.replace([np.inf, -np.inf], np.nan).dropna(subset=["depth", "signal"])
    if work.empty:
        return np.array([]), np.array([])

    work = work.sort_values("depth")
    work = work.groupby("depth", as_index=False)["signal"].mean()
    if len(work) < 20:
        return np.array([]), np.array([])
    return work["depth"].to_numpy(dtype=float), work["signal"].to_numpy(dtype=float)


def _signal_transform(canonical_curve: str, signal: np.ndarray) -> np.ndarray:
    transformed = signal.astype(float).copy()
    if canonical_curve == "RESD":
        transformed = np.log10(np.clip(transformed, 0.05, None))
    return transformed


def _normalize_signal(signal: np.ndarray) -> np.ndarray:
    p05 = np.nanpercentile(signal, 5)
    p95 = np.nanpercentile(signal, 95)
    den = p95 - p05
    if den <= 1e-8:
        den = np.nanstd(signal)
    if den <= 1e-8:
        den = 1.0
    return np.clip((signal - p05) / den, -0.5, 1.5)


def _classify_tracts(trend: np.ndarray, threshold: float) -> np.ndarray:
    tract_idx = np.zeros_like(trend, dtype=int)
    tract_idx[trend < -threshold] = 1
    tract_idx[trend > threshold] = 2
    steady_mask = (trend >= -threshold) & (trend <= threshold)
    tract_idx[steady_mask] = 3
    return tract_idx


def _extract_boundaries(
    depth: np.ndarray,
    smooth_signal: np.ndarray,
    trend: np.ndarray,
    tract_idx: np.ndarray,
    confidence_track: np.ndarray,
) -> list[dict]:
    if len(depth) < 5:
        return []

    jump = np.abs(np.diff(smooth_signal, prepend=smooth_signal[0]))
    jump_ref = float(np.nanpercentile(jump, 90)) if np.isfinite(jump).any() else 1.0
    if jump_ref <= 1e-8:
        jump_ref = 1.0

    candidates: list[dict] = []
    for i in range(1, len(depth)):
        prev_tract = int(tract_idx[i - 1])
        curr_tract = int(tract_idx[i])
        if prev_tract == curr_tract:
            continue
        if prev_tract == 0 or curr_tract == 0:
            continue
        local_jump_score = min(1.0, abs(float(jump[i])) / jump_ref)
        local_grad_score = float(np.clip(abs(float(trend[i])) * 1.8, 0.0, 1.0))
        conf = float(np.clip(0.45 * confidence_track[i] + 0.3 * local_grad_score + 0.25 * local_jump_score, 0.0, 1.0))
        candidates.append(
            {
                "index": i,
                "depth": float(depth[i]),
                "confidence": conf,
                "from_tract": TRACT_BY_ID.get(prev_tract, "UNDEF"),
                "to_tract": TRACT_BY_ID.get(curr_tract, "UNDEF"),
            }
        )

    if not candidates:
        return []

    depth_span = float(depth[-1] - depth[0])
    min_sep_depth = max(depth_span * 0.025, float(np.nanmedian(np.diff(depth)) * 8.0))

    selected: list[dict] = []
    for candidate in sorted(candidates, key=lambda row: row["confidence"], reverse=True):
        if all(abs(candidate["depth"] - chosen["depth"]) >= min_sep_depth for chosen in selected):
            selected.append(candidate)
        if len(selected) >= 12:
            break

    selected = sorted(selected, key=lambda row: row["depth"])
    for idx, row in enumerate(selected, start=1):
        row["id"] = f"auto-{idx}"
        row["depth"] = _safe_round(row["depth"], 2)
        row["confidence"] = _safe_round(row["confidence"], 3)
    return selected


def _dominant_tract_name(tract_slice: np.ndarray) -> str:
    if tract_slice.size == 0:
        return "UNDEF"
    counts = Counter(tract_slice.tolist())
    tract_id = int(max(counts, key=counts.get))
    return TRACT_BY_ID.get(tract_id, "UNDEF")


def _extract_intervals(depth: np.ndarray, tract_idx: np.ndarray, confidence_track: np.ndarray, boundaries: list[dict]) -> list[dict]:
    if len(depth) < 3:
        return []

    boundary_depths = [float(row["depth"]) for row in boundaries]
    edges = [float(depth[0]), *boundary_depths, float(depth[-1])]
    intervals: list[dict] = []
    for i in range(len(edges) - 1):
        top = edges[i]
        base = edges[i + 1]
        if base <= top:
            continue
        mask = (depth >= top) & (depth <= base)
        tract_name = _dominant_tract_name(tract_idx[mask])
        mean_conf = float(np.nanmean(confidence_track[mask])) if np.any(mask) else 0.0
        intervals.append(
            {
                "id": f"int-{i + 1}",
                "top": _safe_round(top, 2),
                "base": _safe_round(base, 2),
                "thickness": _safe_round(base - top, 2),
                "tract": tract_name,
                "confidence": _safe_round(mean_conf, 3),
            }
        )
    return intervals


def run_sequence_stratigraphy(well: WellData) -> dict:
    source_curve, source_col = _pick_source_curve(well)
    depth_col = well.depth_column
    if not source_curve or not source_col or depth_col not in well.data.columns:
        return {
            "status": "insufficient_data",
            "reason": "Need depth and at least one valid curve (GR/SP/NPHI/RESD/DT/RHOB).",
            "boundaries_auto": [],
            "intervals_auto": [],
            "tracks": {},
            "legend": TRACT_LEGEND,
        }

    depth, signal = _sanitize_depth_signal(well.data[depth_col], well.data[source_col])
    if depth.size < 30:
        return {
            "status": "insufficient_data",
            "reason": "Not enough valid samples for sequence analysis.",
            "boundaries_auto": [],
            "intervals_auto": [],
            "tracks": {},
            "legend": TRACT_LEGEND,
        }

    transformed_signal = _signal_transform(source_curve, signal)
    norm_signal = _normalize_signal(transformed_signal)
    window = _rolling_window_size(len(norm_signal))
    smooth = pd.Series(norm_signal).rolling(window=window, center=True, min_periods=max(3, window // 2)).mean()
    smooth = smooth.interpolate(limit_direction="both").to_numpy(dtype=float)

    trend = np.gradient(smooth, depth)
    abs_trend = np.abs(trend)
    trend_ref = float(np.nanpercentile(abs_trend, 75)) if np.isfinite(abs_trend).any() else 0.02
    if trend_ref <= 1e-8:
        trend_ref = float(np.nanstd(trend))
    if trend_ref <= 1e-8:
        trend_ref = 0.02

    threshold = max(0.006, trend_ref * 0.62)
    tract_idx = _classify_tracts(trend, threshold)
    confidence_track = np.clip(abs_trend / (trend_ref + 1e-8), 0.0, 1.0)

    boundaries = _extract_boundaries(depth, smooth, trend, tract_idx, confidence_track)
    intervals = _extract_intervals(depth, tract_idx, confidence_track, boundaries)

    tract_names = [TRACT_BY_ID.get(int(v), "UNDEF") for v in tract_idx.tolist()]
    dominant_tract = _dominant_tract_name(tract_idx)
    boundary_conf = [float(b.get("confidence", 0.0) or 0.0) for b in boundaries]

    return {
        "status": "ok",
        "source_curve": source_curve,
        "source_curve_actual": source_col,
        "legend": TRACT_LEGEND,
        "method": {
            "type": "rule_based_trend_segmentation",
            "description": "Smoothed normalized log trend + confidence-ranked boundary picking. AI/human review expected.",
            "window": int(window),
            "trend_threshold": _safe_round(threshold, 6),
        },
        "summary": {
            "n_boundaries_auto": len(boundaries),
            "n_intervals_auto": len(intervals),
            "mean_boundary_confidence": _safe_round(float(np.mean(boundary_conf)), 3) if boundary_conf else None,
            "dominant_tract": dominant_tract,
        },
        "boundaries_auto": boundaries,
        "intervals_auto": intervals,
        "tracks": {
            "depth": [_safe_round(v, 3) for v in depth.tolist()],
            "signal": [_safe_round(v, 5) for v in transformed_signal.tolist()],
            "signal_smooth": [_safe_round(v, 5) for v in smooth.tolist()],
            "trend": [_safe_round(v, 6) for v in trend.tolist()],
            "tract_idx": [int(v) for v in tract_idx.tolist()],
            "tract": tract_names,
            "confidence": [_safe_round(v, 4) for v in confidence_track.tolist()],
        },
    }


def build_sequence_correlation(reports: list[dict]) -> dict:
    rows: list[dict] = []
    for report in reports:
        seq = report.get("sequence_stratigraphy", {}) or {}
        if seq.get("status") != "ok":
            continue
        boundaries = seq.get("boundaries_auto", []) or []
        depth_track = (seq.get("tracks", {}) or {}).get("depth", []) or []
        if not boundaries or len(depth_track) < 2:
            continue
        top, base = float(depth_track[0]), float(depth_track[-1])
        span = base - top
        if span <= 0:
            continue
        rel = [(float(b["depth"]) - top) / span for b in boundaries if b.get("depth") is not None]
        if not rel:
            continue
        rows.append(
            {
                "well_name": report.get("well_name", "Unknown"),
                "boundaries": boundaries,
                "rel_positions": rel,
                "top": top,
                "base": base,
                "span": span,
            }
        )

    if not rows:
        return {
            "status": "insufficient_data",
            "method": "relative_depth_boundary_alignment",
            "surface_names": [],
            "well_names": [],
            "depth_matrix": [],
            "relative_matrix": [],
        }

    counts = [len(r["rel_positions"]) for r in rows]
    target_surfaces = int(np.clip(round(float(np.median(counts))), 2, 6))

    all_rel = np.array([p for row in rows for p in row["rel_positions"]], dtype=float)
    quantiles = np.linspace(0.12, 0.88, target_surfaces)
    targets = np.quantile(all_rel, quantiles).tolist()

    surface_names = [f"SS-{i + 1}" for i in range(len(targets))]
    well_names = [r["well_name"] for r in rows]
    depth_matrix: list[list[float | None]] = []
    rel_matrix: list[list[float | None]] = []

    for target in targets:
        depth_row: list[float | None] = []
        rel_row: list[float | None] = []
        for row in rows:
            rel_positions = row["rel_positions"]
            boundaries = row["boundaries"]
            best_idx = int(np.argmin([abs(pos - target) for pos in rel_positions]))
            best_rel = float(rel_positions[best_idx])
            if abs(best_rel - target) > 0.20:
                depth_row.append(None)
                rel_row.append(None)
                continue
            depth_row.append(_safe_round(float(boundaries[best_idx]["depth"]), 2))
            rel_row.append(_safe_round(best_rel, 4))
        depth_matrix.append(depth_row)
        rel_matrix.append(rel_row)

    return {
        "status": "ok",
        "method": "relative_depth_boundary_alignment",
        "surface_names": surface_names,
        "well_names": well_names,
        "depth_matrix": depth_matrix,
        "relative_matrix": rel_matrix,
        "notes": "Relative positions are matched to portfolio-level targets, then mapped back to depth.",
    }
