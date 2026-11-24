import numpy as np
import pytest

from mygpt import GPT, CharTokenizer, data, generate, sample_from_logits
from mygpt.sample import _softmax

LOGITS = np.array([3.0, 2.0, 1.0, 0.0])


def test_greedy_is_deterministic():
    assert {sample_from_logits(LOGITS, temperature=0.0) for _ in range(20)} == {0}


def test_top_k_restricts_support():
    rng = np.random.default_rng(0)
    draws = {sample_from_logits(LOGITS, temperature=1.0, top_k=2, rng=rng) for _ in range(200)}
    assert draws <= {0, 1}


def test_top_k_larger_than_vocab_is_safe():
    assert sample_from_logits(LOGITS, top_k=99, rng=np.random.default_rng(0)) in range(4)


def test_top_p_keeps_minimal_set():
    # p=0.5 on logits [3,2,1,0]: softmax is ~[0.64,0.24,0.09,0.03] -> top token only
    probs = _softmax(LOGITS)
    assert top_set(probs, 0.5) == 0


def top_set(probs, p):
    order = np.argsort(-probs)
    cumulative = np.cumsum(probs[order])
    n = int(np.searchsorted(cumulative, p) + 1)
    return n - 1


def test_min_p_behaves_like_a_relative_cut():
    probs = _softmax(LOGITS)
    kept = np.flatnonzero(probs >= 0.3 * probs.max())
    assert kept.tolist() == [0, 1]


def test_reproducible_with_seed():
    a = sample_from_logits(LOGITS, 0.9, top_p=0.95, rng=np.random.default_rng(11))
    b = sample_from_logits(LOGITS, 0.9, top_p=0.95, rng=np.random.default_rng(11))
    assert a == b


def test_generate_returns_prompt_plus_continuation():
    text = data.toy(200, seed=0)
    tok = CharTokenizer(text)
    model = GPT(tok.vocab_size, n_layer=1, n_head=2, n_embd=16, block_size=32, seed=0)
    out = generate(model, tok, "the cat ", max_new_tokens=20, seed=0, temperature=0.8)
    assert out.startswith("the cat ")
    assert len(out) > len("the cat ")
