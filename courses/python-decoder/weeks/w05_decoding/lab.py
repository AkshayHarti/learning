"""Week 5 lab. Fill in the bodies.

One rule for this week: decide the *order* of your filters and never change it
silently. The tests encode `temperature -> top_k -> min_p -> top_p`.
"""
from __future__ import annotations

import numpy as np


def softmax(z, axis=-1):
    raise NotImplementedError("week 5: softmax")


def temperature_softmax(logits, temperature: float = 1.0):
    """Return a probability vector. temperature <= 0 means greedy (one-hot)."""
    raise NotImplementedError("week 5: temperature_softmax")


def top_k_mask(logits, k: int) -> np.ndarray:
    """Boolean mask, True = keep the k highest logits."""
    raise NotImplementedError("week 5: top_k_mask")


def top_p_mask(probs, p: float) -> np.ndarray:
    """Nucleus mask: smallest set of tokens whose cumulative mass reaches p."""
    raise NotImplementedError("week 5: top_p_mask")


def min_p_mask(probs, min_p: float) -> np.ndarray:
    """Keep p >= min_p * max(p)."""
    raise NotImplementedError("week 5: min_p_mask")


def sample(logits, temperature: float = 1.0, top_k: int | None = None,
           top_p: float | None = None, min_p: float | None = None,
           rng: np.random.Generator | None = None) -> int:
    """Sample one token id using the documented filter order."""
    raise NotImplementedError("week 5: sample")


def majority_vote(answers: list[str]) -> tuple[str, float]:
    """Self-consistency. Return (most common answer, its share of votes)."""
    raise NotImplementedError("week 5: majority_vote")


def test_time_compute_tradeoff(acc_at_budget: dict[int, float]) -> dict:
    """Marginal accuracy per extra sample. See the docstring in solutions."""
    raise NotImplementedError("week 5: test_time_compute_tradeoff")
