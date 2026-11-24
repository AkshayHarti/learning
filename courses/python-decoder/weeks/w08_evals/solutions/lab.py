"""Week 8 — measurement: evals, judges, and traces.

This is the week that decides whether the previous seven were worth anything.
A model you cannot measure is a rumour. Everything here is deliberately
arithmetic: estimators, intervals, agreement statistics. No framework will save
you from a metric that cannot distinguish signal from noise.
"""
from __future__ import annotations

import math

import numpy as np


def pass_at_k(n: int, c: int, k: int) -> float:
    """P(at least one success in k samples), unbiased, sampling without replacement.

    1 - C(n-c, k) / C(n, k). This is what "pass@k" means for code benchmarks.
    """
    if n <= 0 or k <= 0:
        raise ValueError("n and k must be positive")
    if k > n:
        raise ValueError("k cannot exceed n")
    if n - c < k:
        return 1.0
    return float(1.0 - math.comb(n - c, k) / math.comb(n, k))


def pass_hat_k(n: int, c: int, k: int) -> float:
    """P(all k samples succeed). The reliability metric, not the capability one.

    pass@k says "it can do it"; pass^k says "it does it every time". For agents,
    the second number is the one your users experience.
    """
    if k > n:
        raise ValueError("k cannot exceed n")
    out = 1.0
    for i in range(k):
        out *= (c - i) / (n - i)
    return float(max(0.0, out))


def bootstrap_ci(values, n_boot: int = 2000, alpha: float = 0.05, seed: int = 0):
    """Percentile bootstrap CI. Works for any statistic, assumes almost nothing."""
    x = np.asarray(values, dtype=np.float64).ravel()
    if x.size == 0:
        raise ValueError("empty sample")
    rng = np.random.default_rng(seed)
    means = np.array([rng.choice(x, size=x.size, replace=True).mean()
                      for _ in range(n_boot)])
    lo, hi = np.quantile(means, [alpha / 2, 1 - alpha / 2])
    return float(lo), float(hi)


def cohen_kappa(a, b, labels=None) -> float:
    """Chance-corrected agreement. 1 = perfect, 0 = chance, <0 = worse than chance.

    Use this instead of raw accuracy whenever one label dominates. A judge that
    says "pass" to everything gets 90% accuracy and kappa 0.
    """
    a = list(a)
    b = list(b)
    if len(a) != len(b) or not a:
        raise ValueError("label lists must be non-empty and equal length")
    if labels is None:
        labels = sorted(set(a) | set(b))
    idx = {lab: i for i, lab in enumerate(labels)}
    k = len(labels)
    m = np.zeros((k, k), dtype=np.float64)
    for x, y in zip(a, b):
        m[idx[x], idx[y]] += 1
    n = m.sum()
    po = np.trace(m) / n
    pe = float((m.sum(axis=0) * m.sum(axis=1)).sum() / (n * n))
    if abs(1.0 - pe) < 1e-12:
        return 1.0 if po == 1.0 else 0.0
    return float((po - pe) / (1.0 - pe))


def pearson(a, b) -> float:
    x = np.asarray(a, dtype=np.float64).ravel()
    y = np.asarray(b, dtype=np.float64).ravel()
    if x.size != y.size or x.size < 2:
        raise ValueError("need equal-length samples of size >= 2")
    if x.std() == 0 or y.std() == 0:
        return 0.0
    return float(np.corrcoef(x, y)[0, 1])


def judge_report(judge, human) -> dict:
    """Calibrate an LLM judge against human labels before you trust it.

    kappa is the headline; correlation is secondary (it only works if the judge
    emits scores, not labels).
    """
    j, h = list(judge), list(human)
    kappa = cohen_kappa(j, h)
    numeric = all(isinstance(v, (int, float)) for v in j + h)
    rho = pearson(j, h) if numeric else None
    if kappa >= 0.6:
        verdict = "usable"
    elif kappa >= 0.4:
        verdict = "calibrate: rewrite rubric, add anchors, then re-check"
    else:
        verdict = "do not use: you are measuring the judge, not the model"
    return {"n": len(j), "kappa": kappa, "pearson": rho, "verdict": verdict}


def ngram_contamination(train_texts, test_text: str, n: int = 13) -> float:
    """Fraction of the test text's n-grams that appear anywhere in train.

    Near 1.0 means your benchmark is memorised. Report it or your numbers lie.
    """
    def grams(t: str) -> set[str]:
        t = " ".join(t.split()).lower()
        return {t[i:i + n] for i in range(max(0, len(t) - n + 1))}

    test = grams(test_text)
    if not test:
        return 0.0
    train: set[str] = set()
    for t in train_texts:
        train |= grams(t)
    return float(len(test & train) / len(test))


def sample_size(p: float, halfwidth: float, z: float = 1.96) -> int:
    """Tokens/items needed for a CI of width 2*halfwidth on a pass rate p."""
    if not 0 < p < 1:
        raise ValueError("p must be in (0, 1)")
    return int(math.ceil(p * (1 - p) * (z / halfwidth) ** 2))


def regression_gate(baseline, candidate, alpha: float = 0.05, seed: int = 0) -> dict:
    """Ship / hold / block, with an interval on the delta instead of a vibe."""
    base = np.asarray(baseline, dtype=np.float64).ravel()
    cand = np.asarray(candidate, dtype=np.float64).ravel()
    rng = np.random.default_rng(seed)
    deltas = np.array([
        rng.choice(cand, cand.size, replace=True).mean()
        - rng.choice(base, base.size, replace=True).mean()
        for _ in range(2000)
    ])
    lo, hi = np.quantile(deltas, [alpha / 2, 1 - alpha / 2])
    if hi < 0:
        decision = "block"
    elif lo > 0:
        decision = "ship"
    else:
        decision = "hold: underpowered, collect more items"
    return {"delta": float(cand.mean() - base.mean()),
            "ci": (float(lo), float(hi)), "decision": decision}
