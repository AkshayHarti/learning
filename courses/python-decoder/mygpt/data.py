"""Training data. Zero downloads, fully deterministic.

The default corpus is a toy grammar, not Shakespeare. That is deliberate:

* a 2-layer, 64-dim model can actually fit it in ~60 seconds of CPU, so you
  see loss go down and samples become grammatical in one sitting;
* because you know the true grammar, you can tell *what the model learned*
  from *what you hoped it learned* -- which is the whole discipline of evals;
* swap in any text file with `load_text(path)` once the pipeline works.

The embedded-clause production is there so attention has something to do:
"the cat that the dog chases sees the moon" requires binding across a
recursive span. Watch the attention heatmap in week 3.
"""
from __future__ import annotations

import numpy as np

NOUN = ["cat", "dog", "fox", "owl", "mat", "bone", "moon", "tree"]
DET = ["the", "a"]
VERB = ["sees", "chases", "follows", "finds", "ignores"]
TAIL = [". ", " again. ", " at night. ", " and waits. ", " quietly. "]


def _np(rng):
    return f"{rng.choice(DET)} {rng.choice(NOUN)}"


def toy(n: int = 1200, seed: int = 0) -> str:
    """Deterministic grammatical nonsense. Same seed -> same corpus, forever."""
    rng = np.random.default_rng(seed)
    out = []
    for _ in range(n):
        subj = _np(rng)
        if rng.random() < 0.25:  # recursive relative clause
            subj = f"{subj} that {_np(rng)} {rng.choice(VERB)}"
        out.append(f"{subj} {rng.choice(VERB)} {_np(rng)}{rng.choice(TAIL)}")
    return "".join(out)


def load_text(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


def split(text: str, val_frac: float = 0.1) -> tuple[str, str]:
    cut = int(len(text) * (1 - val_frac))
    return text[:cut], text[cut:]
