"""One shared tiny model for the whole course.

Week 4 teaches you to train it. Weeks 3 and 5-8 *use* it. Keeping a single
checkpoint on disk is not laziness -- it is what makes the course coherent:
the thing you serve in week 7 is the thing you trained in week 4, evaluated in
week 8. Real engineering has the same property and it is why your evals and your
serving stack must agree about preprocessing.
"""
from __future__ import annotations

import pathlib

import numpy as np

from mygpt import GPT, CharTokenizer, data, train

CACHE = pathlib.Path(".cache")
CKPT = CACHE / "tiny.npz"


def tiny(steps: int = 1200, force: bool = False, quiet: bool = True):
    """Return (model, tokenizer). Trains ~35s the first time, then loads."""
    if CKPT.exists() and not force:
        z = np.load(CKPT, allow_pickle=True)
        tok = CharTokenizer(str(z["chars"]))
        cfg = dict(z["config"].item())
        model = GPT(**cfg)
        for k in model.params:
            model.params[k].data = z[k].astype(np.float64)
        return model, tok

    text = data.toy(1200, seed=0)
    tok = CharTokenizer(text)
    model = GPT(tok.vocab_size, n_layer=2, n_head=4, n_embd=64,
                block_size=64, seed=0)
    train(model, np.array(tok.encode(text)), steps=steps, batch_size=24,
          block_size=64, lr=3e-3, quiet=quiet)
    CACHE.mkdir(exist_ok=True)
    np.savez(CKPT, config=np.array([model.config]), chars=np.array(tok.chars),
             **{k: v.data for k, v in model.params.items()})
    return model, tok
