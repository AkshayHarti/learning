"""Week 5 — decoding, and what "thinking longer" actually buys.

The distribution is fixed; every knob here only decides how to *pick* from it.
That framing makes temperature, top-k, top-p and min-p one idea with four
different ways to say "how much of the tail do I keep", and it makes reasoning
models legible: they are not picking more carefully, they are spending more
tokens before picking at all.
"""
from __future__ import annotations

import numpy as np


def softmax(z, axis=-1):
    z = np.asarray(z, dtype=np.float64)
    z = z - z.max(axis=axis, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=axis, keepdims=True)


def temperature_softmax(logits, temperature: float = 1.0):
    """temperature -> 0 is greedy (limit); 1 is the model; >1 flattens."""
    logits = np.asarray(logits, dtype=np.float64).ravel()
    if temperature <= 0:
        p = np.zeros_like(logits)
        p[int(np.argmax(logits))] = 1.0
        return p
    return softmax(logits / temperature)


def top_k_mask(logits, k: int) -> np.ndarray:
    """True for the k highest logits. Ties break by index, deterministically."""
    logits = np.asarray(logits, dtype=np.float64).ravel()
    k = max(1, min(int(k), logits.size))
    order = np.argsort(-logits, kind="stable")
    mask = np.zeros(logits.size, dtype=bool)
    mask[order[:k]] = True
    return mask


def top_p_mask(probs, p: float) -> np.ndarray:
    """Nucleus: keep the smallest set whose cumulative probability reaches p."""
    probs = np.asarray(probs, dtype=np.float64).ravel()
    order = np.argsort(-probs, kind="stable")
    cumulative = np.cumsum(probs[order])
    n = int(np.searchsorted(cumulative, p) + 1)
    mask = np.zeros(probs.size, dtype=bool)
    mask[order[:n]] = True
    return mask


def min_p_mask(probs, min_p: float) -> np.ndarray:
    """Keep tokens with p >= min_p * max(p). Scale-free tail cut."""
    probs = np.asarray(probs, dtype=np.float64).ravel()
    return probs >= float(min_p) * probs.max()


def sample(logits, temperature: float = 1.0, top_k: int | None = None,
           top_p: float | None = None, min_p: float | None = None,
           rng: np.random.Generator | None = None) -> int:
    """Order: temperature -> top_k -> min_p -> top_p -> renormalise -> draw."""
    rng = rng or np.random.default_rng()
    logits = np.asarray(logits, dtype=np.float64).ravel()
    if temperature <= 0:
        return int(np.argmax(logits))
    z = logits / temperature
    probs = softmax(z)
    keep = np.ones(z.size, dtype=bool)
    if top_k:
        keep &= top_k_mask(z, top_k)
    if min_p:
        keep &= min_p_mask(probs, min_p)
    if top_p and top_p < 1.0:
        keep &= top_p_mask(np.where(keep, probs, 0.0), top_p)
    p = np.where(keep, probs, 0.0)
    p = p / p.sum()
    return int(rng.choice(p.size, p=p))


def majority_vote(answers: list[str]) -> tuple[str, float]:
    """Self-consistency: sample N, keep the mode. Returns (answer, share)."""
    if not answers:
        raise ValueError("no answers")
    counts: dict[str, int] = {}
    for a in answers:
        counts[a] = counts.get(a, 0) + 1
    best = max(counts.items(), key=lambda kv: (kv[1], kv[0]))[0]
    return best, counts[best] / len(answers)


def test_time_compute_tradeoff(acc_at_budget: dict[int, float]) -> dict:
    """Marginal accuracy per extra sample. Diminishing returns, quantified.

    acc_at_budget maps "samples spent" -> measured accuracy.
    """
    budgets = sorted(acc_at_budget)
    rows = []
    for a, b in zip(budgets, budgets[1:]):
        da = acc_at_budget[b] - acc_at_budget[a]
        cost = b - a
        rows.append({
            "from": a, "to": b,
            "delta_acc": da,
            "per_sample": da / cost,
            "relative_cost": b / a,
        })
    return {"rows": rows, "best_relative": max(rows, key=lambda r: r["per_sample"])["to"] if rows else budgets[0]}
