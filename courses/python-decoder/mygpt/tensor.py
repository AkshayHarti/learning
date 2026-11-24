"""A tiny reverse-mode autograd engine over numpy arrays.

Why hand-rolled instead of torch: the point of this course is to see the
gradient, not to trust the framework. Every op here is ~10 lines, and the
whole engine fits in one sitting. torch is the *destination*, not the teacher.

Design notes
------------
* float64 everywhere. A tiny model is fast enough, and gradient checks with
  float32 are miserable. Numerical sanity beats microbenchmarks here.
* Every op records a closure that accumulates gradients into its inputs.
  `backward()` walks a topological order of the recorded graph.
* Broadcasting is handled once, in `_unbroadcast`.
* `no_grad()` disables graph construction for inference.

Read this file top to bottom once. Then read it again in week 4.
"""
from __future__ import annotations

from contextlib import contextmanager

import numpy as np

_GRAD_ENABLED = True


@contextmanager
def no_grad():
    """Disable graph construction. Inference only."""
    global _GRAD_ENABLED
    prev, _GRAD_ENABLED = _GRAD_ENABLED, False
    try:
        yield
    finally:
        _GRAD_ENABLED = prev


def _unbroadcast(g: np.ndarray, shape: tuple[int, ...]) -> np.ndarray:
    """Sum a broadcast gradient back down to `shape`."""
    while g.ndim > len(shape):
        g = g.sum(axis=0)
    for axis, size in enumerate(shape):
        if size == 1 and g.shape[axis] != 1:
            g = g.sum(axis=axis, keepdims=True)
    return g


def _acc(t: "Tensor", g: np.ndarray) -> None:
    t.grad = g if t.grad is None else t.grad + g


