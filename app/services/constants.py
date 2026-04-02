from __future__ import annotations

CANONICAL_CURVE_ALIASES: dict[str, list[str]] = {
    "DEPT": ["DEPT", "DEPTH", "MD", "TDEP"],
    "GR": ["GR", "GAM", "GRC", "SGR"],
    "DT": ["DT", "AC", "DTC", "SONIC"],
    "RESD": ["RESD", "RT", "ILD", "LLD", "RDEP"],
    "SP": ["SP", "SPONT", "SSP"],
    "RHOB": ["RHOB", "RHOZ", "DEN", "DENB"],
    "NPHI": ["NPHI", "TNPH", "NPHI_LS"],
}

PHYSICS_RANGES: dict[str, tuple[float, float]] = {
    "GR": (0.0, 250.0),
    "DT": (30.0, 180.0),
    "RESD": (0.05, 5000.0),
    "SP": (-200.0, 200.0),
    "RHOB": (1.8, 3.1),
    "NPHI": (-0.15, 0.6),
}

DEFAULT_ARCHIE = {
    "a": 1.0,
    "m": 2.0,
    "n": 2.0,
    "rw": 0.10,
}
