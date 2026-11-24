"""Week 1 lab. Fill in the bodies; the tests in test_lab.py define "done".

Rule of the course: read the failing test before you read the hint. The test is
the specification. Hints are in the docstring if you are stuck for more than
ten minutes -- not sooner.
"""
from __future__ import annotations

from collections import Counter, defaultdict

import numpy as np


def entropy(p) -> float:
    """Shannon entropy in bits.

    H = -Σ p log2 p, over entries where p > 0.

    Hint: np.asarray(p, float).ravel(), then mask. Watch for 0 * log2(0) = nan.
    """
    raise NotImplementedError("week 1: entropy")


def cross_entropy_bits(p, q) -> float:
    """Bits per symbol when the world is p and your model is q.

    Return float('inf') if p > 0 anywhere q <= 0 -- an impossible event,
    confidently ruled out, costs infinite bits. That is not a bug in the maths.
    """
    raise NotImplementedError("week 1: cross_entropy_bits")


def kl_bits(p, q) -> float:
    """Extra bits paid for modelling p with q. H(p, q) - H(p)."""
    raise NotImplementedError("week 1: kl_bits")


def perplexity_from_nats(mean_nll_nats: float) -> float:
    """Training prints natural-log loss. Perplexity is exp(loss)."""
    raise NotImplementedError("week 1: perplexity_from_nats")


class NgramLM:
    """Add-k smoothed character n-gram model.

    Contexts are padded with '^' (n-1 times) so the first characters are
    modelled too. Without padding, every document start is maximally
    surprising and your perplexity is fiction.
    """

    def __init__(self, n: int = 2, k: float = 0.5, vocab: str | None = None):
        self.n, self.k = n, k
        self.vocab = sorted(set(vocab)) if vocab else []
        self.counts: dict[tuple, Counter] = defaultdict(Counter)
        self.totals: dict[tuple, int] = defaultdict(int)

    def _context(self, history: list[str]) -> tuple:
        """The last n-1 characters of history (empty tuple when n == 1)."""
        raise NotImplementedError("week 1: NgramLM._context")

    def fit(self, text: str) -> "NgramLM":
        """Count every (context -> next char). Sets self.vocab from the text."""
        raise NotImplementedError("week 1: NgramLM.fit")

    def prob(self, context, ch: str) -> float:
        """P(ch | context) with add-k smoothing over the whole vocabulary.

        (count + k) / (total + k * |V|)
        """
        raise NotImplementedError("week 1: NgramLM.prob")

    def logprob(self, text: str) -> float:
        """Total natural-log probability of text."""
        raise NotImplementedError("week 1: NgramLM.logprob")

    def perplexity(self, text: str) -> float:
        """exp(-mean log p). Per character, not per token. Say so out loud."""
        raise NotImplementedError("week 1: NgramLM.perplexity")

    def bits_per_char(self, text: str) -> float:
        """log2(perplexity). Tokenizer-independent, comparable across models."""
        raise NotImplementedError("week 1: NgramLM.bits_per_char")