class Tensor:
    """An array that remembers how it was made."""

    __slots__ = ("data", "grad", "requires_grad", "_backward", "_prev", "_op")

    def __init__(self, data, requires_grad: bool = False, _children=(), _op: str = ""):
        self.data = np.asarray(data, dtype=np.float64)
        self.grad: np.ndarray | None = None
        self.requires_grad = bool(requires_grad) and _GRAD_ENABLED
        self._prev = tuple(_children) if self.requires_grad else ()
        self._op = _op
        self._backward = lambda: None

    # ---- introspection -------------------------------------------------
    @property
    def shape(self):
        return self.data.shape

    @property
    def ndim(self):
        return self.data.ndim

    @property
    def T(self):
        return self.transpose()

    def __repr__(self) -> str:
        return f"Tensor(shape={self.shape}, op={self._op or 'leaf'})"

    # ---- backprop ------------------------------------------------------
    def backward(self) -> None:
        topo, seen = [], set()

        def build(t: "Tensor"):
            if id(t) in seen:
                return
            seen.add(id(t))
            for p in t._prev:
                build(p)
            topo.append(t)

        build(self)
        self.grad = np.ones_like(self.data)
        for t in reversed(topo):
            t._backward()

    def zero_grad(self) -> None:
        self.grad = None

    def detach(self) -> "Tensor":
        return Tensor(self.data)

    def numpy(self) -> np.ndarray:
        return self.data

    def item(self) -> float:
        return float(self.data.reshape(-1)[0])

    # ---- arithmetic ----------------------------------------------------
    def _bin(self, other, op_name: str, fwd, bw_a, bw_b):
        other = other if isinstance(other, Tensor) else Tensor(other)
        req = self.requires_grad or other.requires_grad
        out = Tensor(fwd(self.data, other.data), req, (self, other), op_name)

        def _backward():
            if self.requires_grad:
                _acc(self, _unbroadcast(bw_a(out.grad, self.data, other.data), self.shape))
            if other.requires_grad:
                _acc(other, _unbroadcast(bw_b(out.grad, self.data, other.data), other.shape))

        if req:
            out._backward = _backward
        return out

    def __add__(self, other):
        return self._bin(other, "add", lambda a, b: a + b,
                         lambda g, a, b: g, lambda g, a, b: g)

    __radd__ = __add__

    def __sub__(self, other):
        return self._bin(other, "sub", lambda a, b: a - b,
                         lambda g, a, b: g, lambda g, a, b: -g)

    def __rsub__(self, other):
        return Tensor(other).__sub__(self)

    def __mul__(self, other):
        return self._bin(other, "mul", lambda a, b: a * b,
                         lambda g, a, b: g * b, lambda g, a, b: g * a)

    __rmul__ = __mul__

    def __truediv__(self, other):
        return self._bin(other, "div", lambda a, b: a / b,
                         lambda g, a, b: g / b, lambda g, a, b: -g * a / (b * b))

    def __neg__(self):
        return self * -1.0

    def __matmul__(self, other):
        return self._bin(other, "matmul",
                         lambda a, b: a @ b,
                         lambda g, a, b: g @ np.swapaxes(b, -1, -2),
                         lambda g, a, b: np.swapaxes(a, -1, -2) @ g)

    # ---- unary ---------------------------------------------------------
    def _un(self, op_name: str, fwd, bw):
        out = Tensor(fwd(self.data), self.requires_grad, (self,), op_name)

        def _backward():
            _acc(self, bw(out.grad, self.data))

        if self.requires_grad:
            out._backward = _backward
        return out

    def exp(self):
        out = self._un("exp", np.exp, lambda g, x: g * np.exp(x))
        return out

    def log(self):
        return self._un("log", np.log, lambda g, x: g / x)

    def sqrt(self):
        return self._un("sqrt", np.sqrt, lambda g, x: g * 0.5 / np.sqrt(x))

    def tanh(self):
        t = np.tanh(self.data)
        return self._un("tanh", lambda x: np.tanh(x), lambda g, x: g * (1 - t * t))

    def __pow__(self, p: float):
        return self._un("pow", lambda x: x ** p, lambda g, x: g * p * x ** (p - 1))

    # ---- shape ---------------------------------------------------------
    def reshape(self, *shape):
        if len(shape) == 1 and isinstance(shape[0], (tuple, list)):
            shape = tuple(shape[0])
        out = Tensor(self.data.reshape(shape), self.requires_grad, (self,), "reshape")

        def _backward():
            _acc(self, out.grad.reshape(self.shape))

        if self.requires_grad:
            out._backward = _backward
        return out

    def transpose(self, *axes):
        axes = axes or tuple(reversed(range(self.ndim)))
        out = Tensor(self.data.transpose(axes), self.requires_grad, (self,), "transpose")
        inv = tuple(np.argsort(axes))

        def _backward():
            _acc(self, out.grad.transpose(inv))

        if self.requires_grad:
            out._backward = _backward
        return out

    def sum(self, axis=None, keepdims: bool = False):
        out = Tensor(self.data.sum(axis=axis, keepdims=keepdims),
                     self.requires_grad, (self,), "sum")

        def _backward():
            g = out.grad
            if axis is not None and not keepdims:
                g = np.expand_dims(g, axis)
            _acc(self, np.broadcast_to(g, self.shape).copy())

        if self.requires_grad:
            out._backward = _backward
        return out

    def mean(self, axis=None, keepdims: bool = False):
        n = self.data.size if axis is None else self.shape[axis]
        return self.sum(axis=axis, keepdims=keepdims) * (1.0 / n)

    def take(self, ids: np.ndarray):
        """Gather rows along axis 0 (embedding lookup)."""
        ids = np.asarray(ids, dtype=np.int64)
        out = Tensor(self.data[ids], self.requires_grad, (self,), "take")

        def _backward():
            g = np.zeros_like(self.data)
            np.add.at(g, ids, out.grad)
            _acc(self, g)

        if self.requires_grad:
            out._backward = _backward
        return out

    def masked_fill(self, mask: np.ndarray, value: float):
        """Zero out positions where mask is True; gradient flows elsewhere."""
        mask = np.asarray(mask, dtype=bool)
        out = Tensor(np.where(mask, value, self.data), self.requires_grad, (self,), "mask")

        def _backward():
            _acc(self, np.where(mask, 0.0, out.grad))

        if self.requires_grad:
            out._backward = _backward
        return out


