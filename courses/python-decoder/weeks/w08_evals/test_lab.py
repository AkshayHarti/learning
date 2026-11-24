import math

import numpy as np
import pytest

from weeks._loader import load_lab

lab = load_lab(__file__)


def test_pass_at_k_known_values():
    assert lab.pass_at_k(10, 1, 1) == pytest.approx(0.1)
    assert lab.pass_at_k(10, 1, 10) == pytest.approx(1.0)
    assert lab.pass_at_k(10, 10, 5) == pytest.approx(1.0)
    # c=2, n=4, k=2 -> 1 - C(2,2)/C(4,2) = 1 - 1/6
    assert lab.pass_at_k(4, 2, 2) == pytest.approx(5 / 6)


def test_pass_at_k_monotone_in_k():
    vals = [lab.pass_at_k(20, 3, k) for k in range(1, 11)]
    assert all(b >= a for a, b in zip(vals, vals[1:]))


def test_pass_hat_k_known_values():
    assert lab.pass_hat_k(5, 3, 1) == pytest.approx(0.6)
    assert lab.pass_hat_k(5, 3, 2) == pytest.approx(0.3)
    assert lab.pass_hat_k(5, 5, 5) == pytest.approx(1.0)
    assert lab.pass_hat_k(5, 3, 4) == pytest.approx(0.0)


def test_pass_at_k_beats_pass_hat_k_when_flaky():
    # capability vs reliability: the same model looks great on one metric.
    assert lab.pass_at_k(10, 6, 5) > 0.99
    assert lab.pass_hat_k(10, 6, 5) < 0.1


def test_bootstrap_ci_contains_mean_and_narrows():
    rng = np.random.default_rng(0)
    small = rng.normal(0.7, 0.1, 30)
    big = rng.normal(0.7, 0.1, 3000)
    lo_s, hi_s = lab.bootstrap_ci(small, seed=1)
    lo_b, hi_b = lab.bootstrap_ci(big, seed=1)
    assert lo_s <= small.mean() <= hi_s
    assert (hi_b - lo_b) < (hi_s - lo_s)


def test_bootstrap_is_deterministic_with_seed():
    x = np.linspace(0, 1, 50)
    assert lab.bootstrap_ci(x, seed=3) == lab.bootstrap_ci(x, seed=3)


def test_kappa_perfect_and_chance():
    assert lab.cohen_kappa(["a", "b", "c"], ["a", "b", "c"]) == pytest.approx(1.0)
    # a judge that always says "pass" while humans are split: no information
    human = ["pass"] * 50 + ["fail"] * 50
    judge = ["pass"] * 100
    assert lab.cohen_kappa(judge, human) == pytest.approx(0.0, abs=1e-9)


def test_kappa_beats_accuracy_on_imbalanced_labels():
    human = ["pass"] * 90 + ["fail"] * 10
    judge = ["pass"] * 100  # 90% accurate, zero information
    accuracy = 0.9
    assert accuracy > lab.cohen_kappa(judge, human) + 0.5


def test_pearson_limits():
    x = np.arange(10, dtype=float)
    assert lab.pearson(x, 2 * x + 1) == pytest.approx(1.0)
    assert lab.pearson(x, -x) == pytest.approx(-1.0)
    assert lab.pearson(x, np.ones_like(x)) == pytest.approx(0.0)


def test_judge_report_routes_on_kappa():
    human = ["pass", "fail"] * 40
    good = lab.judge_report(human, human)
    assert good["verdict"] == "usable" and good["n"] == 80
    blind = lab.judge_report(["pass"] * 80, human)
    assert blind["verdict"].startswith("do not use")


def test_contamination_exact_copy_and_disjoint():
    text = "the quick brown fox jumps over the lazy dog again and again"
    assert lab.ngram_contamination([text], text, n=8) == pytest.approx(1.0)
    assert lab.ngram_contamination(["completely different corpus here"], text, n=8) == 0.0


def test_sample_size_arithmetic():
    n = lab.sample_size(0.5, 0.05)
    assert n == pytest.approx(math.ceil(0.25 * (1.96 / 0.05) ** 2))
    assert lab.sample_size(0.95, 0.02) < lab.sample_size(0.5, 0.02)


def test_regression_gate_decisions():
    rng = np.random.default_rng(0)
    base = rng.normal(0.80, 0.02, 300)
    assert lab.regression_gate(base, base + 0.05)["decision"] == "ship"
    assert lab.regression_gate(base, base - 0.08)["decision"] == "block"
    assert lab.regression_gate(base, base)["decision"].startswith("hold")
