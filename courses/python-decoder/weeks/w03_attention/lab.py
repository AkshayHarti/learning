"""Week 3 lab. Fill in the bodies.

Do the hand calculation in the README before you touch this file. If you write
the code first you will pattern-match a shape and learn nothing.
"""
from __future__ import annotations

import numpy as np


def softmax(x: np.ndarray, axis: int = -1) -> np.ndarray:
    """Stable softmax: subtract the max first, or you will overflow in float32.

    Rows must sum to 1 along `axis`.
    """
    raise NotImplementedError("week 3: softmax")


def causal_mask(T: int) -> np.ndarray:
    """(T, T) bool, True where attention is forbidden (strict upper triangle)."""
    raise NotImplementedError("week 3: causal_mask")


def scaled_dot_product_attention(q, k, v, causal: bool = True):
    """Return (output, weights), weights shape (..., T_q, T_k).

    steps: scores = q @ k.T ; / sqrt(hd) ; mask with -inf ; softmax ; @ v
    """
    raise NotImplementedError("week 3: scaled_dot_product_attention")


def split_heads(x: np.ndarray, n_head: int) -> np.ndarray:
    """(B, T, C) -> (B, H, T, C/H)."""
    raise NotImplementedError("week 3: split_heads")


def merge_heads(x: np.ndarray) -> np.ndarray:
    """(B, H, T, C/H) -> (B, T, C). Must be the exact inverse of split_heads."""
    raise NotImplementedError("week 3: merge_heads")


def multi_head_attention(x, wq, wk, wv, wo, n_head: int, causal: bool = True):
    """x: (T, C). Project, split, attend, merge, project. Returns (out, weights)."""
    raise NotImplementedError("week 3: multi_head_attention")


def attention_entropy_bits(weights: np.ndarray) -> float:
    """Mean per-row entropy in bits. Flat attention -> log2(T). Focused -> ~0."""
    raise NotImplementedError("week 3: attention_entropy_bits")


def expand_kv_heads(k: np.ndarray, n_head: int) -> np.ndarray:
    """(B, G, T, hd) -> (B, H, T, hd) by repeating each KV head H/G times."""
    raise NotImplementedError("week 3: expand_kv_heads")
