import numpy as np
import pytest

from mygpt.infer import forward_np
from weeks._loader import load_lab

lab = load_lab(__file__)


@pytest.fixture(scope="module")
def fixture():
    from weeks._model import tiny

    model, tok = tiny()
    w = {k: v.data for k, v in model.params.items()}
    return model, tok, w


def test_cache_matches_full_forward(fixture):
    model, tok, w = fixture
    ids = tok.encode("the cat that the")[:8]
    cache = {}
    for pos, token in enumerate(ids):
        got = lab.step_cached(w, token, pos, cache, model.config)
        want = forward_np(w, np.array(ids[: pos + 1]))[-1]
        assert np.allclose(got, want, atol=1e-9), f"diverged at pos {pos}"


def test_cache_grows_linearly(fixture):
    model, tok, w = fixture
    ids = tok.encode("a dog")[:6]
    cache = {}
    sizes = []
    for pos, token in enumerate(ids):
        lab.step_cached(w, token, pos, cache, model.config)
        sizes.append(cache[0]["k"].shape[1])
    assert sizes == list(range(1, len(ids) + 1))


def test_kv_bytes_formula_and_gqa_savings():
    mha = lab.kv_bytes(n_layer=32, n_kv_head=32, head_dim=128, seq_len=8192)
    gqa = lab.kv_bytes(n_layer=32, n_kv_head=8, head_dim=128, seq_len=8192)
    assert mha == 2 * 32 * 32 * 128 * 8192 * 2
    assert mha == 4 * gqa  # 4x fewer KV heads, 4x smaller cache


def test_cached_decode_is_cheaper_than_recompute():
    kwargs = dict(n_layer=12, n_embd=768, seq_len=512, n_new=256)
    assert lab.decode_flops(cached=True, **kwargs) < lab.decode_flops(cached=False, **kwargs) / 10


def test_padding_waste():
    out = lab.padding_waste([100, 20, 5])
    assert out["useful"] == 125
    assert out["padded"] == 300
    assert out["utilisation"] == pytest.approx(125 / 300)


def test_padding_waste_empty_batch():
    assert lab.padding_waste([])["utilisation"] == 0.0


def test_spec_expected_tokens():
    assert lab.spec_expected_tokens(0.5, 3) == pytest.approx(1.875)
    assert lab.spec_expected_tokens(1.0, 4) == pytest.approx(5.0)
    assert lab.spec_expected_tokens(0.0, 4) == pytest.approx(1.0)


def test_throughput_and_cost_math():
    assert lab.tokens_per_second(500, 2.0) == pytest.approx(250.0)
    # 1M input at $3/Mtok + 1M output at $15/Mtok
    assert lab.cost_per_million(1_000_000, 1_000_000, 3.0, 15.0) == pytest.approx(18.0)
    # output-heavy traffic is dominated by the output price
    assert lab.cost_per_million(100_000, 900_000, 3.0, 15.0) == pytest.approx(13.8)
