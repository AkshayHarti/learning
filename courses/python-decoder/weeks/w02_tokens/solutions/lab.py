"""Week 2 — tokens are learned, not given.

Reference BPE. Byte-level, GPT-2 style word pre-splitting, merges applied by
learned rank. Nothing here needs a model or a GPU: tokenization is pure
statistics, which is exactly why its pathologies are so easy to miss.
"""
from __future__ import annotations

import re
from collections import Counter

WORD_RE = re.compile(r"\s?\w+|\s+|\s?[^\s\w]+", re.UNICODE)
NO_MERGE = 1 << 30


def split_words(text: str) -> list[str]:
    """Pre-split so merges never cross word boundaries."""
    return WORD_RE.findall(text)


def pair_counts(words: list[list[int]]) -> Counter:
    counts: Counter = Counter()
    for w in words:
        counts.update(zip(w, w[1:]))
    return counts


def merge_word(word: list[int], pair: tuple[int, int], new_id: int) -> list[int]:
    """Replace every non-overlapping occurrence of `pair`, left to right."""
    a, b = pair
    out, i = [], 0
    while i < len(word):
        if i < len(word) - 1 and word[i] == a and word[i + 1] == b:
            out.append(new_id)
            i += 2
        else:
            out.append(word[i])
            i += 1
    return out


def train_bpe(text: str, vocab_size: int = 400, min_count: int = 2) -> list[tuple[int, int]]:
    """Greedy pair merging. Returns the merge list, in learned order."""
    words = [list(w.encode("utf-8")) for w in split_words(text)]
    merges: list[tuple[int, int]] = []
    for m in range(max(0, vocab_size - 256)):
        counts = pair_counts(words)
        if not counts:
            break
        (pair, n) = counts.most_common(1)[0]
        if n < min_count:
            break
        merges.append(pair)
        words = [merge_word(w, pair, 256 + m) for w in words]
    return merges


def encode_with_merges(text: str, merges: list[tuple[int, int]]) -> list[int]:
    rank = {pair: i for i, pair in enumerate(merges)}
    ids: list[int] = []
    for word in split_words(text):
        w = list(word.encode("utf-8"))
        while len(w) >= 2:
            best_rank, best_i = NO_MERGE, -1
            for i, pair in enumerate(zip(w, w[1:])):
                r = rank.get(pair, NO_MERGE)
                if r < best_rank:
                    best_rank, best_i = r, i
            if best_i < 0:
                break
            w = merge_word(w, (w[best_i], w[best_i + 1]), 256 + best_rank)
        ids.extend(w)
    return ids


def decode(ids, merges: list[tuple[int, int]]) -> str:
    """Expand merged ids back to bytes, then to text."""
    vocab = {i: bytes([i]) for i in range(256)}
    for m, (a, b) in enumerate(merges):
        vocab[256 + m] = vocab[a] + vocab[b]
    return b"".join(vocab[int(i)] for i in ids).decode("utf-8", errors="replace")


def token_report(text: str, merges: list[tuple[int, int]]) -> dict:
    ids = encode_with_merges(text, merges)
    return {
        "chars": len(text),
        "tokens": len(ids),
        "chars_per_token": len(text) / max(1, len(ids)),
        "bytes_per_token": len(text.encode()) / max(1, len(ids)),
    }
