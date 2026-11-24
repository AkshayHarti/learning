"""Week 3 — attention is differentiable lookup.

Two matmuls, one softmax, one division. That is the whole mechanism. Everything
that makes a transformer work is in *what the softmax is allowed to see*.
"""
from __future__ import annotations

import numpy as np


def softmax(x: np.ndarray, axis: int = -1) -> np.ndarray:
    z = x - x.max(axis=axis, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=axis, keepdims=True)


def causal_mask(T: int) -> np.ndarray:
    """True where attention is *forbidden*: the strict upper triangle."""
    return np.triu(np.ones((T, T), dtype=bool), k=1)


def scaled_dot_product_attention(q, k, v, causal: bool = True):
    """q: (T, hd) or (H, T, hd); k, v likewise. Returns (out, weights)."""
    q, k, v = (np.asarray(a, dtype=np.float64) for a in (q, k, v))
    hd = q.shape[-1]
    scores = q @ np.swapaxes(k, -1, -2) / np.sqrt(hd)
    if causal:
        T = scores.shape[-1]
        scores = np.where(causal_mask(T), -np.inf, scores)
    weights = softmax(scores, axis=-1)
    return weights @ v, weights


def split_heads(x: np.ndarray, n_head: int) -> np.ndarray:
    """(B, T, C) -> (B, H, T, C/H). Heads are a reshape, not a new concept."""
    B, T, C = x.shape
    return x.reshape(B, T, n_head, C // n_head).transpose(0, 2, 1, 3)


def merge_heads(x: np.ndarray) -> np.ndarray:
    """(B, H, T, C/H) -> (B, T, C)."""
    B, H, T, hd = x.shape
    return x.transpose(0, 2, 1, 3).reshape(B, T, H * hd)


def multi_head_attention(x, wq, wk, wv, wo, n_head: int, causal: bool = True):
    """x: (T, C) single sequence. Returns (out, weights)."""
    T, C = x.shape
    hd = C // n_head
    q = split_heads((x @ wq)[None], n_head)
    k = split_heads((x @ wk)[None], n_head)
    v = split_heads((x @ wv)[None], n_head)
    out, weights = scaled_dot_product_attention(q, k, v, causal=causal)
    return merge_heads(out)[0] @ wo, weights[0]


def attention_entropy_bits(weights: np.ndarray) -> float:
    """Mean per-row entropy, in bits. Uniform row over T -> log2(T)."""
    w = np.asarray(weights, dtype=np.float64)
    w = w / w.sum(axis=-1, keepdims=True)
    return float(-(w * np.log2(np.clip(w, 1e-12, None))).sum(axis=-1).mean())


def expand_kv_heads(k: np.ndarray, n_head: int) -> np.ndarray:
    """Repeat grouped KV heads so they can be broadcast against query heads.

    GQA: with H query heads and G KV heads, each KV head serves H/G queries.
    It works because those heads turn out to be redundant, which is also why
    caching fewer KV heads saves memory for free.
    """
    H_kv = k.shape[1]
    assert n_head % H_kv == 0, "query heads must be a multiple of kv heads"
    return np.repeat(k, n_head // H_kv, axis=1)
