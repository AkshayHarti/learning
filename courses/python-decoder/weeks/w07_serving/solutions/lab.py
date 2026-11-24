"""Week 7 — serving: the KV cache, batching, and what you actually pay for.

Training is throughput-bound on big matmuls. Inference is *memory*-bound, and
almost every serving optimisation is a consequence of one fact: without a cache,
generating token `n` recomputes the whole prefix.
"""
from __future__ import annotations

import numpy as np

from mygpt.infer import _gelu, _ln, _softmax


def kv_bytes(n_layer: int, n_kv_head: int, head_dim: int, seq_len: int,
             bytes_per_elem: int = 2) -> int:
    """Bytes held by the KV cache for ONE sequence. K and V, every layer.

    bytes_per_elem=2 is fp16/bf16, 1 is fp8. This number is why GQA exists:
    fewer KV heads means a linearly smaller cache for the same quality.
    """
    return int(2 * n_layer * n_kv_head * head_dim * seq_len * bytes_per_elem)


def decode_flops(n_layer: int, n_embd: int, seq_len: int, n_new: int,
                 cached: bool = True) -> int:
    """Rough forward FLOPs for generating n_new tokens. Attention dominates.

    Un-cached: for each new token, attention over the whole prefix -> O(T^2)
    Cached:    each step attends over T once            -> O(T)
    """
    # 4 matmuls of size T*C plus scores of size T*T per head-set, per layer.
    if cached:
        return int(n_layer * n_new * (4 * seq_len * n_embd * n_embd // 1024
                                      + 2 * seq_len * n_embd))
    return int(n_layer * sum(4 * (seq_len + i) * n_embd * n_embd // 1024
                             + 2 * (seq_len + i) ** 2 * n_embd
                             for i in range(n_new)))


def padding_waste(seq_lens, block: int = 1) -> dict:
    """Static batching pads every sequence to the longest in the batch.

    Returns useful/padded token counts and utilisation. Continuous batching is
    the fix: admit and retire sequences per step instead of per batch.
    """
    lens = [int(x) for x in seq_lens]
    if not lens:
        return {"useful": 0, "padded": 0, "utilisation": 0.0}
    longest = max(lens)
    padded = sum(-(-l // block) * block for l in [longest] * len(lens))
    useful = sum(lens)
    return {"useful": useful, "padded": padded, "utilisation": useful / padded}


def step_cached(w: dict, token: int, pos: int, cache: dict, cfg: dict):
    """One forward step for one token, reusing the KV cache.

    cache[layer]['k'|'v']: (H, pos, hd) arrays, appended in place.
    Returns logits (V,).
    """
    C, H = cfg["n_embd"], cfg["n_head"]
    hd = C // H
    x = w["wte"][token] + w["wpe"][pos]
    for i in range(cfg["n_layer"]):
        p = f"l{i}."
        h = _ln(x, w[p + "ln1_g"], w[p + "ln1_b"])
        q = (h @ w[p + "wq"] + w[p + "bq"]).reshape(H, hd)
        k_new = (h @ w[p + "wk"] + w[p + "bk"]).reshape(H, 1, hd)
        v_new = (h @ w[p + "wv"] + w[p + "bv"]).reshape(H, 1, hd)

        entry = cache.setdefault(i, {"k": np.zeros((H, 0, hd)), "v": np.zeros((H, 0, hd))})
        entry["k"] = np.concatenate([entry["k"], k_new], axis=1)
        entry["v"] = np.concatenate([entry["v"], v_new], axis=1)
        k_all, v_all = entry["k"], entry["v"]

        att = _softmax((q[:, None, :] @ k_all.transpose(0, 2, 1)) / np.sqrt(hd))
        y = (att @ v_all).reshape(C)
        x = x + (y @ w[p + "wo"] + w[p + "bo"])
        h2 = _ln(x, w[p + "ln2_g"], w[p + "ln2_b"])
        x = x + (_gelu(h2 @ w[p + "w1"] + w[p + "b1"]) @ w[p + "w2"] + w[p + "b2"])
    x = _ln(x, w["lnf_g"], w["lnf_b"])
    return x @ w["wte"].T


def spec_expected_tokens(alpha: float, n_draft: int) -> float:
    """Expected tokens per verification step with acceptance rate alpha.

    Draft n tokens, accept the longest correct prefix, then take one bonus token
    from the target model. Expected accepted = sum_{k=1..n} alpha^k, plus 1.
    """
    a = float(np.clip(alpha, 0.0, 1.0))
    if a >= 1.0:
        return float(n_draft + 1)
    return float(sum(a ** k for k in range(1, n_draft + 1)) + 1.0)


def tokens_per_second(n_tokens: int, seconds: float) -> float:
    return float(n_tokens / seconds) if seconds > 0 else float("inf")


def cost_per_million(input_tokens: int, output_tokens: int,
                     input_price: float, output_price: float) -> float:
    """USD for a million-token mix at the given per-million prices.

    Output is 3-5x input at most providers because decode is memory-bound and
    cannot be batched as effectively as prefill. That price ratio is an
    engineering fact, not marketing.
    """
    return (input_tokens / 1e6) * input_price + (output_tokens / 1e6) * output_price
