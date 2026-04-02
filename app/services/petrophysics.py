from __future__ import annotations

import numpy as np
import pandas as pd

from .constants import DEFAULT_ARCHIE
from .types import WellData


def _extract_intervals(depth: pd.Series, mask: pd.Series, min_points: int = 3) -> list[dict]:
    intervals: list[dict] = []
    if depth.empty or mask.empty:
        return intervals

    start_idx: int | None = None
    for i, is_true in enumerate(mask.fillna(False).tolist()):
        if is_true and start_idx is None:
            start_idx = i
        if (not is_true or i == len(mask) - 1) and start_idx is not None:
            end_idx = i if is_true and i == len(mask) - 1 else i - 1
            if end_idx - start_idx + 1 >= min_points:
                top = float(depth.iloc[start_idx])
                base = float(depth.iloc[end_idx])
                intervals.append(
                    {
                        "top": round(top, 2),
                        "base": round(base, 2),
                        "thickness": round(base - top, 2),
                    }
                )
            start_idx = None
    return intervals


def run_petrophysics(well: WellData) -> dict:
    df = well.data.copy()
    depth_col = well.depth_column
    depth = df[depth_col] if depth_col in df.columns else pd.Series(dtype=float)

    gr_col = well.curve_map.get("GR")
    dt_col = well.curve_map.get("DT")
    rhob_col = well.curve_map.get("RHOB")
    rt_col = well.curve_map.get("RESD")

    derived = {
        "VSH": pd.Series(np.nan, index=df.index),
        "PHI": pd.Series(np.nan, index=df.index),
        "SW": pd.Series(np.nan, index=df.index),
    }

    assumptions: list[str] = []

    if gr_col and gr_col in df.columns:
        gr = df[gr_col]
        gr_clean = np.nanpercentile(gr, 10)
        gr_shale = np.nanpercentile(gr, 90)
        denominator = gr_shale - gr_clean
        if denominator <= 1e-6:
            denominator = 1.0
        igr = (gr - gr_clean) / denominator
        derived["VSH"] = igr.clip(0.0, 1.0)
        assumptions.append(
            f"Vsh from GR linear index using GR_clean p10={gr_clean:.2f}, GR_shale p90={gr_shale:.2f}."
        )

    phi_candidates: list[pd.Series] = []

    if dt_col and dt_col in df.columns:
        dt = df[dt_col]
        dtma = 55.5
        dtfl = 189.0
        phi_sonic = ((dt - dtma) / (dtfl - dtma)).clip(0.0, 0.45)
        phi_candidates.append(phi_sonic)
        assumptions.append("Porosity from Wyllie time-average using dtma=55.5 us/ft and dtfl=189 us/ft.")

    if rhob_col and rhob_col in df.columns:
        rhob = df[rhob_col]
        rho_ma = 2.65
        rho_fl = 1.0
        phi_density = ((rho_ma - rhob) / (rho_ma - rho_fl)).clip(0.0, 0.45)
        phi_candidates.append(phi_density)
        assumptions.append("Porosity from density with rho_ma=2.65 g/cc and rho_fl=1.0 g/cc.")

    if phi_candidates:
        phi_df = pd.concat(phi_candidates, axis=1)
        derived["PHI"] = phi_df.mean(axis=1, skipna=True)

    rw = DEFAULT_ARCHIE["rw"]
    rmf_raw = well.well_params.get("RMF", "")
    if rmf_raw:
        try:
            rmf = float(rmf_raw)
            if rmf > 0:
                rw = max(0.02, min(rmf * 0.8, 1.0))
                assumptions.append(
                    f"Rw inferred from RMF ({rmf:.3f} ohm.m) with scaling factor 0.8 -> Rw={rw:.3f}."
                )
        except ValueError:
            pass

    if rt_col and rt_col in df.columns:
        rt = df[rt_col].clip(lower=0.05)
        phi = derived["PHI"].clip(lower=0.02)
        sw = ((DEFAULT_ARCHIE["a"] * rw) / (rt * (phi**DEFAULT_ARCHIE["m"]))) ** (1.0 / DEFAULT_ARCHIE["n"])
        derived["SW"] = sw.clip(0.0, 1.0)
        assumptions.append(
            "Sw from Archie (a=1, m=2, n=2). This is a screening estimate, not a calibrated reservoir model."
        )

    net_reservoir_mask = (
        (derived["VSH"] < 0.40)
        & (derived["PHI"] > 0.08)
        & (derived["SW"] < 0.60)
    )

    potential_intervals = _extract_intervals(depth, net_reservoir_mask, min_points=3)

    summary = {
        "avg_vsh": round(float(derived["VSH"].mean(skipna=True)), 4)
        if derived["VSH"].notna().any()
        else None,
        "avg_phi": round(float(derived["PHI"].mean(skipna=True)), 4)
        if derived["PHI"].notna().any()
        else None,
        "avg_sw": round(float(derived["SW"].mean(skipna=True)), 4)
        if derived["SW"].notna().any()
        else None,
        "net_reservoir_points": int(net_reservoir_mask.sum()),
        "potential_pay_intervals": potential_intervals,
    }

    return {
        "summary": summary,
        "assumptions": assumptions,
        "derived": {
            "depth": depth.round(4).where(pd.notna(depth), None).tolist(),
            "vsh": derived["VSH"].round(4).where(pd.notna(derived["VSH"]), None).tolist(),
            "phi": derived["PHI"].round(4).where(pd.notna(derived["PHI"]), None).tolist(),
            "sw": derived["SW"].round(4).where(pd.notna(derived["SW"]), None).tolist(),
        },
    }
