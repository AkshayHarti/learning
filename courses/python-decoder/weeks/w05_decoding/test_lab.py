import numpy as np
import pytest

from weeks._loader import load_lab

lab = load_lab(__file__)

LOGITS = np.array([4.1, 3.8, 2.9, 2.7, 2.1, 1.9, 1.2, 0.8, 0.1, -0.4, -1.1])
P5 = np.array([0.45, 0.30, 0.15, 0.07, 0.03])


def test_temperature_zero_is_greedy():
    p = lab.temperature_softmax(LOGITS, 0.0)
    assert p[0] == 1.0 and p.sum() == pytest.approx(1.0)


def test_temperature_one_recovers_model_distribution():
    p = lab.temperature_softmax(LOGITS, 1.0)
    e = np.exp(LOGITS - LOGITS.max())
    assert np.allclose(p, e / e.sum())


def test_high_temperature_flattens():
    hot = lab.temperature_softmax(LOGITS, 5.0)
    cold = lab.temperature_softmax(LOGITS, 0.5)
    assert hot.max() < cold.max()
    # and the entropy ordering must hold strictly
    h = lambda p: -(p * np.log(p + 1e-12)).sum()
    assert h(hot) > h(cold)


def test_top_k_keeps_exactly_k():
    m = lab.top_k_mask(LOGITS, 3)
    assert m.sum() == 3
    assert m[0] and m[1] and m[2]


def test_top_k_larger_than_vocab_is_clamped():
    assert lab.top_k_mask(LOGITS, 999).sum() == LOGITS.size


def test_top_p_worked_example():
    # README: [0.45,0.30,0.15,0.07,0.03] with p=0.9 keeps exactly 3 tokens.
    m = lab.top_p_mask(P5, 0.9)
    assert m.sum() == 3
    assert np.allclose(m, [True, True, True, False, False])


def test_top_p_of_one_keeps_everything_with_positive_mass():
    assert lab.top_p_mask(P5, 1.0).all()


def test_min_p_relative_threshold():
    m = lab.min_p_mask(P5, 0.2)   # 0.2 * 0.45 = 0.09 -> keeps 0.45, 0.30, 0.15
    assert np.allclose(m, [True, True, True, False, False])
    assert lab.min_p_mask(P5, 0.0).all()


def test_sample_is_reproducible_with_seed():
    a = lab.sample(LOGITS, 0.8, top_p=0.9, rng=np.random.default_rng(7))
    b = lab.sample(LOGITS, 0.8, top_p=0.9, rng=np.random.default_rng(7))
    assert a == b


def test_sample_greedy_ignores_filters():
    assert lab.sample(LOGITS, 0.0, top_k=1) == int(np.argmax(LOGITS))


def test_sample_never_returns_filtered_out_token():
    rng = np.random.default_rng(0)
    draws = {lab.sample(LOGITS, 1.0, top_k=3, rng=rng) for _ in range(500)}
    assert draws <= {0, 1, 2}


def test_sample_matches_distribution_roughly():
    rng = np.random.default_rng(0)
    draws = np.array([lab.sample(P5, 0.0) if False else
                      lab.sample(np.log(P5), 1.0, rng=rng) for _ in range(20_000)])
    freq = np.bincount(draws, minlength=len(P5)) / draws.size
    assert np.allclose(freq, P5, atol=0.02)


def test_majority_vote():
    ans, share = lab.majority_vote(["a", "b", "a", "a"])
    assert ans == "a" and share == pytest.approx(0.75)


def test_test_time_compute_tradeoff():
    out = lab.test_time_compute_tradeoff({1: 0.40, 8: 0.52, 64: 0.55})
    rows = out["rows"]
    assert rows[0]["delta_acc"] == pytest.approx(0.12)
    assert rows[0]["per_sample"] > rows[1]["per_sample"]  # diminishing returns
    assert out["best_relative"] == 8
