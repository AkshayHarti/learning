"""Inference without the autograd graph, and without a cache.

This is the honest naive implementation: to produce token T+1, recompute the
whole prefix. It is O(T^2) work per token and it is what week 7 fixes.

Week 7's lab adds the KV cache and measures the speedup. Having this file
complete is the point -- you need something correct to compare against.
"""
from __future__ import annotations

import numpy as np

from .model import GPT
from .sample import sample_from_logits


def weights_np(model: GPT) -> dict[str, np.ndarray]:
    return {k: v.data.copy() for k, v in model.params.items()}


def _ln(x, g, b, eps=1e-5):
    mu = x.mean(-1, keepdims=True)
    var = x.var(-1, keepdims=True)
    return (x - mu) / np.sqrt(var + eps) * g + b


def _gelu(x):
    c = np.sqrt(2.0 / np.pi)
    return 0.5 * x * (1 + np.tanh(c * (x + 0.044715 * x ** 3)))


def _softmax(x, axis=-1):
    z = x - x.max(axis=axis, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=axis, keepdims=True)


def forward_np(w: dict[str, np.ndarray], ids, cfg: dict | None = None) -> np.ndarray:
    """Full-sequence forward. ids: (T,) or (B, T). Returns logits (..., V)."""
    ids = np.asarray(ids, dtype=np.int64)
    squeeze = ids.ndim == 1
    if squeeze:
        ids = ids[None, :]
    B, T = ids.shape
    C = w["wte"].shape[1]
    H = int(cfg["n_head"]) if cfg else 4
    hd = C // H

    x = w["wte"][ids] + w["wpe"][:T]
    causal = np.triu(np.ones((T, T), dtype=bool), k=1)

    n_layer = int(cfg["n_layer"]) if cfg else 2
    for i in range(n_layer):
        k = f"l{i}."
        h = _ln(x, w[k + "ln1_g"], w[k + "ln1_b"])
        q = (h @ w[k + "wq"] + w[k + "bq"]).reshape(B, T, H, hd).transpose(0, 2, 1, 3)
        kk = (h @ w[k + "wk"] + w[k + "bk"]).reshape(B, T, H, hd).transpose(0, 2, 1, 3)
        v = (h @ w[k + "wv"] + w[k + "bv"]).reshape(B, T, H, hd).transpose(0, 2, 1, 3)
        att = (q @ kk.transpose(0, 1, 3, 2)) / np.sqrt(hd)
        att = np.where(causal, -1e9, att)
        y = (_softmax(att) @ v).transpose(0, 2, 1, 3).reshape(B, T, C)
        x = x + (y @ w[k + "wo"] + w[k + "bo"])
        h2 = _ln(x, w[k + "ln2_g"], w[k + "ln2_b"])
        x = x + (_gelu(h2 @ w[k + "w1"] + w[k + "b1"]) @ w[k + "w2"] + w[k + "b2"])

    x = _ln(x, w["lnf_g"], w["lnf_b"])
    logits = x @ w["wte"].T
    return logits[0] if squeeze else logits


def generate_slow(w, tokenizer, prompt: str, n: int = 100, seed: int = 0,
                  block: int = 64, **sampler) -> str:
    """Naive decode: recompute the prefix for every new token."""
    rng = np.random.default_rng(seed)
    ids = tokenizer.encode(prompt) or [0]
    for _ in range(n):
        logits = forward_np(w, np.array(ids[-block:]))[-1]
        ids.append(sample_from_logits(logits, rng=rng, **sampler))
    return tokenizer.decode(ids)
