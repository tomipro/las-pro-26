from __future__ import annotations

import math

import pandas as pd

from .constants import PHYSICS_RANGES
from .types import WellData


def _series_stats(series: pd.Series) -> dict[str, float | int | None]:
    valid = series.dropna()
    if valid.empty:
        return {
            "count": 0,
            "missing_pct": 100.0,
            "min": None,
            "max": None,
            "mean": None,
            "std": None,
        }
    missing_pct = float(series.isna().mean() * 100.0)
    return {
        "count": int(valid.size),
        "missing_pct": round(missing_pct, 2),
        "min": round(float(valid.min()), 4),
        "max": round(float(valid.max()), 4),
        "mean": round(float(valid.mean()), 4),
        "std": round(float(valid.std(ddof=0)), 4),
    }


def _mad_outlier_fraction(series: pd.Series, threshold: float = 6.0) -> float:
    valid = series.dropna()
    if valid.size < 10:
        return 0.0
    med = float(valid.median())
    mad = float((valid - med).abs().median())
    if math.isclose(mad, 0.0):
        return 0.0
    robust_z = 0.6745 * (valid - med) / mad
    frac = float((robust_z.abs() > threshold).mean())
    return round(frac * 100.0, 2)


def run_qc(well: WellData) -> dict:
    df = well.data
    depth_col = well.depth_column
    checks: list[dict[str, str | int | float]] = []

    if depth_col not in df.columns:
        return {
            "status": "failed",
            "reason": "No depth curve found.",
            "checks": [{"severity": "error", "message": "Depth curve missing"}],
            "curve_stats": {},
            "data_score": 0,
        }

    depth = df[depth_col]
    depth_diff = depth.diff().dropna()
    depth_monotonic = bool(depth.is_monotonic_increasing)
    checks.append(
        {
            "severity": "ok" if depth_monotonic else "error",
            "message": "Depth is monotonic increasing" if depth_monotonic else "Depth is not monotonic",
        }
    )

    if not depth_diff.empty:
        nominal_step = float(depth_diff.median())
        irregular = int((depth_diff - nominal_step).abs().gt(max(abs(nominal_step) * 0.2, 0.001)).sum())
    else:
        nominal_step = 0.0
        irregular = 0

    checks.append(
        {
            "severity": "ok" if irregular == 0 else "warn",
            "message": f"Depth step median={nominal_step:.4f}, irregular intervals={irregular}",
        }
    )

    curve_stats: dict[str, dict] = {}
    data_score = 100.0

    for canonical, actual in well.curve_map.items():
        if actual not in df.columns:
            continue

        stats = _series_stats(df[actual])
        stats["unit"] = well.curve_units.get(actual, "")
        stats["outlier_pct"] = _mad_outlier_fraction(df[actual])
        curve_stats[canonical] = stats

        missing_pct = float(stats["missing_pct"]) if stats["missing_pct"] is not None else 100.0
        if missing_pct > 30.0:
            data_score -= 15
            checks.append(
                {
                    "severity": "warn",
                    "message": f"{canonical} has high missing values ({missing_pct:.1f}%)",
                }
            )

        expected_range = PHYSICS_RANGES.get(canonical)
        if expected_range and stats["min"] is not None and stats["max"] is not None:
            lo, hi = expected_range
            if float(stats["min"]) < lo or float(stats["max"]) > hi:
                data_score -= 5
                checks.append(
                    {
                        "severity": "warn",
                        "message": (
                            f"{canonical} has values outside expected physics range "
                            f"[{lo}, {hi}]"
                        ),
                    }
                )

        if float(stats["outlier_pct"]) > 3.0:
            data_score -= 5
            checks.append(
                {
                    "severity": "warn",
                    "message": f"{canonical} has elevated outlier fraction ({stats['outlier_pct']}%)",
                }
            )

    data_score = max(0.0, min(100.0, data_score))

    status = "ok"
    if any(c["severity"] == "error" for c in checks):
        status = "failed"
    elif any(c["severity"] == "warn" for c in checks):
        status = "warning"

    return {
        "status": status,
        "checks": checks,
        "curve_stats": curve_stats,
        "data_score": round(data_score, 1),
    }
