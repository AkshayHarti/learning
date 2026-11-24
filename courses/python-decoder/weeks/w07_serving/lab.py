"""Week 7 lab. Fill in the bodies.

The cache test is the whole week: `step_cached` must produce the same logits as
recomputing the full prefix, to 1e-9, for every position. If it does, you have
implemented the single most important optimisation in LLM serving.
"""
from __future__ import annotations

import numpy as np

from mygpt.infer import _gelu, _ln, _softmax


def kv_bytes(n_layer: int, n_kv_head: int, head_dim: int, seq_len: int,
             bytes_per_elem: int = 2) -> int:
    """2 (K and V) * layers * kv_heads * head_dim * seq_len * bytes_per_elem."""
    raise NotImplementedError("week 7: kv_bytes")


def decode_flops(n_layer: int, n_embd: int, seq_len: int, n_new: int,
                 cached: bool = True) -> int:
    """Rough FLOPs. Cached grows with seq_len*n_new; uncached with (seq_len+n_new)^2."""
    raise NotImplementedError("week 7: decode_flops")


def padding_waste(seq_lens, block: int = 1) -> dict:
    """{'useful', 'padded', 'utilisation'} for static batching."""
    raise NotImplementedError("week 7: padding_waste")


def step_cached(w: dict, token: int, pos: int, cache: dict, cfg: dict):
    """One token, one step. Returns logits (V,).

    cache[layer]['k'] and ['v'] are (H, pos, hd). Append the new key/value, then
    attend over the whole cached history. There is no mask: everything cached is
    in the past by construction.
    """
    raise NotImplementedError("week 7: step_cached")


def spec_expected_tokens(alpha: float, n_draft: int) -> float:
    """Expected tokens accepted per verification step, plus one bonus token."""
    raise NotImplementedError("week 7: spec_expected_tokens")


def tokens_per_second(n_tokens: int, seconds: float) -> float:
    raise NotImplementedError("week 7: tokens_per_second")


def cost_per_million(input_tokens: int, output_tokens: int,
                     input_price: float, output_price: float) -> float:
    """USD for that token mix at per-million prices."""
    raise NotImplementedError("week 7: cost_per_million")
