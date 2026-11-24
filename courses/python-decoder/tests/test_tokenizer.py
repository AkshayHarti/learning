import numpy as np
import pytest

from mygpt import ByteBPE, CharTokenizer, data

CORPUS = ("the cat sat on the mat. the dog sat on the mat. "
          "the cat saw the dog and the dog saw the cat. ") * 30


def test_char_tokenizer_roundtrip():
    text = data.toy(50, seed=0)
    tok = CharTokenizer(text)
    assert tok.decode(tok.encode(text)) == text
    assert len(tok) == len(set(text))


def test_char_tokenizer_ignores_unknown_chars():
    tok = CharTokenizer("abc")
    assert tok.encode("aZb") == [0, 1]  # Z silently dropped: a real footgun


def test_bpe_roundtrip():
    bpe = ByteBPE.train(CORPUS, vocab_size=300)
    for text in ["the cat sat on the mat.", "1234 + 5678", "naïve café ✓"]:
        assert bpe.decode(bpe.encode(text)) == text


def test_bpe_vocab_size_and_determinism():
    a = ByteBPE.train(CORPUS, vocab_size=300)
    b = ByteBPE.train(CORPUS, vocab_size=300)
    assert a.merges == b.merges
    assert a.vocab_size == 256 + len(a.merges)
    assert a.vocab_size <= 300


def test_bpe_compresses():
    bpe = ByteBPE.train(CORPUS, vocab_size=400)
    n_chars = len(CORPUS)
    n_tokens = len(bpe.encode(CORPUS))
    assert n_tokens < n_chars / 2


def test_bpe_digits_compress_worse_than_words():
    bpe = ByteBPE.train(CORPUS, vocab_size=400)
    words = len(CORPUS) / len(bpe.encode(CORPUS[:200]))
    digits = len("1234 5678 9012") / len(bpe.encode("1234 5678 9012"))
    assert digits < words


def test_bpe_handles_unseen_text():
    bpe = ByteBPE.train(CORPUS, vocab_size=260)
    unseen = "zebra quixotically juggles"
    assert bpe.decode(bpe.encode(unseen)) == unseen
