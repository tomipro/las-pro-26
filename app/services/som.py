from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np


@dataclass
class SOMResult:
    rows: int
    cols: int
    iterations: int
    quantization_error: float
    topological_error: float
    u_matrix: np.ndarray
    node_hits: np.ndarray
    bmu_row: np.ndarray
    bmu_col: np.ndarray
    bmu_index: np.ndarray
    codebook_scaled: np.ndarray


class SimpleSOM:
    def __init__(
        self,
        rows: int,
        cols: int,
        input_dim: int,
        sigma: float = 1.5,
        learning_rate: float = 0.5,
        random_state: int = 42,
    ) -> None:
        self.rows = rows
        self.cols = cols
        self.input_dim = input_dim
        self.sigma0 = max(0.8, float(sigma))
        self.lr0 = max(0.05, float(learning_rate))

        self._rng = np.random.default_rng(random_state)
        self._weights = self._rng.normal(0.0, 1.0, size=(rows, cols, input_dim))
        self._grid_r, self._grid_c = np.meshgrid(np.arange(rows), np.arange(cols), indexing="ij")

    @property
    def weights(self) -> np.ndarray:
        return self._weights

    def _winner(self, sample: np.ndarray) -> tuple[int, int]:
        diff = self._weights - sample
        dist = np.linalg.norm(diff, axis=2)
        idx = int(np.argmin(dist))
        return idx // self.cols, idx % self.cols

    def train(self, data: np.ndarray, iterations: int) -> None:
        n_samples = data.shape[0]
        if n_samples == 0:
            return

        iters = max(50, int(iterations))
        for it in range(iters):
            sample = data[self._rng.integers(0, n_samples)]
            bmu_r, bmu_c = self._winner(sample)

            progress = it / max(1, iters - 1)
            lr = self.lr0 * math.exp(-3.0 * progress)
            sigma = self.sigma0 * math.exp(-2.5 * progress)
            sigma = max(0.35, sigma)

            dist_sq = (self._grid_r - bmu_r) ** 2 + (self._grid_c - bmu_c) ** 2
            influence = np.exp(-dist_sq / (2.0 * sigma * sigma))
            self._weights += lr * influence[:, :, None] * (sample - self._weights)

    def map_vectors(self, data: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        rows = np.zeros(data.shape[0], dtype=int)
        cols = np.zeros(data.shape[0], dtype=int)
        index = np.zeros(data.shape[0], dtype=int)

        for i, sample in enumerate(data):
            r, c = self._winner(sample)
            rows[i] = r
            cols[i] = c
            index[i] = r * self.cols + c
        return rows, cols, index

    def quantization_error(self, data: np.ndarray) -> float:
        errs = []
        for sample in data:
            r, c = self._winner(sample)
            errs.append(float(np.linalg.norm(sample - self._weights[r, c])))
        return float(np.mean(errs)) if errs else 0.0

    def topological_error(self, data: np.ndarray) -> float:
        flat = self._weights.reshape(self.rows * self.cols, self.input_dim)
        bad = 0
        for sample in data:
            d = np.linalg.norm(flat - sample, axis=1)
            if d.size < 2:
                continue
            two = np.argpartition(d, 2)[:2]
            a, b = int(two[0]), int(two[1])
            ar, ac = divmod(a, self.cols)
            br, bc = divmod(b, self.cols)
            if abs(ar - br) + abs(ac - bc) > 1:
                bad += 1
        return float(bad / len(data)) if len(data) else 0.0

    def u_matrix(self) -> np.ndarray:
        umat = np.zeros((self.rows, self.cols), dtype=float)
        for r in range(self.rows):
            for c in range(self.cols):
                neighbors = []
                for dr in (-1, 0, 1):
                    for dc in (-1, 0, 1):
                        if dr == 0 and dc == 0:
                            continue
                        rr, cc = r + dr, c + dc
                        if 0 <= rr < self.rows and 0 <= cc < self.cols:
                            neighbors.append(np.linalg.norm(self._weights[r, c] - self._weights[rr, cc]))
                umat[r, c] = float(np.mean(neighbors)) if neighbors else 0.0
        return umat


def train_som(
    x_scaled: np.ndarray,
    rows: int,
    cols: int,
    iterations: int,
    random_state: int = 42,
) -> SOMResult:
    som = SimpleSOM(
        rows=rows,
        cols=cols,
        input_dim=x_scaled.shape[1],
        sigma=max(rows, cols) / 2.2,
        learning_rate=0.55,
        random_state=random_state,
    )
    som.train(x_scaled, iterations=iterations)

    bmu_row, bmu_col, bmu_index = som.map_vectors(x_scaled)
    node_hits = np.zeros((rows, cols), dtype=int)
    for r, c in zip(bmu_row, bmu_col, strict=False):
        node_hits[int(r), int(c)] += 1

    return SOMResult(
        rows=rows,
        cols=cols,
        iterations=iterations,
        quantization_error=som.quantization_error(x_scaled),
        topological_error=som.topological_error(x_scaled),
        u_matrix=som.u_matrix(),
        node_hits=node_hits,
        bmu_row=bmu_row,
        bmu_col=bmu_col,
        bmu_index=bmu_index,
        codebook_scaled=som.weights.copy(),
    )
