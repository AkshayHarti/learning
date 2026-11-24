import numpy as np
import pytest

from mygpt import GPT, CharTokenizer, data
from weeks._loader import load_lab

lab = load_lab(__file__)


@pytest.fixture(scope="module")
def tiny_model():
    text = data.toy(300, seed=0)
    tok = CharTokenizer(text)
    model = GPT(tok.vocab_size, n_layer=1, n_head=2, n_embd=16, block_size=16, seed=1)
    p = {k: v.data for k, v in model.params.items()}
    ids = np.array(tok.encode(text[:16]))[None, :]
    return model, p, ids


def test_layernorm_matches_reference(tiny_model):
    model, _, _ = tiny_model
    x = np.random.default_rng(0).normal(size=(5, 16)) * 3 + 7
    g, b = np.ones(16), np.zeros(16)
    got = lab.layernorm_forward(x, g, b)
    assert np.allclose(got.mean(-1), 0, atol=1e-9)
    assert np.allclose(got.var(-1), 1, atol=1e-6)


def test_gelu_endpoints_and_shape():
    x = np.array([[-3.0, 0.0, 3.0]])
    g = lab.gelu(x)
    assert g.shape == x.shape
    assert g[0, 1] == pytest.approx(0.0)
    assert g[0, 0] == pytest.approx(0.0, abs=1e-2)   # hard negative -> ~0
    assert g[0, 2] == pytest.approx(3.0, abs=1e-2)   # large positive -> ~x


def test_causal_attention_shapes_and_masking():
    T, C, H = 6, 8, 2
    p = {}
    rng = np.random.default_rng(1)
    for n in ("wq", "wk", "wv", "wo"):
        p[n] = rng.normal(size=(C, C)) * 0.3
    for n in ("bq", "bk", "bv", "bo"):
        p[n] = np.zeros(C)
    p["ln1_g"], p["ln1_b"] = np.ones(C), np.zeros(C)
    x = rng.normal(size=(T, C))
    y = lab.causal_attention(x, p, "", H)
    assert y.shape == (T, C)
    # Position 0 can only see itself: changing future rows must not change row 0.
    x2 = x.copy()
    x2[1:] += 5.0
    y2 = lab.causal_attention(x2, p, "", H)
    assert np.allclose(y[0], y2[0], atol=1e-10)


def test_block_matches_reference_model(tiny_model):
    model, p, ids = tiny_model
    cfg = model.config
    T = ids.shape[1]
    x = p["wte"][ids[0]] + p["wpe"][:T]
    got = lab.block_forward(x, p, "l0.", cfg["n_head"])
    want = _reference_block(model, ids[0])
    assert np.allclose(got, want, atol=1e-10), f"max diff {np.abs(got - want).max():.2e}"


def _reference_block(model, ids_row):
    """Run the model's own graph up to and including block 0."""
    from mygpt.tensor import gelu, layernorm, softmax

    T = len(ids_row)
    x = model.params["wte"].take(ids_row) + model.params["wpe"].take(np.arange(T))
    k = "l0."
    B, C, H = 1, model.config["n_embd"], model.config["n_head"]
    hd = C // H
    h = model._ln(x, k + "ln1")
    q = (h @ model.params[k + "wq"] + model.params[k + "bq"]).reshape(B, T, H, hd).transpose(0, 2, 1, 3)
    kk = (h @ model.params[k + "wk"] + model.params[k + "bk"]).reshape(B, T, H, hd).transpose(0, 2, 1, 3)
    v = (h @ model.params[k + "wv"] + model.params[k + "bv"]).reshape(B, T, H, hd).transpose(0, 2, 1, 3)
    causal = np.triu(np.ones((T, T), dtype=bool), k=1)
    att = softmax(((q @ kk.transpose(0, 1, 3, 2)) * (hd ** -0.5)).masked_fill(causal, -1e9), axis=-1)
    y = (att @ v).transpose(0, 2, 1, 3).reshape(B, T, C)
    x = x + (y @ model.params[k + "wo"] + model.params[k + "bo"])
    h2 = layernorm(x) * model.params[k + "ln2_g"] + model.params[k + "ln2_b"]
    x = x + (gelu(h2 @ model.params[k + "w1"] + model.params[k + "b1"]) @ model.params[k + "w2"]
             + model.params[k + "b2"])
    return x.data[0]


def test_param_count_matches_model():
    for cfg in [(23, 2, 64, 64), (50, 3, 32, 32), (100, 1, 128, 16)]:
        vocab, n_layer, n_embd, block = cfg
        assert lab.param_count(vocab, n_layer, n_embd, block) == \
            GPT(vocab, n_layer=n_layer, n_embd=n_embd, n_head=2 if n_embd % 2 == 0 else 1,
                block_size=block).num_params(), cfg


def test_trains_and_learns():
    model, tok, hist = lab.train_tiny(steps=250, quiet=True)
    assert hist[0] > hist[-1] + 1.0, "loss barely moved: check your loop or lr"
    assert hist[-1] < 1.5, f"final loss {hist[-1]:.3f} too high after 250 steps"
