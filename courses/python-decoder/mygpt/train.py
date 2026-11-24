"""Training loop: Adam, warmup + cosine decay, a loss you can actually watch.

Nothing here is exotic. That is the lesson: the difference between a toy
trainer and a frontier trainer is data, scale, and a hundred engineering
details -- not a different algorithm.
"""
from __future__ import annotations

import numpy as np

from .model import GPT


class Adam:
    def __init__(self, params: dict[str, "Tensor"], lr=3e-3, betas=(0.9, 0.99),
                 eps=1e-8, weight_decay=0.0):
        self.params = params
        self.lr, self.b1, self.b2, self.eps, self.wd = lr, betas[0], betas[1], eps, weight_decay
        self.m = {k: np.zeros_like(p.data) for k, p in params.items()}
        self.v = {k: np.zeros_like(p.data) for k, p in params.items()}
        self.t = 0

    def step(self, lr: float | None = None):
        lr = self.lr if lr is None else lr
        self.t += 1
        c1, c2 = 1 - self.b1 ** self.t, 1 - self.b2 ** self.t
        for k, p in self.params.items():
            if p.grad is None:
                continue
            g = p.grad + self.wd * p.data
            self.m[k] = self.b1 * self.m[k] + (1 - self.b1) * g
            self.v[k] = self.b2 * self.v[k] + (1 - self.b2) * g * g
            p.data -= lr * (self.m[k] / c1) / (np.sqrt(self.v[k] / c2) + self.eps)


def get_batch(data: np.ndarray, block_size: int, batch_size: int, rng):
    ix = rng.integers(0, len(data) - block_size - 1, size=batch_size)
    x = np.stack([data[i:i + block_size] for i in ix])
    y = np.stack([data[i + 1:i + 1 + block_size] for i in ix])
    return x, y


def lr_at(step: int, total: int, peak: float, warmup: int = 50) -> float:
    if step < warmup:
        return peak * (step + 1) / warmup
    p = (step - warmup) / max(1, total - warmup)
    return peak * (0.1 + 0.9 * 0.5 * (1 + np.cos(np.pi * p)))


def train(model: GPT, data: np.ndarray, steps: int = 600, batch_size: int = 16,
          block_size: int = 48, lr: float = 3e-3, warmup: int = 50,
          seed: int = 0, log_every: int = 100, quiet: bool = False):
    """Returns the loss history. Deterministic for a fixed seed."""
    rng = np.random.default_rng(seed)
    opt = Adam(model.params)
    hist = []
    for step in range(steps):
        x, y = get_batch(data, block_size, batch_size, rng)
        _, loss = model(x, y)
        model.zero_grad()
        loss.backward()
        opt.step(lr_at(step, steps, lr, warmup))
        hist.append(float(loss.data))
        if not quiet and (step % log_every == 0 or step == steps - 1):
            print(f"step {step:5d}  loss {hist[-1]:.4f}  "
                  f"ppl {np.exp(hist[-1]):7.1f}  lr {lr_at(step, steps, lr, warmup):.5f}")
    return hist


@staticmethod
def _noop():  # pragma: no cover
    pass
