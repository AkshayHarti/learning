"""Week 6 — post-training: SFT, preferences, verifiable rewards, LoRA, scaling.

Pretraining teaches a model to continue text. Post-training teaches it to be
useful, and then to be *right*. Those are three different objectives and the
field has re-litigated which one matters roughly every 18 months since 2022.
"""
from __future__ import annotations

import numpy as np


def sft_loss(logp_target: np.ndarray) -> float:
    """Mean NLL over target tokens. SFT is next-token prediction on curated data."""
    logp = np.asarray(logp_target, dtype=np.float64).ravel()
    return float(-logp.mean())


def sequence_logprob(logprobs, prompt_len: int) -> float:
    """Sum of log-probs over the completion only.

    Convention: `logprobs[t]` is the log-prob the model assigned to the token at
    position t+1, given everything before it. So the prompt is context (not
    scored) and the completion is `logprobs[prompt_len:]`.
    """
    lp = np.asarray(logprobs, dtype=np.float64).ravel()
    return float(lp[prompt_len:].sum())


def dpo_loss(logp_pol_chosen: float, logp_pol_rejected: float,
             logp_ref_chosen: float, logp_ref_rejected: float,
             beta: float = 0.1) -> float:
    """Direct Preference Optimisation.

    -log sigmoid( beta * [ (log pi(y_w) - log ref(y_w))
                         - (log pi(y_l) - log ref(y_l)) ] )

    Read the inner term as: "how much more did I move toward the chosen answer
    than toward the rejected one, relative to where I started".
    """
    margin = beta * ((logp_pol_chosen - logp_ref_chosen)
                     - (logp_pol_rejected - logp_ref_rejected))
    # -log sigmoid(m) == log(1 + exp(-m)); use logaddexp or large margins blow up.
    return float(np.logaddexp(0.0, -margin))


def grpo_advantage(rewards) -> np.ndarray:
    """Group-relative advantages: standardise rewards within a sampled group.

    No value network, no critic -- the group *is* the baseline. That single
    simplification is why RLVR became cheap enough to run at scale.
    """
    r = np.asarray(rewards, dtype=np.float64).ravel()
    sd = r.std()
    if sd < 1e-12:  # every sample scored the same: no signal, no advantage
        return np.zeros_like(r)
    return (r - r.mean()) / sd


def lora_param_count(d_model: int, d_rank: int, n_layers: int = 1,
                     targets: int = 2) -> int:
    """LoRA adds A (d x r) and B (r x d) per targeted matrix. No biases."""
    return int(n_layers * targets * (d_model * d_rank + d_rank * d_model))


def lora_ratio(d_model: int, d_rank: int, n_layers: int = 1, targets: int = 2) -> float:
    """Fraction of the original targeted weights that LoRA actually trains."""
    full = n_layers * targets * d_model * d_model
    return lora_param_count(d_model, d_rank, n_layers, targets) / full


def fit_power_law(xs, ys) -> dict:
    """Fit y = a * x^b by least squares in log-log space.

    This is what "scaling law" means operationally: a straight line on a log-log
    plot. If your fit is not straight, you are in a different regime, not a
    different law.
    """
    x = np.log(np.asarray(xs, dtype=np.float64).ravel())
    y = np.log(np.asarray(ys, dtype=np.float64).ravel())
    A = np.stack([x, np.ones_like(x)], axis=1)
    (b, log_a), *_ = np.linalg.lstsq(A, y, rcond=None)
    pred = np.exp(log_a) * np.asarray(xs, dtype=np.float64) ** b
    resid = np.asarray(ys, dtype=np.float64) - pred
    ss_res = float((resid ** 2).sum())
    ss_tot = float(((ys - np.mean(ys)) ** 2).sum())
    return {
        "a": float(np.exp(log_a)),
        "b": float(b),
        "r2": 1.0 - ss_res / ss_tot if ss_tot > 0 else 1.0,
        "predict": lambda x_new: float(np.exp(log_a) * np.asarray(x_new) ** b),
    }
