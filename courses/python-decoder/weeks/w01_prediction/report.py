"""Week 1 reality check: `uv run python -m weeks.w01_prediction.report`

Prints bits-per-character for uniform, bigram, trigram and 4-gram models on
held-out text. Numbers, not vibes.
"""
from __future__ import annotations

import pathlib

import numpy as np

from mygpt import data
from weeks._loader import load_module


def main() -> None:
    lab = load_module(pathlib.Path(__file__).parent / "lab.py", "w01_report")
    train_text, val_text = data.split(data.toy(1200, seed=0))
    uniform = np.log2(len(set(val_text)))
    print(f"corpus: {len(train_text)} train chars, {len(val_text)} val chars, "
          f"{len(set(train_text))} symbols")
    print(f"{'model':<10} {'bits/char':>10} {'ppl/char':>10}")
    print(f"{'uniform':<10} {uniform:>10.3f} {2 ** uniform:>10.2f}")
    for n in (2, 3, 4, 5):
        lm = lab.NgramLM(n=n, k=0.5).fit(train_text)
        bpc = lab.NgramLM.bits_per_char(lm, val_text)
        print(f"{n}-gram{'':<4} {bpc:>10.3f} {2 ** bpc:>10.2f}")
    print("\nExpect: uniform ~4.7, bigram ~3.3, trigram ~2.6, 4-gram ~2.4.")
    print("If the 5-gram is worse than the 4-gram, that is not a bug -- "
          "that is sparsity plus a fixed smoothing constant. Week 1's lesson.")


if __name__ == "__main__":
    main()
