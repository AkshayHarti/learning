"""Week 5: `uv run python -m weeks.w05_decoding.grid "the cat that the"`.

Same prompt, one distribution, twenty decoding policies. Read the grid for the
*shape* of each failure, not for the best cell -- there isn't one.
"""
from __future__ import annotations

import sys

from mygpt import generate
from weeks._model import tiny

TEMPS = [0.0, 0.3, 0.7, 1.0, 1.3]
NUCLEUS = [None, 0.9, 0.5]


def main(prompt: str = "the cat that the") -> None:
    model, tok = tiny()
    print(f"prompt: {prompt!r}\n")
    for t in TEMPS:
        for p in NUCLEUS:
            out = generate(model, tok, prompt, max_new_tokens=70, seed=1,
                           temperature=t, top_p=p)
            label = f"T={t:<4} top_p={p if p else 'off':<4}"
            body = out[len(prompt):].replace("\n", " ")
            print(f"{label} | {body}")
        print()
    print("Look for: T=0 loops (deterministic attractor), top_p=0.5 terse but")
    print("coherent, T=1.3 rambling. Then ask which of these you would ship.")
    print("None of them. You would ship a product that measures parse rate and")
    print("task success per setting -- which is week 8.")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "the cat that the")
