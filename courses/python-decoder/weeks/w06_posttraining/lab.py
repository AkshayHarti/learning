"""Week 6 lab. Fill in the bodies.

This week is arithmetic plus one formula. The formula is DPO; get the signs right
and the rest is bookkeeping.
"""
from __future__ import annotations

import numpy as np


def sft_loss(logp_target: np.ndarray) -> float:
    """Mean negative log-likelihood over the target tokens."""
    raise NotImplementedError("week 6: sft_loss")


def sequence_logprob(logprobs, prompt_len: int) -> float:
    """Sum log-probs for the completion only (indices prompt_len..end)."""
    raise NotImplementedError("week 6: sequence_logprob")


def dpo_loss(logp_pol_chosen: float, logp_pol_rejected: float,
             logp_ref_chosen: float, logp_ref_rejected: float,
             beta: float = 0.1) -> float:
    """-log sigmoid(beta * ((pol_w - ref_w) - (pol_l - ref_l)))."""
    raise NotImplementedError("week 6: dpo_loss")


def grpo_advantage(rewards) -> np.ndarray:
    """(r - mean) / std, with std==0 handled (return zeros, never nan)."""
    raise NotImplementedError("week 6: grpo_advantage")


def lora_param_count(d_model: int, d_rank: int, n_layers: int = 1,
                     targets: int = 2) -> int:
    """n_layers * targets * (2 * d_model * d_rank)."""
    raise NotImplementedError("week 6: lora_param_count")


def lora_ratio(d_model: int, d_rank: int, n_layers: int = 1, targets: int = 2) -> float:
    """trainable / full parameters for the targeted matrices."""
    raise NotImplementedError("week 6: lora_ratio")


def fit_power_law(xs, ys) -> dict:
    """Least squares on (log x, log y). Return a, b, r2, predict(callable)."""
    raise NotImplementedError("week 6: fit_power_law")
