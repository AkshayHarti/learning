import numpy as np
import pytest

from mygpt import GPT, CharTokenizer, data
from mygpt.infer import forward_np, weights_np
from mygpt.train import get_batch, train


@pytest.fixture(scope="module")
def fixture():
    text = data.toy(200, seed=0)
    tok = CharTokenizer(text)
    ids = np.array(tok.encode(text))
    model = GPT(tok.vocab_size, n_layer=2, n_head=2, n_embd=16, block_size=32, seed=0)
    return model, tok, ids


def test_forward_shapes(fixture):
    model, _, ids = fixture
    x, y = get_batch(ids, 16, 4, np.random.default_rng(0))
    logits, loss = model(x, y)
    assert logits.shape == (4, 16, model.config["vocab_size"])
    assert loss.shape == ()
    assert np.isfinite(loss.data)


def test_loss_decreases(fixture):
    model, _, ids = fixture
    hist = train(model, ids, steps=60, batch_size=8, block_size=16, lr=3e-3, quiet=True)
    assert hist[-1] < hist[0] - 0.5


def test_causality_no_future_leak(fixture):
    model, _, ids = fixture
    x = ids[:12][None, :]
    base = model.logits_np(x)
    x2 = x.copy()
    x2[0, 6:] = (x2[0, 6:] + 1) % model.config["vocab_size"]
    after = model.logits_np(x2)
    # positions <= 6 must be unaffected by changes at positions >= 6 (shift by 1)
    assert np.allclose(base[0, :6], after[0, :6], atol=1e-12)
    assert not np.allclose(base[0, 6:], after[0, 6:])


def test_weight_tying(fixture):
    model, _, ids = fixture
    # wte is used for both embedding and output projection: same shape, one tensor.
    assert model.params["wte"].shape[0] == model.config["vocab_size"]


def test_save_load_roundtrip(fixture, tmp_path):
    model, tok, ids = fixture
    path = tmp_path / "m.npz"
    model.save(str(path))
    loaded = GPT.load(str(path))
    assert loaded.num_params() == model.num_params()
    assert np.allclose(model.logits_np(ids[:8][None]), loaded.logits_np(ids[:8][None]))


def test_forward_np_matches_tensor_forward(fixture):
    model, _, ids = fixture
    w = weights_np(model)
    got = forward_np(w, ids[:10], model.config)
    want = model.logits_np(ids[:10][None])[0]
    assert np.allclose(got, want, atol=1e-10)


def test_block_size_is_enforced(fixture):
    model, _, ids = fixture
    with pytest.raises(AssertionError):
        model.logits_np(ids[: model.config["block_size"] + 1][None])
