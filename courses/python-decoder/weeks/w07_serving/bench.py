"""Week 7: `uv run python -m weeks.w07_serving.bench`

Naive recompute vs KV-cached decode, same model, same greedy tokens. Prints
tokens/sec and the speedup, then the cache sizes that decide your GPU budget.
"""
from __future__ import annotations

import time

import numpy as np

from mygpt.infer import forward_np, weights_np
from weeks._loader import load_lab
from weeks._model import tiny

lab = load_lab(__file__)
N_NEW = 48


def run_naive(w, cfg, ids, n):
    out = []
    for _ in range(n):
        logits = forward_np(w, np.array(ids), cfg)[-1]
        tok = int(np.argmax(logits))
        ids.append(tok)
        out.append(tok)
    return out


def run_cached(w, cfg, ids, n):
    cache, out = {}, []
    for pos, token in enumerate(ids):
        logits = lab.step_cached(w, token, pos, cache, cfg)
    for i in range(n):
        tok = int(np.argmax(logits))
        ids.append(tok)
        out.append(tok)
        logits = lab.step_cached(w, tok, len(ids) - 1, cache, cfg)
    return out


def main() -> None:
    model, tok = tiny()
    w, cfg = weights_np(model), model.config
    prompt = tok.encode("the cat that the")
    assert len(prompt) + N_NEW <= cfg["block_size"], "prompt too long for the toy model"

    naive_ids, cached_ids = list(prompt), list(prompt)
    t0 = time.perf_counter()
    a = run_naive(w, cfg, naive_ids, N_NEW)
    t_naive = time.perf_counter() - t0
    t0 = time.perf_counter()
    b = run_cached(w, cfg, cached_ids, N_NEW)
    t_cached = time.perf_counter() - t0

    print(f"model: {model.num_params():,} params, {N_NEW} new tokens\n")
    print(f"naive recompute : {N_NEW / t_naive:8.1f} tok/s   ({t_naive * 1000:.0f} ms)")
    print(f"kv-cached       : {N_NEW / t_cached:8.1f} tok/s   ({t_cached * 1000:.0f} ms)")
    print(f"speedup         : {t_naive / t_cached:8.2f}x")
    print(f"identical output: {a == b}\n")

    print("What this costs at scale (fp16):")
    for name, (L, H_kv, hd) in {
        "7B  (32L, 32 kv-heads, d128)": (32, 32, 128),
        "7B  (GQA 8 kv-heads)": (32, 8, 128),
        "70B (80L, GQA 8 kv-heads)": (80, 8, 128),
    }.items():
        for ctx in (8192, 131072):
            gb = lab.kv_bytes(L, H_kv, hd, ctx) / 1e9
            print(f"  {name:<30} ctx {ctx:>7,}: {gb:7.2f} GB / sequence")
    print("\nNow multiply by your concurrency target. That is the whole story of")
    print("paged attention, GQA, and why long context is a memory product.")


if __name__ == "__main__":
    main()
