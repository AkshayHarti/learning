import math

import numpy as np
import pytest

from weeks._loader import load_lab

lab = load_lab(__file__)


def test_entropy_uniform_and_certain():
    assert lab.entropy([0.5, 0.5]) == pytest.approx(1.0)
    assert lab.entropy([1 / 6] * 6) == pytest.approx(math.log2(6))
    assert lab.entropy([1.0]) == pytest.approx(0.0)
    # zeros must not poison the sum with nan
    assert lab.entropy([0.0, 1.0, 0.0]) == pytest.approx(0.0)


def test_cross_entropy_is_at_least_entropy():
    rng = np.random.default_rng(0)
    p = rng.random(5) + 1e-3
    p /= p.sum()
    q = rng.random(5) + 1e-3
    q /= q.sum()
    assert lab.cross_entropy_bits(p, q) >= lab.entropy(p) - 1e-12


def test_cross_entropy_of_truth_is_entropy():
    p = np.array([0.2, 0.3, 0.5])
    assert lab.cross_entropy_bits(p, p) == pytest.approx(lab.entropy(p))


def test_impossible_event_is_infinite():
    # The model rules out an event that actually happened: infinite bits.
    assert lab.cross_entropy_bits([0.5, 0.5], [1.0, 0.0]) == float("inf")
    # The model hedges 50/50 on something certain: 1 bit wasted, not infinite.
    assert lab.cross_entropy_bits([1.0, 0.0], [0.5, 0.5]) == pytest.approx(1.0)
    assert lab.cross_entropy_bits([1.0, 0.0], [1.0, 0.0]) == pytest.approx(0.0)


def test_kl_non_negative_and_zero_at_equality():
    rng = np.random.default_rng(1)
    p = rng.random(6) + 0.1
    p /= p.sum()
    q = rng.random(6) + 0.1
    q /= q.sum()
    assert lab.kl_bits(p, q) > 0
    assert lab.kl_bits(p, p) == pytest.approx(0.0, abs=1e-12)


def test_perplexity_from_nats():
    assert lab.perplexity_from_nats(0.0) == pytest.approx(1.0)
    assert lab.perplexity_from_nats(math.log(8)) == pytest.approx(8.0)


@pytest.fixture(scope="module")
def corpus():
    from mygpt import data

    return data.toy(400, seed=3)


def test_ngram_beats_uniform(corpus):
    lm = lab.NgramLM(n=3, k=0.5).fit(corpus)
    assert lm.perplexity(corpus) < 12.0  # a trigram on this corpus is ~4-8 ppl/ch


def test_more_context_does_not_hurt_on_train(corpus):
    p2 = lab.NgramLM(n=2, k=0.5).fit(corpus).perplexity(corpus)
    p4 = lab.NgramLM(n=4, k=0.5).fit(corpus).perplexity(corpus)
    assert p4 <= p2 + 1e-9, f"4-gram {p4:.3f} should beat bigram {p2:.3f} on train"


def test_smoothing_prevents_infinity(corpus):
    lm = lab.NgramLM(n=3, k=0.5).fit(corpus)
    assert math.isfinite(lm.perplexity("zqxjv"))  # never seen, still scored
    unsmoothed = lab.NgramLM(n=3, k=0.0).fit(corpus)
    assert unsmoothed.perplexity("zqxjv") == float("inf")


def test_bits_per_char_is_log2_ppl(corpus):
    lm = lab.NgramLM(n=3, k=0.5).fit(corpus)
    assert lm.bits_per_char(corpus) == pytest.approx(math.log2(lm.perplexity(corpus)))


def test_logprob_matches_product_of_probs(corpus):
    lm = lab.NgramLM(n=2, k=0.5).fit(corpus)
    text = corpus[:12]
    ctx, manual = ["^"], 1.0
    for ch in text:
        manual *= lm.prob(tuple(ctx[-1:]), ch)
        ctx.append(ch)
    assert np.exp(lm.logprob(text)) == pytest.approx(manual, rel=1e-9)
