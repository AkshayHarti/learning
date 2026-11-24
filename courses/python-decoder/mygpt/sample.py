"""Decoding: how a vector of scores becomes one token.

Order matters and almost nobody gets it right the first time:
    temperature -> top_k -> min_p -> top_p -> renormalise -> sample
Shaping before filtering (or vice versa) gives visibly different text.
Week 5 asks you to prove that to yourself with a grid of outputs.
"""
from __future__ import annotations

import numpy as np

from .model import GPT


def sample_from_logits(logits, temperature: float = 1.0, top_k: int | None = None,
                       top_p: float | None = None, min_p: float | None = None,
                       rng: np.random.Generator | None = None) -> int:
    logits = np.asarray(logits, dtype=np.float64).reshape(-1)
    if temperature <= 0:  # greedy
        return int(np.argmax(logits))
    z = logits / temperature

    keep = np.ones_like(z, dtype=bool)
    if top_k and top_k > 0:
        k = min(int(top_k), z.size)
        thr = np.sort(z)[-k]
        keep &= z >= thr
    if min_p:
        p = _softmax(z)
        keep &= p >= float(min_p) * p.max()
    if top_p and top_p < 1.0:
        order = np.argsort(-z)
        p = _softmax(z[order])
        cumulative = np.cumsum(p)
        # keep the smallest set whose cumulative mass reaches top_p
        n_keep = int(np.searchsorted(cumulative, top_p) + 1)
        mask = np.zeros_like(keep)
        mask[order[:n_keep]] = True
        keep &= mask

    z = np.where(keep, z, -np.inf)
    p = _softmax(z)
    rng = rng or np.random.default_rng()
    return int(rng.choice(len(p), p=p))


def _softmax(z: np.ndarray) -> np.ndarray:
    z = z - z.max()
    e = np.exp(z)
    return e / e.sum()


def generate(model: GPT, tokenizer, prompt: str, max_new_tokens: int = 200,
             seed: int = 0, **sampler) -> str:
    rng = np.random.default_rng(seed)
    ids = tokenizer.encode(prompt) or [0]
    block = model.config["block_size"]
    for _ in range(max_new_tokens):
        ctx = np.array([ids[-block:]])
        logits = model.logits_np(ctx)[0, -1]
        ids.append(sample_from_logits(logits, rng=rng, **sampler))
    return tokenizer.decode(ids)
