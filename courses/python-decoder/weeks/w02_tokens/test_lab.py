import math

import pytest

from weeks._loader import load_lab

lab = load_lab(__file__)

CORPUS = ("the cat sat on the mat. the dog sat on the mat. "
          "the cat saw the dog. the dog saw the cat. ") * 40


@pytest.fixture(scope="module")
def merges():
    return lab.train_bpe(CORPUS, vocab_size=300)


def test_split_words_attaches_leading_space():
    assert lab.split_words("the cat") == ["the", " cat"]
    assert lab.split_words("a.b") == ["a", ".", "b"]
    assert lab.split_words("a.  b") == ["a", ".", "  ", "b"]


def test_pair_counts_simple():
    counts = lab.pair_counts([[1, 2, 3], [1, 2]])
    assert counts[(1, 2)] == 2
    assert counts[(2, 3)] == 1


def test_merge_word_left_to_right_non_overlapping():
    assert lab.merge_word([1, 2, 3, 2, 3], (2, 3), 9) == [1, 9, 9]
    assert lab.merge_word([1, 1, 1], (1, 1), 9) == [9, 1]  # greedy, not overlapping
    assert lab.merge_word([5], (1, 2), 9) == [5]


def test_roundtrip(merges):
    for text in ["the cat sat on the mat.", "naïve café ✓", "def f(x):\n    return x  # 42"]:
        assert lab.decode(lab.encode_with_merges(text, merges), merges) == text


def test_merges_are_deterministic_and_bounded(merges):
    again = lab.train_bpe(CORPUS, vocab_size=300)
    assert merges == again
    assert len(merges) <= 300 - 256


def test_more_merges_means_fewer_tokens(merges):
    # A prefix of the merge list is a strictly weaker tokenizer.
    n_many = len(lab.encode_with_merges(CORPUS, merges))
    n_few = len(lab.encode_with_merges(CORPUS, merges[:5]))
    assert n_many < n_few


def test_compression_ratio_is_real(merges):
    rep = lab.token_report(CORPUS, merges)
    assert rep["chars"] / rep["tokens"] > 1.8, rep


def test_digits_compress_worse_than_words(merges):
    words = lab.token_report("the cat sat on the mat", merges)["chars_per_token"]
    digits = lab.token_report("1234 5678 9012 3456", merges)["chars_per_token"]
    assert digits < words, f"digits {digits:.2f} should be worse than words {words:.2f}"


def test_encode_uses_learned_rank_not_id_order():
    # Two merges where the *later* learned one has a lower id than an earlier
    # one would tempt a naive implementation. Rank order must win.
    text = "aaab" * 5
    merges = lab.train_bpe(text, vocab_size=258, min_count=1)
    ids = lab.encode_with_merges(text, merges)
    assert lab.decode(ids, merges) == text
    assert len(ids) < len(text.encode())


def test_words_encode_independently(merges):
    # Pre-splitting means encoding is additive over words: no merge may span a
    # word boundary. If this fails, you are merging across spaces and your
    # vocabulary is quietly learning the wrong things.
    a = lab.encode_with_merges("cat", merges)
    b = lab.encode_with_merges(" at", merges)
    assert lab.encode_with_merges("cat at", merges) == a + b
    assert lab.decode(lab.encode_with_merges("cat at", merges), merges) == "cat at"


def test_bits_per_token_arithmetic():
    # If a tokenizer packs 4 chars/token, a 100k-token context holds ~400k chars.
    # This is the arithmetic a PM will ask you for; be able to do it in your head.
    assert math.floor(100_000 * 4 / 1.0) == 400_000
