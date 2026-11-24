"""Week 1 — prediction is compression.

Reference implementation. The lab version has the bodies removed; this file is
what yours should behave like. Every function here is short on purpose: the
ideas are in the maths, not the code.
"""
from __future__ import annotations

from collections import Counter, defaultdict

import numpy as np


def entropy(p) -> float:
    """Shannon entropy in bits. Zeros contribute nothing (0 log 0 = 0)."""
    p = np.asarray(p, dtype=np.float64).ravel()
    p = p[p > 0]
    return float(-(p * np.log2(p)).sum())


def cross_entropy_bits(p, q) -> float:
    """Bits per symbol when the world is p and your model is q."""
    p = np.asarray(p, dtype=np.float64).ravel()
    q = np.asarray(q, dtype=np.float64).ravel()
    if np.any((p > 0) & (q <= 0)):
        return float("inf")
    mask = p > 0
    return float(-(p[mask] * np.log2(q[mask])).sum())


def kl_bits(p, q) -> float:
    """Extra bits you pay for using q when p is true. Always >= 0."""
    return cross_entropy_bits(p, q) - entropy(p)


def perplexity_from_nats(mean_nll_nats: float) -> float:
    """Training prints natural-log loss; perplexity is exp of it."""
    return float(np.exp(mean_nll_nats))


class NgramLM:
    """Add-k smoothed character n-gram model.

    Contexts are padded with '^' so that the first characters are predictable
    too -- without that, the start of every document is infinitely surprising
    and your perplexity is fiction.
    """

    def __init__(self, n: int = 2, k: float = 0.5, vocab: str | None = None):
        assert n >= 1
        self.n, self.k = n, k
        self.vocab = sorted(set(vocab)) if vocab else []
        self.counts: dict[tuple, Counter] = defaultdict(Counter)
        self.totals: dict[tuple, int] = defaultdict(int)

    def _context(self, history: list[str]) -> tuple:
        return tuple(history[-(self.n - 1):]) if self.n > 1 else ()

    def fit(self, text: str) -> "NgramLM":
        self.vocab = sorted(set(text))
        pad = ["^"] * (self.n - 1)
        for ch in text:
            ctx = self._context(pad)
            self.counts[ctx][ch] += 1
            self.totals[ctx] += 1
            pad.append(ch)
        return self

    def prob(self, context, ch: str) -> float:
        """P(ch | context) with add-k smoothing over the whole vocab."""
        ctx = tuple(context)
        v = len(self.vocab)
        num = self.counts[ctx][ch] + self.k
        den = self.totals[ctx] + self.k * v
        if den <= 0:  # k == 0 and an unseen context: genuinely zero probability
            return 0.0
        return float(num / den)

    def logprob(self, text: str) -> float:
        """Total natural-log probability of text under the model."""
        pad = ["^"] * (self.n - 1)
        total = 0.0
        for ch in text:
            p = self.prob(self._context(pad), ch)
            if p <= 0:  # impossible under an unsmoothed model
                return float("-inf")
            total += np.log(p)
            pad.append(ch)
        return float(total)

    def perplexity(self, text: str) -> float:
        """Per-character perplexity: exp(-mean log p)."""
        if not text:
            return float("nan")
        mean_nll = -self.logprob(text) / len(text)
        if mean_nll > 700:  # exp() would overflow; infinity is the honest answer
            return float("inf")
        return float(np.exp(mean_nll))

    def bits_per_char(self, text: str) -> float:
        """Perplexity, in the units that actually matter: bits."""
        return float(np.log2(self.perplexity(text)))
