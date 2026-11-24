import math

import numpy as np
import pytest

from weeks._loader import load_lab

lab = load_lab(__file__)


def test_sft_loss_is_mean_nll():
    assert lab.sft_loss([-1.0, -3.0]) == pytest.approx(2.0)
    assert lab.sft_loss([0.0]) == pytest.approx(0.0)


def test_sequence_logprob_ignores_prompt():
    lp = [-0.5, -1.0, -2.0, -4.0]
    assert lab.sequence_logprob(lp, prompt_len=2) == pytest.approx(-6.0)
    assert lab.sequence_logprob(lp, prompt_len=len(lp)) == pytest.approx(0.0)


def test_dpo_loss_at_reference_is_log_two():
    # Policy == reference: the margin is zero, so the loss is -log sigmoid(0).
    assert lab.dpo_loss(-1.0, -2.0, -1.0, -2.0) == pytest.approx(math.log(2))


def test_dpo_loss_decreases_when_policy_prefers_chosen():
    weak = lab.dpo_loss(-1.0, -2.0, -1.0, -1.0)
    strong = lab.dpo_loss(-0.5, -3.0, -1.0, -1.0)
    assert strong < weak < math.log(2)


def test_dpo_is_monotone_in_margin():
    losses = [lab.dpo_loss(-1.0, -2.0, -1.0, -2.0, beta=b) for b in (0.01, 0.1, 1.0)]
    assert losses[0] == pytest.approx(math.log(2))
    assert losses[0] >= losses[1] >= losses[2]


def test_dpo_stable_for_large_margins():
    # Without a numerically stable log-sigmoid this returns inf or nan.
    assert lab.dpo_loss(0.0, -5000.0, 0.0, 0.0) == pytest.approx(0.0, abs=1e-12)
    assert math.isfinite(lab.dpo_loss(0.0, 5000.0, 0.0, 0.0))


def test_grpo_standardises():
    a = lab.grpo_advantage([1.0, 2.0, 3.0])
    assert a.mean() == pytest.approx(0.0)
    assert a.std() == pytest.approx(1.0)


def test_grpo_zero_variance_is_safe():
    a = lab.grpo_advantage([0.7, 0.7, 0.7])
    assert np.all(a == 0.0) and np.isfinite(a).all()


def test_lora_arithmetic():
    n = lab.lora_param_count(4096, 16, n_layers=32, targets=2)
    assert n == 32 * 2 * 2 * 4096 * 16
    ratio = lab.lora_ratio(4096, 16, 32, 2)
    assert 0.005 < ratio < 0.01, ratio


def test_power_law_recovers_known_exponent():
    xs = np.array([1e18, 1e19, 1e20, 1e21])
    ys = 3.2 * xs ** -0.07
    fit = lab.fit_power_law(xs, ys)
    assert fit["b"] == pytest.approx(-0.07, abs=1e-6)
    assert fit["a"] == pytest.approx(3.2, rel=1e-6)
    assert fit["r2"] == pytest.approx(1.0, abs=1e-9)
    assert fit["predict"](1e21) == pytest.approx(ys[-1], rel=1e-6)


def test_power_law_r2_catches_bad_fit():
    xs = np.arange(1, 40, dtype=float)
    ys = np.log(xs) + 1.0
    assert lab.fit_power_law(xs, ys)["r2"] < 0.99
