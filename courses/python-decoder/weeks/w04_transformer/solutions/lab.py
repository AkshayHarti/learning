"""Week 4 — one block, then a stack, then a trained model.

You have already written the autograd engine (mygpt/tensor.py) and checked it
against finite differences. What is left is assembling the block correctly and
proving your assembly is numerically identical to the reference.
"""
from __future__ import annotations

import numpy as np

from mygpt import GPT, data, train
from mygpt.tokenizer import CharTokenizer


def layernorm_forward(x, g, b, eps: float = 1e-5):
    mu = x.mean(-1, keepdims=True)
    var = x.var(-1, keepdims=True)
    return (x - mu) / np.sqrt(var + eps) * g + b


def gelu(x):
    c = np.sqrt(2.0 / np.pi)
    return 0.5 * x * (1 + np.tanh(c * (x + 0.044715 * x ** 3)))


def softmax(x, axis=-1):
    z = x - x.max(axis=axis, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=axis, keepdims=True)


def causal_attention(x, p, prefix: str, n_head: int, causal: bool = True):
    """x: (T, C) -> (T, C). p is a dict of numpy arrays."""
    T, C = x.shape
    H = n_head
    hd = C // H
    h = layernorm_forward(x, p[prefix + "ln1_g"], p[prefix + "ln1_b"])
    q = (h @ p[prefix + "wq"] + p[prefix + "bq"]).reshape(T, H, hd).transpose(1, 0, 2)
    k = (h @ p[prefix + "wk"] + p[prefix + "bk"]).reshape(T, H, hd).transpose(1, 0, 2)
    v = (h @ p[prefix + "wv"] + p[prefix + "bv"]).reshape(T, H, hd).transpose(1, 0, 2)
    scores = q @ k.transpose(0, 2, 1) / np.sqrt(hd)
    if causal:
        mask = np.triu(np.ones((T, T), dtype=bool), k=1)
        scores = np.where(mask, -1e9, scores)
    y = (softmax(scores) @ v).transpose(1, 0, 2).reshape(T, C)
    return y @ p[prefix + "wo"] + p[prefix + "bo"]


def mlp(x, p, prefix: str):
    h = layernorm_forward(x, p[prefix + "ln2_g"], p[prefix + "ln2_b"])
    h = gelu(h @ p[prefix + "w1"] + p[prefix + "b1"])
    return h @ p[prefix + "w2"] + p[prefix + "b2"]


def block_forward(x, p, prefix: str, n_head: int, causal: bool = True):
    x = x + causal_attention(x, p, prefix, n_head, causal)
    return x + mlp(x, p, prefix)


def param_count(vocab: int, n_layer: int, n_embd: int, block_size: int) -> int:
    """Closed-form parameter count. Being able to do this in your head is a
    real interview skill and a real budget skill."""
    C = n_embd
    attn = 4 * (C * C + C)        # wq,wk,wv,wo and their biases
    mlp = 8 * C * C + 5 * C       # w1(4C*C)+b1(4C), w2(4C*C)+b2(C)
    norms = 4 * C                 # ln1 and ln2, each with gamma + beta
    return (vocab * C + block_size * C + 2 * C   # embeddings + final ln
            + n_layer * (attn + mlp + norms))


def train_tiny(steps: int = 600, seed: int = 0, quiet: bool = False):
    text = data.toy(1200, seed=0)
    tok = CharTokenizer(text)
    ids = np.array(tok.encode(text))
    model = GPT(tok.vocab_size, n_layer=2, n_head=4, n_embd=64,
                block_size=64, seed=seed)
    hist = train(model, ids, steps=steps, batch_size=24, block_size=64,
                 lr=3e-3, quiet=quiet)
    return model, tok, hist
