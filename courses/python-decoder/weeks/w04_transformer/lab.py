"""Week 4 lab. Fill in the bodies.

The reference model is `mygpt.model.GPT`. Your job is to arrive at the same
numbers by hand, then keep the model you train.
"""
from __future__ import annotations

import numpy as np

from mygpt import GPT, data, train
from mygpt.tokenizer import CharTokenizer


def layernorm_forward(x, g, b, eps: float = 1e-5):
    """Normalise over the last axis, then scale and shift.

    (x - mean) / sqrt(var + eps) * g + b
    Note: population variance (ddof=0), not sample variance.
    """
    raise NotImplementedError("week 4: layernorm_forward")


def gelu(x):
    """0.5 * x * (1 + tanh(sqrt(2/pi) * (x + 0.044715 x^3)))"""
    raise NotImplementedError("week 4: gelu")


def softmax(x, axis=-1):
    raise NotImplementedError("week 4: softmax")


def causal_attention(x, p, prefix: str, n_head: int, causal: bool = True):
    """x: (T, C). p: dict of numpy params. Returns (T, C).

    Order: ln1 -> q,k,v -> reshape to heads (T,H,hd) -> scale -> mask -> softmax
    -> values -> merge -> wo + bo.
    """
    raise NotImplementedError("week 4: causal_attention")


def mlp(x, p, prefix: str):
    """ln2 -> w1 -> gelu -> w2."""
    raise NotImplementedError("week 4: mlp")


def block_forward(x, p, prefix: str, n_head: int, causal: bool = True):
    """Two residual additions, attention first, then MLP."""
    raise NotImplementedError("week 4: block_forward")


def param_count(vocab: int, n_layer: int, n_embd: int, block_size: int) -> int:
    """Closed form. Per layer: 12C^2 + 13C. Embeddings: (vocab + block) * C.
    Final layernorm: 2C. Must equal GPT(...).num_params() exactly.
    """
    raise NotImplementedError("week 4: param_count")


def train_tiny(steps: int = 600, seed: int = 0, quiet: bool = False):
    """Train the toy model. Return (model, tokenizer, loss_history)."""
    raise NotImplementedError("week 4: train_tiny")
