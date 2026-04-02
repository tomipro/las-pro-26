from __future__ import annotations

import os

os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .som import train_som
from .types import WellData

FEATURE_ORDER = ["GR", "DT", "RESD", "SP", "RHOB", "NPHI"]


def _prepare_feature_frame(well: WellData) -> tuple[pd.DataFrame, list[str], pd.Series]:
    df = well.data
    depth = df[well.depth_column] if well.depth_column in df.columns else pd.Series(dtype=float)
    cols: list[str] = []
    labels: list[str] = []

    for canonical in FEATURE_ORDER:
        actual = well.curve_map.get(canonical)
        if actual and actual in df.columns:
            cols.append(actual)
            labels.append(canonical)

    if not cols:
        return pd.DataFrame(index=df.index), labels, depth

    feat = df[cols].copy()
    feat.columns = labels
    feat = feat.replace([np.inf, -np.inf], np.nan)
    return feat, labels, depth


def run_ml(well: WellData) -> dict:
    features, labels, depth = _prepare_feature_frame(well)
    n_samples = len(features)
    if n_samples < 20 or features.shape[1] < 2:
        return {
            "status": "insufficient_data",
            "message": "Need at least 20 samples and 2 curves for ML modules.",
            "features_used": labels,
            "electrofacies": None,
            "anomalies": None,
        }

    preprocessor = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    x = preprocessor.fit_transform(features)

    contamination = 0.03 if n_samples >= 100 else 0.05
    anomaly_model = IsolationForest(
        n_estimators=200,
        contamination=contamination,
        random_state=42,
        n_jobs=1,
    )
    anomaly_labels = anomaly_model.fit_predict(x)
    anomaly_scores = anomaly_model.decision_function(x)

    anomaly_mask = anomaly_labels == -1
    anomaly_depths = (
        depth[anomaly_mask]
        .dropna()
        .head(20)
        .round(3)
        .tolist()
    )

    n_clusters = 4 if n_samples >= 150 else 3
    n_clusters = min(n_clusters, max(2, n_samples // 20))

    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=20)
    cluster_idx = kmeans.fit_predict(x)

    cluster_counts = (
        pd.Series(cluster_idx)
        .value_counts()
        .sort_index()
        .rename_axis("cluster")
        .to_dict()
    )

    transformed_centers = kmeans.cluster_centers_
    scaler = preprocessor.named_steps["scaler"]
    centers = scaler.inverse_transform(transformed_centers)

    center_rows = []
    for i, center in enumerate(centers):
        row = {"cluster": i, "count": int(cluster_counts.get(i, 0))}
        for j, label in enumerate(labels):
            row[label] = round(float(center[j]), 4)
        center_rows.append(row)

    som = None
    try:
        if n_samples < 90:
            som_rows, som_cols = 4, 4
        elif n_samples < 220:
            som_rows, som_cols = 5, 5
        else:
            som_rows, som_cols = 6, 6

        som_iterations = min(3200, max(650, n_samples * 8))
        som_result = train_som(
            x_scaled=x,
            rows=som_rows,
            cols=som_cols,
            iterations=som_iterations,
            random_state=42,
        )

        som_centers_orig = scaler.inverse_transform(
            som_result.codebook_scaled.reshape(som_rows * som_cols, len(labels))
        ).reshape(som_rows, som_cols, len(labels))

        component_planes = {}
        for i, label in enumerate(labels):
            component_planes[label] = [
                [round(float(v), 5) for v in row]
                for row in som_centers_orig[:, :, i].tolist()
            ]

        node_hits_serial = [[int(v) for v in row] for row in som_result.node_hits.tolist()]
        u_matrix_serial = [[round(float(v), 5) for v in row] for row in som_result.u_matrix.tolist()]

        top_nodes = []
        for r in range(som_rows):
            for c in range(som_cols):
                top_nodes.append({"row": r, "col": c, "hits": int(som_result.node_hits[r, c])})
        top_nodes = sorted(top_nodes, key=lambda v: v["hits"], reverse=True)[:8]

        som = {
            "status": "ok",
            "grid": {"rows": som_rows, "cols": som_cols, "nodes": som_rows * som_cols},
            "training": {
                "iterations": int(som_iterations),
                "quantization_error": round(float(som_result.quantization_error), 6),
                "topological_error": round(float(som_result.topological_error), 6),
            },
            "u_matrix": u_matrix_serial,
            "node_hits": node_hits_serial,
            "bmu": {
                "row": [int(v) for v in som_result.bmu_row.tolist()],
                "col": [int(v) for v in som_result.bmu_col.tolist()],
                "index": [int(v) for v in som_result.bmu_index.tolist()],
            },
            "component_planes": component_planes,
            "top_nodes": top_nodes,
        }
    except Exception as exc:
        som = {
            "status": "failed",
            "reason": str(exc),
        }

    return {
        "status": "ok",
        "features_used": labels,
        "anomalies": {
            "count": int(anomaly_mask.sum()),
            "pct": round(float(anomaly_mask.mean() * 100.0), 2),
            "depth_samples": anomaly_depths,
            "flags": anomaly_mask.astype(int).tolist(),
            "scores": [round(float(s), 5) for s in anomaly_scores.tolist()],
        },
        "electrofacies": {
            "n_clusters": n_clusters,
            "cluster_counts": {str(k): int(v) for k, v in cluster_counts.items()},
            "cluster_centers": center_rows,
            "labels": cluster_idx.tolist(),
        },
        "som": som,
    }
