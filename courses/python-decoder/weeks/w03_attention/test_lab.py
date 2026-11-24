import numpy as np
import pytest

from weeks._loader import load_lab

lab = load_lab(__file__)


def reference_attention(q, k, v, causal):
    """Deliberately naive: one loop per query position. This is the truth."""
    T, hd = q.shape
    out = np.zeros_like(v)
    weights = np.zeros((T, T))
    scale = 1.0 / np.sqrt(hd)
    for i in range(T):
        scores = np.array([
            (q[i] @ k[j]) * scale if (not causal or j <= i) else -np.inf
            for j in range(T)
        ])
        m = scores - scores.max()
        w = np.exp(m) / np.exp(m).sum()
        weights[i] = w
        out[i] = sum(w[j] * v[j] for j in range(T))
    return out, weights


def test_softmax_rows_sum_to_one():
    x = np.random.default_rng(0).normal(0, 3, (4, 7))
    p = lab.softmax(x)
    assert p.shape == x.shape
    assert np.allclose(p.sum(axis=1), 1.0)
    assert (p >= 0).all()


def test_softmax_survives_huge_logits():
    x = np.array([[1000.0, 1001.0, -1000.0]])
    p = lab.softmax(x)
    assert np.isfinite(p).all()
    assert p.sum() == pytest.approx(1.0)


def test_causal_mask_shape_and_orientation():
    m = lab.causal_mask(4)
    assert m.shape == (4, 4)
    assert m[0, 1] and m[0, 3] and not m[1, 0] and not m[3, 3]


def test_hand_calculation():
    # The README's three numbers. Get these or nothing else matters.
    q = k = np.array([[1.0], [1.0], [1.0]])
    v = np.array([[1.0], [2.0], [3.0]])
    out, w = lab.scaled_dot_product_attention(q, k, v, causal=True)
    assert out.ravel().tolist() == pytest.approx([1.0, 1.5, 2.0])
    assert np.allclose(np.tril(w), w)  # no attention to the future
    assert np.allclose(w.sum(axis=1), 1.0)


def test_matches_reference_loop():
    rng = np.random.default_rng(1)
    T, hd = 6, 5
    q, k, v = (rng.normal(size=(T, hd)) for _ in range(3))
    for causal in (True, False):
        got, gw = lab.scaled_dot_product_attention(q, k, v, causal=causal)
        want, ww = reference_attention(q, k, v, causal=causal)
        assert np.allclose(got, want, atol=1e-12)
        assert np.allclose(gw, ww, atol=1e-12)


def test_masked_positions_get_zero_weight():
    rng = np.random.default_rng(2)
    q, k, v = (rng.normal(size=(5, 3)) for _ in range(3))
    _, w = lab.scaled_dot_product_attention(q, k, v, causal=True)
    assert np.allclose(np.triu(w, k=1), 0.0)


def test_heads_roundtrip():
    x = np.random.default_rng(3).normal(size=(2, 4, 8))
    assert np.allclose(lab.merge_heads(lab.split_heads(x, 4)), x)
    assert lab.split_heads(x, 4).shape == (2, 4, 4, 2)


def test_multi_head_equals_manual_concat():
    rng = np.random.default_rng(4)
    T, C, H = 5, 8, 2
    x = rng.normal(size=(T, C))
    w = {n: rng.normal(size=(C, C)) * 0.1 for n in "qkvo"}
    out, weights = lab.multi_head_attention(x, w["q"], w["k"], w["v"], w["o"], H)

    hd = C // H
    per_head = []
    for h in range(H):
        sl = slice(h * hd, (h + 1) * hd)
        qh, kh, vh = x @ w["q"][:, sl], x @ w["k"][:, sl], x @ w["v"][:, sl]
        oh, _ = lab.scaled_dot_product_attention(qh, kh, vh, causal=True)
        per_head.append(oh)
    assert np.allclose(out, np.concatenate(per_head, axis=1) @ w["o"], atol=1e-12)
    assert weights.shape == (H, T, T)


def test_attention_entropy_limits():
    T = 8
    flat = np.full((T, T), 1.0 / T)
    assert lab.attention_entropy_bits(flat) == pytest.approx(np.log2(T))
    eye = np.eye(T)
    assert lab.attention_entropy_bits(eye) == pytest.approx(0.0, abs=1e-9)


def test_gqa_expansion():
    k = np.random.default_rng(5).normal(size=(1, 2, 6, 4))
    out = lab.expand_kv_heads(k, n_head=8)
    assert out.shape == (1, 8, 6, 4)
    assert np.allclose(out[:, 0], out[:, 3])  # groups repeat in blocks
    with pytest.raises(AssertionError):
        lab.expand_kv_heads(k, n_head=3)
