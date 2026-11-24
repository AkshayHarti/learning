"""Week 8: `uv run python -m weeks.w08_evals.report`

An eval card for the model you trained in week 4. Small, honest, with intervals.
The point is not the numbers; it is that every number has an interval, a sample
size, and a stated blind spot.
"""
from __future__ import annotations

import numpy as np

from mygpt import data, generate
from weeks._loader import load_lab
from weeks._model import tiny

lab = load_lab(__file__)
N_ITEMS = 40
SAMPLES = 5
LOOKAHEAD = 4


def build_items(tok, n=N_ITEMS, seed=7):
    """(prompt, true continuation) pairs from held-out grammar strings."""
    text = data.toy(200, seed=99)  # different seed -> unseen sentences
    sentences = [s for s in text.split(". ") if len(s) > 12]
    rng = np.random.default_rng(seed)
    items = []
    for s in rng.choice(sentences, size=min(n, len(sentences)), replace=False):
        cut = len(s) // 2
        items.append((s[:cut], s[cut:cut + LOOKAHEAD]))
    return items


def evaluate(model, tok, items, temperature, samples=SAMPLES):
    hits = []          # per item: how many of `samples` matched
    for prompt, truth in items:
        c = sum(
            generate(model, tok, prompt, max_new_tokens=LOOKAHEAD, seed=i,
                     temperature=temperature, top_k=40)[len(prompt):] == truth
            for i in range(samples)
        )
        hits.append(c)
    return np.array(hits)


def summarise(name, hits, samples=SAMPLES) -> dict:
    n = len(hits)
    acc = hits.sum() / (n * samples)                       # per-sample accuracy
    lo, hi = lab.bootstrap_ci((hits / samples), seed=0)    # item-level mean
    p_at = np.mean([lab.pass_at_k(samples, int(c), samples) for c in hits])
    p_hat = np.mean([lab.pass_hat_k(samples, int(c), samples) for c in hits])
    print(f"{name}")
    print(f"  n items            : {n}   (samples/item: {samples})")
    print(f"  per-sample accuracy: {acc:.3f}   item-mean 95% CI [{lo:.3f}, {hi:.3f}]")
    print(f"  pass@{samples} (capability) : {p_at:.3f}")
    print(f"  pass^{samples} (reliability): {p_hat:.3f}")
    print(f"  CI half-width      : ±{(hi - lo) / 2:.3f}  -> cannot resolve smaller"
          f" than ~{int(np.ceil(1 / max(1e-9, (hi - lo))))} items-worth of change")
    return {"acc": acc, "ci": (lo, hi), "pass_at": p_at, "pass_hat": p_hat}


def main() -> None:
    model, tok = tiny()
    items = build_items(tok)
    train_text, _ = data.split(data.toy(1200, seed=0))

    print(f"model: {model.num_params():,} params, char-level, "
          f"{model.config['n_layer']} layers\n")

    base = summarise("greedy (T=0)", evaluate(model, tok, items, 0.0))
    hot = summarise("\nsampled (T=1.2)", evaluate(model, tok, items, 1.2))

    print("\ncontamination (13-gram overlap between train and eval prompts): "
          f"{lab.ngram_contamination([train_text], ' '.join(p for p, _ in items), n=13):.3f}")
    print("note: a grammar generator reuses phrases, so this is not zero. That is")
    print("the honest answer, and it bounds how seriously you read the numbers above.")

    gate = lab.regression_gate(
        (evaluate(model, tok, items, 0.0) / SAMPLES),
        (evaluate(model, tok, items, 1.2) / SAMPLES),
    )
    print(f"\nregression gate greedy -> sampled: delta {gate['delta']:+.3f} "
          f"CI [{gate['ci'][0]:+.3f}, {gate['ci'][1]:+.3f}] -> {gate['decision']}")
    print("\nRead the last line again. That is what a deploy decision looks like")
    print("when the interval is wider than the effect.")


if __name__ == "__main__":
    main()
