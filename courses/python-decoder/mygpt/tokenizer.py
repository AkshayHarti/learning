"""Byte-level BPE, the tokenizer family behind GPT-2/3/4-era models.

Two phases, and the distinction matters:
  train()  -- discover frequent byte pairs, add them to the vocabulary
  encode() -- re-apply those merges in learned order

Week 2 makes you reimplement the merge loop. This module is the reference.
"""
from __future__ import annotations

import re
from collections import Counter

_WORD = re.compile(r"\s?\w+|\s?[^\s\w]+", re.UNICODE)


class ByteBPE:
    def __init__(self, merges: list[tuple[int, int]] | None = None):
        self.merges = list(merges or [])
        self.rank = {pair: i for i, pair in enumerate(self.merges)}
        self.vocab_size = 256 + len(self.merges)

    # ---- training ------------------------------------------------------
    @classmethod
    def train(cls, text: str, vocab_size: int = 512, verbose: bool = False) -> "ByteBPE":
        assert vocab_size >= 256
        words = [list(w.encode("utf-8")) for w in _WORD.findall(text)]
        merges: list[tuple[int, int]] = []
        for m in range(vocab_size - 256):
            counts: Counter = Counter()
            for w in words:
                counts.update(zip(w, w[1:]))
            if not counts:
                break
            (a, b), n = counts.most_common(1)[0]
            if n < 2:
                break
            merges.append((a, b))
            words = [_replace(w, a, b, 256 + m) for w in words]
            if verbose and len(merges) % 32 == 0:
                print(f"merge {len(merges):4d}: {a}+{b} x{n} -> id {256 + m}")
        return cls(merges)

    # ---- inference -----------------------------------------------------
    def encode(self, text: str) -> list[int]:
        ids: list[int] = []
        for word in _WORD.findall(text):
            w = list(word.encode("utf-8"))
            while len(w) >= 2:
                best = min(
                    ((self.rank.get(pair, 1 << 30), i)
                     for i, pair in enumerate(zip(w, w[1:]))),
                    default=(1 << 30, -1),
                )
                r, i = best
                if r == 1 << 30:
                    break
                w = _replace(w, w[i], w[i + 1], 256 + r)
            ids.extend(w)
        return ids

    def decode(self, ids) -> str:
        """Expanded bytes -> text. Ids >= 256 are merge results, not bytes."""
        vocab = {i: bytes([i]) for i in range(256)}
        for m, (a, b) in enumerate(self.merges):
            vocab[256 + m] = vocab[a] + vocab[b]
        return b"".join(vocab[int(i)] for i in ids).decode("utf-8", errors="replace")

    def __len__(self) -> int:
        return self.vocab_size


def _replace(word: list[int], a: int, b: int, new_id: int) -> list[int]:
    """Replace every non-overlapping (a, b) with new_id. Left to right."""
    out, i = [], 0
    while i < len(word):
        if i < len(word) - 1 and word[i] == a and word[i + 1] == b:
            out.append(new_id)
            i += 2
        else:
            out.append(word[i])
            i += 1
    return out


class CharTokenizer:
    """Character-level. What the course's toy model actually trains on.

    Char-level keeps sequences honest: one token per character, so you can
    debug the whole pipeline by eye. Week 2 swaps in BPE and shows what
    changes: ~4x fewer tokens, ~4x longer effective context, and brand new
    failure modes (arithmetic, rare strings, unicode).
    """

    def __init__(self, chars: str):
        self.chars = "".join(sorted(set(chars)))
        self.stoi = {c: i for i, c in enumerate(self.chars)}
        self.itos = {i: c for c, i in self.stoi.items()}
        self.vocab_size = len(self.chars)

    def encode(self, text: str) -> list[int]:
        return [self.stoi[c] for c in text if c in self.stoi]

    def decode(self, ids) -> str:
        return "".join(self.itos[int(i)] for i in ids)

    def __len__(self) -> int:
        return self.vocab_size
