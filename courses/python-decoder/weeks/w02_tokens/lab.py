"""Week 2 lab. Fill in the bodies. The tests are the specification.

Order matters more than you think: BPE merges are applied in *learned rank*
order, not by token id, and not in one left-to-right pass.
"""
from __future__ import annotations

import re
from collections import Counter

WORD_RE = re.compile(r"\s?\w+|\s+|\s?[^\s\w]+", re.UNICODE)
NO_MERGE = 1 << 30


def split_words(text: str) -> list[str]:
    """Pre-split text into chunks that must never be merged across.

    Whitespace belongs to the *following* word (" the", not "the "), which is
    why GPT-style tokenizers have tokens like " the" and not "the ".
    """
    raise NotImplementedError("week 2: split_words")


def pair_counts(words: list[list[int]]) -> Counter:
    """Count adjacent pairs across every word. words: list of id lists."""
    raise NotImplementedError("week 2: pair_counts")


def merge_word(word: list[int], pair: tuple[int, int], new_id: int) -> list[int]:
    """Replace every non-overlapping occurrence of pair, scanning left to right.

    merge_word([1,2,3,2,3], (2,3), 9) == [1, 9, 9]
    """
    raise NotImplementedError("week 2: merge_word")


def train_bpe(text: str, vocab_size: int = 400, min_count: int = 2) -> list[tuple[int, int]]:
    """Greedy pair merging. Return merges in learned order.

    Loop: count pairs -> take most common -> append to merges -> rewrite words
    with the new symbol id (256 + merge_index). Stop when you hit vocab_size,
    run out of pairs, or the best count is below min_count.
    """
    raise NotImplementedError("week 2: train_bpe")


def encode_with_merges(text: str, merges: list[tuple[int, int]]) -> list[int]:
    """Apply merges by learned rank until no known pair remains.

    The bug everyone writes first: sorting by id, or merging repeatedly in one
    pass. Build a {pair: rank} dict and always merge the lowest-rank pair that
    exists in the word.
    """
    raise NotImplementedError("week 2: encode_with_merges")


def decode(ids, merges: list[tuple[int, int]]) -> str:
    """Expand merged ids back to bytes, then text.

    Ids >= 256 are not bytes: each is the concatenation of two earlier ids.
    Build the expansion table from the merge list, then join.
    """
    raise NotImplementedError("week 2: decode")


def token_report(text: str, merges: list[tuple[int, int]]) -> dict:
    """{'chars', 'tokens', 'chars_per_token', 'bytes_per_token'}."""
    raise NotImplementedError("week 2: token_report")