# ---- fused ops: softmax, layernorm, cross-entropy ----------------------
# Fused because the naive composition is numerically unstable and the
# gradient is much easier to write (and to check) in one place.


def softmax(x: Tensor, axis: int = -1) -> Tensor:
    z = x.data - x.data.max(axis=axis, keepdims=True)
    e = np.exp(z)
    y = e / e.sum(axis=axis, keepdims=True)
    out = Tensor(y, x.requires_grad, (x,), "softmax")

    def _backward():
        _acc(x, y * (out.grad - (out.grad * y).sum(axis=axis, keepdims=True)))

    if x.requires_grad:
        out._backward = _backward
    return out


def log_softmax(x: Tensor, axis: int = -1) -> Tensor:
    z = x.data - x.data.max(axis=axis, keepdims=True)
    lse = np.log(np.exp(z).sum(axis=axis, keepdims=True))
    y = z - lse
    out = Tensor(y, x.requires_grad, (x,), "log_softmax")

    def _backward():
        _acc(x, out.grad - np.exp(y) * out.grad.sum(axis=axis, keepdims=True))

    if x.requires_grad:
        out._backward = _backward
    return out


def cross_entropy(logits: Tensor, targets: np.ndarray) -> Tensor:
    """Mean negative log-likelihood. logits: (N, V). targets: (N,) ints."""
    targets = np.asarray(targets, dtype=np.int64).reshape(-1)
    z = logits.data.reshape(-1, logits.shape[-1])
    z = z - z.max(axis=1, keepdims=True)
    logp = z - np.log(np.exp(z).sum(axis=1, keepdims=True))
    n = targets.shape[0]
    loss = -logp[np.arange(n), targets].mean()
    out = Tensor(loss, logits.requires_grad, (logits,), "cross_entropy")

    def _backward():
        g = np.exp(logp)
        g[np.arange(n), targets] -= 1.0
        g *= out.grad / n
        _acc(logits, g.reshape(logits.shape))

    if logits.requires_grad:
        out._backward = _backward
    return out


def layernorm(x: Tensor, eps: float = 1e-5):
    """Normalise the last axis. Returns (out, gamma, beta)."""
    mu = x.data.mean(axis=-1, keepdims=True)
    var = x.data.var(axis=-1, keepdims=True)
    inv = 1.0 / np.sqrt(var + eps)
    xhat = (x.data - mu) * inv
    out = Tensor(xhat, x.requires_grad, (x,), "layernorm")

    def _backward():
        g = out.grad
        _acc(x, inv * (g - g.mean(axis=-1, keepdims=True)
                       - xhat * (g * xhat).mean(axis=-1, keepdims=True)))

    if x.requires_grad:
        out._backward = _backward
    return out


def gelu(x: Tensor) -> Tensor:
    """tanh approximation; what real models use."""
    c = np.sqrt(2.0 / np.pi)
    t = np.tanh(c * (x.data + 0.044715 * x.data ** 3))
    y = 0.5 * x.data * (1 + t)
    out = Tensor(y, x.requires_grad, (x,), "gelu")

    def _backward():
        dt = c * (1 + 3 * 0.044715 * x.data ** 2) * (1 - t * t)
        _acc(x, out.grad * (0.5 * (1 + t) + 0.5 * x.data * dt))

    if x.requires_grad:
        out._backward = _backward
    return out


def concat(tensors: list[Tensor], axis: int = 1) -> Tensor:
    req = any(t.requires_grad for t in tensors)
    out = Tensor(np.concatenate([t.data for t in tensors], axis=axis), req, tuple(tensors), "concat")
    if not req:
        return out
    sizes = np.cumsum([t.shape[axis] for t in tensors])[:-1]

    def _backward():
        for t, piece in zip(tensors, np.split(out.grad, sizes, axis=axis)):
            if t.requires_grad:
                _acc(t, piece)

    out._backward = _backward
    return out
