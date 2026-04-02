from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass
class WellData:
    filename: str
    las_version: str
    well_name: str
    api: str
    company: str
    state: str
    country: str
    null_value: float | None
    data: pd.DataFrame
    curve_units: dict[str, str]
    curve_descriptions: dict[str, str]
    curve_map: dict[str, str]
    well_params: dict[str, str]

    @property
    def depth_column(self) -> str:
        return self.curve_map.get("DEPT", "DEPT")
