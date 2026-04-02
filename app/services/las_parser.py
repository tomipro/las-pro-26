from __future__ import annotations

import io
import re
from pathlib import Path

import lasio
import numpy as np
import pandas as pd

from .constants import CANONICAL_CURVE_ALIASES
from .types import WellData


def _clean_curve_name(name: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", name.upper())


def _build_curve_map(columns: list[str]) -> dict[str, str]:
    cleaned_map = {_clean_curve_name(col): col for col in columns}
    result: dict[str, str] = {}
    for canonical, aliases in CANONICAL_CURVE_ALIASES.items():
        for alias in aliases:
            candidate = cleaned_map.get(_clean_curve_name(alias))
            if candidate is not None:
                result[canonical] = candidate
                break
    return result


def _safe_header_value(las: lasio.LASFile, mnem: str) -> str:
    try:
        item = las.well[mnem]
        if item is None or item.value is None:
            return ""
        return str(item.value).strip()
    except Exception:
        return ""


def _safe_version_value(las: lasio.LASFile) -> str:
    try:
        return str(las.version["VERS"].value).strip()
    except Exception:
        pass
    try:
        return str(las.version.VERS.value).strip()
    except Exception:
        return ""


def parse_las_bytes(file_name: str, payload: bytes) -> WellData:
    text = payload.decode("utf-8", errors="ignore")
    las = lasio.read(io.StringIO(text))

    df = las.df().reset_index()
    df.columns = [str(c).strip().upper() for c in df.columns]

    null_value: float | None = None
    null_raw = _safe_header_value(las, "NULL")
    if null_raw:
        try:
            null_value = float(null_raw)
        except ValueError:
            null_value = None
    if null_value is not None:
        df = df.replace(null_value, np.nan)

    curve_units: dict[str, str] = {}
    curve_descriptions: dict[str, str] = {}
    for curve in las.curves:
        mnemonic = str(curve.mnemonic).strip().upper()
        curve_units[mnemonic] = str(curve.unit or "")
        curve_descriptions[mnemonic] = str(curve.descr or "")

    curve_map = _build_curve_map(list(df.columns))

    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    well_name = _safe_header_value(las, "WELL") or Path(file_name).stem
    api = _safe_header_value(las, "API")

    well_params = {
        "BHT": _safe_header_value(las, "BHT"),
        "RMF": _safe_header_value(las, "RMF"),
        "RMFT": _safe_header_value(las, "RMFT"),
        "EKB": _safe_header_value(las, "EKB"),
    }

    return WellData(
        filename=file_name,
        las_version=_safe_version_value(las),
        well_name=well_name,
        api=api,
        company=_safe_header_value(las, "COMP"),
        state=_safe_header_value(las, "STAT"),
        country=_safe_header_value(las, "CTRY"),
        null_value=null_value,
        data=df,
        curve_units=curve_units,
        curve_descriptions=curve_descriptions,
        curve_map=curve_map,
        well_params=well_params,
    )


def parse_las_file(path: Path) -> WellData:
    return parse_las_bytes(path.name, path.read_bytes())
