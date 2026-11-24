"""Week 3: `uv run python -m weeks.w03_attention.heatmap "the cat that ..."`.

Prints per-head attention weights for a real trained model, as ASCII heatmaps,
plus the entropy of each head. Entropy is how you tell a working head from a
saturated one without staring at 8x8 numbers.
"""
from __future__ import annotations

import sys

import numpy as np

from mygpt.infer import _ln, _softmax
from weeks._model import tiny


def attention_maps(weights: dict, cfg: dict, ids: np.ndarray):
    """Recompute attention weights layer by layer, returning [(layer, weights)]."""
    T = len(ids)
    C, H = cfg["n_embd"], cfg["n_head"]
    hd = C // H
    x = weights["wte"][ids] + weights["wpe"][:T]
    causal = np.triu(np.ones((T, T), dtype=bool), k=1)
    maps = []
    for i in range(cfg["n_layer"]):
        k = f"l{i}."
        h = _ln(x, weights[k + "ln1_g"], weights[k + "ln1_b"])
        q = (h @ weights[k + "wq"]).reshape(T, H, hd).transpose(1, 0, 2)
        kk = (h @ weights[k + "wk"]).reshape(T, H, hd).transpose(1, 0, 2)
        v = (h @ weights[k + "wv"]).reshape(T, H, hd).transpose(1, 0, 2)
        att = _softmax(np.where(causal, -1e9, q @ kk.transpose(0, 2, 1) / np.sqrt(hd)))
        maps.append(att)
        y = (att @ v).transpose(1, 0, 2).reshape(T, C)
        x = x + y @ weights[k + "wo"]
        h2 = _ln(x, weights[k + "ln2_g"], weights[k + "ln2_b"])
        x = x + np.maximum(h2 @ weights[k + "w1"], 0) @ weights[k + "w2"]
    return maps


def show(prompt: str) -> None:
    model, tok = tiny()
    ids = np.array(tok.encode(prompt))
    chars = [c if c != " " else "_" for c in tok.decode(ids)]
    cfg = model.config
    w = {k: v.data for k, v in model.params.items()}
    print(f"prompt: {prompt!r}  ({len(ids)} tokens)\n")
    print("query -> " + " ".join(f"{c:<2}" for c in chars))
    for layer, att in enumerate(attention_maps(w, cfg, ids)):
        for head in range(att.shape[0]):
            a = att[head]
            ent = float(-(a * np.log2(np.clip(a, 1e-12, None))).sum(-1).mean())
            print(f"\nL{layer}H{head}  mean entropy {ent:.2f} bits "
                  f"(max {np.log2(len(ids)):.2f})")
            for i, row in enumerate(a):
                cells = " ".join(f"{v * 9.99:>4.1f}" for v in row[: i + 1])
                print(f"  {chars[i]:<2} | {cells}")
    print("\nRead the last row: it is the only one that sees the whole prompt.")
    print("A head that puts ~all its weight on one token has entropy near 0.")


if __name__ == "__main__":
    show(sys.argv[1] if len(sys.argv) > 1
         else "the cat that the dog chases sees the moon")
