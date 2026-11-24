"""Gradient checks for the autograd engine.

Every op gets the same treatment: perturb one input entry, compare the
analytic gradient to a central difference. If this file passes, you can
trust the engine enough to build a transformer on it.
"""
import numpy as np
import pytest

from mygpt.tensor import (
    Tensor,
    concat,
    cross_entropy,
    gelu,
    layernorm,
    log_softmax,
    softmax,
)

EPS = 1e-6
TOL = 1e-5


def numeric_grad(f, arr, idx, eps=EPS):
    old = arr[idx]
    arr[idx] = old + eps
    hi = f()
    arr[idx] = old - eps
    lo = f()
    arr[idx] = old
    return (hi - lo) / (2 * eps)


def check(fn, *arrays, tol=TOL):
    """fn(*tensors) -> scalar tensor. Verifies every input gradient."""
    tensors = [Tensor(a.copy(), requires_grad=True) for a in arrays]
    out = fn(*tensors)
    out.backward()
    for t, a in zip(tensors, arrays):
        assert t.grad is not None, "missing gradient"
        assert t.grad.shape == t.shape
        for idx in np.ndindex(*a.shape):
            num = numeric_grad(lambda: float(fn(*tensors).data), t.data, idx)
            assert abs(num - t.grad[idx]) < tol * max(1.0, abs(num)), (
                f"{fn.__name__ if hasattr(fn, '__name__') else fn} at {idx}: "
                f"analytic={t.grad[idx]:.8f} numeric={num:.8f}"
            )


def test_add_broadcast():
    check(lambda a, b: (a + b).sum(), np.random.randn(3, 4), np.random.randn(4))


def test_mul_broadcast():
    check(lambda a, b: (a * b).sum(), np.random.randn(3, 4), np.random.randn(4))


def test_div_and_neg():
    check(lambda a, b: (a / b + (-a)).sum(), np.random.randn(3, 4), np.random.rand(4) + 0.5)


def test_pow_sqrt_log_exp():
    check(lambda a: (a ** 2.5).sum(), np.random.rand(3, 2) + 0.5)
    check(lambda a: a.sqrt().sum(), np.random.rand(3, 2) + 0.5)
    check(lambda a: a.log().sum(), np.random.rand(3, 2) + 0.5)
    check(lambda a: a.exp().sum(), np.random.randn(3, 2))


def test_tanh_gelu():
    check(lambda a: a.tanh().sum(), np.random.randn(4, 3))
    check(lambda a: gelu(a).sum(), np.random.randn(4, 3))


def test_matmul_batched():
    check(lambda a, b: (a @ b).sum(), np.random.randn(2, 3, 4), np.random.randn(2, 4, 5))


def test_matmul_shared_b():
    # B is shared across the batch: the gradient must be summed over batch.
    check(lambda a, b: (a @ b).sum(), np.random.randn(2, 3, 4), np.random.randn(4, 5))


def test_reshape_transpose():
    check(lambda a: a.transpose(0, 2, 1).reshape(6, 2).sum() ** 2, np.random.randn(2, 3, 2))


def test_take():
    ids = np.array([[0, 2, 1], [2, 2, 0]])
    check(lambda a: a.take(ids).sum() ** 2, np.random.randn(3, 4))


def test_sum_mean_axis():
    check(lambda a: a.sum(axis=1).sum() ** 2, np.random.randn(4, 5))
    check(lambda a: a.mean(axis=0).sum() ** 2, np.random.randn(4, 5))
    check(lambda a: a.sum() ** 2, np.random.randn(4, 5))


def test_softmax():
    check(lambda a: (softmax(a) * Tensor(np.arange(6.0).reshape(2, 3))).sum(),
          np.random.randn(2, 3))
    check(lambda a: softmax(a, axis=0).sum() ** 2, np.random.randn(4, 3))


def test_log_softmax():
    check(lambda a: log_softmax(a).sum() ** 2, np.random.randn(3, 5))


def test_cross_entropy():
    logits = np.random.randn(4, 6)
    targets = np.array([0, 3, 5, 1])
    check(lambda a: cross_entropy(a, targets), logits)


def test_layernorm():
    check(lambda a: layernorm(a).sum() ** 2, np.random.randn(3, 8))


def test_concat():
    check(lambda a, b: concat([a, b], axis=1).sum() ** 2,
          np.random.randn(2, 3), np.random.randn(2, 4))


def test_masked_fill():
    # -1e9 would make the finite-difference check numerically hopeless; the
    # op itself is value-agnostic, so a small fill value tests it honestly.
    mask = np.array([[False, True], [True, False]])
    check(lambda a: a.masked_fill(mask, -5.0).sum() ** 2, np.random.randn(2, 2))


def test_no_grad():
    from mygpt.tensor import no_grad

    a = Tensor([1.0, 2.0], requires_grad=True)
    with no_grad():
        b = a * 2.0
    assert not b.requires_grad


def test_softmax_is_stable_for_large_logits():
    x = Tensor(np.array([[1000.0, 1001.0, -1000.0]]), requires_grad=True)
    y = softmax(x)
    assert np.isfinite(y.data).all()
    assert pytest.approx(y.data.sum()) == 1.0
