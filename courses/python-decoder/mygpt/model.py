"""A GPT. Small enough to read, real enough to train.

Everything here is written against `mygpt.tensor`, so the backward pass is
the one you wrote in week 4 -- not a library call. The architecture is
deliberately the 2019-2026 default: pre-LN causal transformer, GELU MLP,
learned positional embeddings, tied input/output embeddings.

Not included on purpose: RMSNorm, RoPE, GQA, MoE, sliding windows. Those are
week 3/4 stretch exercises -- they are small edits to this file, and you
should make them rather than read about them.
"""
from __future__ import annotations

import numpy as np

from .tensor import Tensor, cross_entropy, gelu, layernorm, softmax


class GPT:
    def __init__(
        self,
        vocab_size: int,
        n_layer: int = 2,
        n_head: int = 4,
        n_embd: int = 64,
        block_size: int = 64,
        seed: int = 0,
    ):
        assert n_embd % n_head == 0, "n_embd must be divisible by n_head"
        self.config = dict(
            vocab_size=vocab_size,
            n_layer=n_layer,
            n_head=n_head,
            n_embd=n_embd,
            block_size=block_size,
        )
        rng = np.random.default_rng(seed)
        std = 0.02
        proj_std = std / np.sqrt(2 * n_layer)  # GPT-2 residual scaling

        def p(*shape, scale=std):
            return Tensor(rng.normal(0.0, scale, shape), requires_grad=True)

        self.params: dict[str, Tensor] = {
            "wte": p(vocab_size, n_embd),
            "wpe": p(block_size, n_embd),
            "lnf_g": Tensor(np.ones(n_embd), requires_grad=True),
            "lnf_b": Tensor(np.zeros(n_embd), requires_grad=True),
        }
        for i in range(n_layer):
            k = f"l{i}."
            self.params.update({
                k + "ln1_g": Tensor(np.ones(n_embd), requires_grad=True),
                k + "ln1_b": Tensor(np.zeros(n_embd), requires_grad=True),
                k + "wq": p(n_embd, n_embd), k + "bq": Tensor(np.zeros(n_embd), requires_grad=True),
                k + "wk": p(n_embd, n_embd), k + "bk": Tensor(np.zeros(n_embd), requires_grad=True),
                k + "wv": p(n_embd, n_embd), k + "bv": Tensor(np.zeros(n_embd), requires_grad=True),
                k + "wo": p(n_embd, n_embd, scale=proj_std), k + "bo": Tensor(np.zeros(n_embd), requires_grad=True),
                k + "ln2_g": Tensor(np.ones(n_embd), requires_grad=True),
                k + "ln2_b": Tensor(np.zeros(n_embd), requires_grad=True),
                k + "w1": p(n_embd, 4 * n_embd), k + "b1": Tensor(np.zeros(4 * n_embd), requires_grad=True),
                k + "w2": p(4 * n_embd, n_embd, scale=proj_std), k + "b2": Tensor(np.zeros(n_embd), requires_grad=True),
            })

    # ---- helpers -------------------------------------------------------
    def _ln(self, x: Tensor, name: str) -> Tensor:
        return layernorm(x) * self.params[name + "_g"] + self.params[name + "_b"]

    def num_params(self) -> int:
        return int(sum(p.data.size for p in self.params.values()))

    def zero_grad(self) -> None:
        for p in self.params.values():
            p.zero_grad()

    def save(self, path: str) -> None:
        np.savez(path, config=np.array([self.config]), **{
            k: v.data for k, v in self.params.items()
        })

    @classmethod
    def load(cls, path: str, **overrides) -> "GPT":
        z = np.load(path, allow_pickle=True)
        cfg = dict(z["config"].item())
        cfg.update(overrides)
        m = cls(**cfg)
        for k in m.params:
            m.params[k].data = z[k].astype(np.float64)
        return m

    # ---- forward -------------------------------------------------------
    def forward(self, idx: np.ndarray, targets: np.ndarray | None = None):
        """idx: (B, T) int64 token ids. Returns (logits, loss)."""
        idx = np.asarray(idx, dtype=np.int64)
        B, T = idx.shape
        assert T <= self.config["block_size"], f"sequence length {T} > block_size"

        C, H = self.config["n_embd"], self.config["n_head"]
        hd = C // H
        x = self.params["wte"].take(idx) + self.params["wpe"].take(np.arange(T))
        causal = np.triu(np.ones((T, T), dtype=bool), k=1)

        for i in range(self.config["n_layer"]):
            k = f"l{i}."
            # --- attention: 4 reshapes, 2 matmuls, 1 softmax ---
            h = self._ln(x, k + "ln1")
            q = (h @ self.params[k + "wq"] + self.params[k + "bq"]).reshape(B, T, H, hd).transpose(0, 2, 1, 3)
            kk = (h @ self.params[k + "wk"] + self.params[k + "bk"]).reshape(B, T, H, hd).transpose(0, 2, 1, 3)
            v = (h @ self.params[k + "wv"] + self.params[k + "bv"]).reshape(B, T, H, hd).transpose(0, 2, 1, 3)
            att = (q @ kk.transpose(0, 1, 3, 2)) * (hd ** -0.5)
            att = softmax(att.masked_fill(causal, -1e9), axis=-1)
            y = (att @ v).transpose(0, 2, 1, 3).reshape(B, T, C)
            x = x + (y @ self.params[k + "wo"] + self.params[k + "bo"])
            # --- MLP: expand, gate, project ---
            h2 = self._ln(x, k + "ln2")
            h2 = gelu(h2 @ self.params[k + "w1"] + self.params[k + "b1"])
            x = x + (h2 @ self.params[k + "w2"] + self.params[k + "b2"])

        x = self._ln(x, "lnf")
        logits = x @ self.params["wte"].transpose()  # weight tying
        loss = None
        if targets is not None:
            loss = cross_entropy(logits.reshape(B * T, -1), np.asarray(targets).reshape(-1))
        return logits, loss

    __call__ = forward

    # ---- inference (no graph) -----------------------------------------
    def logits_np(self, idx: np.ndarray) -> np.ndarray:
        from .tensor import no_grad

        with no_grad():
            return self.forward(idx)[0].data
