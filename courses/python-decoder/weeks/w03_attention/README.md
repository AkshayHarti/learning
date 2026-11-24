# Week 3 — Attention is differentiable lookup

**Time:** 6h · **Deliverable:** a hand-checked attention head + a heatmap you can read
**Prereq:** weeks 1–2, basic linear algebra

## The one idea

You have a residual stream: a vector per position. Each position needs
information from other positions. The naive solution — a lookup table learned per
pair — is `O(T²)` parameters and does not generalise across positions. Attention
replaces it with a *learned similarity*: project each position into a query, a
key and a value; score every query against every key with a dot product; softmax
those scores into a distribution; take the expected value. That's it. The magic
is not the mechanism, it's that gradients make the *criterion* for "relevant"
learnable.

## Derive (90 min)

1. Dot product as similarity: `q·k` is large when directions align. Cheap,
   differentiable, and it composes with linear projections.
2. Why divide by `√d`? Dot products of `d`-dimensional random vectors have
   variance `d`, so scores grow with width and softmax saturates into a
   one-hot with near-zero gradient. Scaling keeps the temperature fixed as you
   widen the model.
3. Softmax turns scores into a convex combination. Two consequences: outputs are
   bounded by the values (no runaway), and every row sums to 1 (attention is a
   *mixture*, not a gate).
4. Causal masking sets the future to `-inf` before the softmax, so `exp(-inf)=0`
   exactly. Forgetting this is the single most common silent bug in the field:
   the model still trains, it just cheats.
5. Multi-head = run `H` independent attentions on `C/H` dims and concatenate.
   Different heads specialise (previous token, matching brackets, induction).
6. QKV as *retrieval*: query = "what am I looking for", key = "what do I offer",
   value = "what I will hand over". Say this out loud once; it makes GQA, KV
   caching (week 7) and attention sinks obvious later.

Hand check (do this on paper, it takes 10 minutes and pays for itself). Use
`hd = 1`, three tokens, `q = k = [[1],[1],[1]]` (so every score is `1/√1 = 1`,
i.e. a flat distribution), and `v = [[1],[2],[3]]`. With a causal mask:

- row 0 sees only token 0: output `1`
- row 1 sees tokens 0,1 with weights `(0.5, 0.5)`: output `1.5`
- row 2 sees all three with weights `(1/3, 1/3, 1/3)`: output `2`

Three numbers. If you cannot reproduce them from the formula, reread steps 3–4
before writing code — the rest of the week is variations on this one calculation,
and the tests check exactly it.

## Build (180 min)

`lab.py`:

| Function | Contract |
|---|---|
| `softmax` | numerically stable, arbitrary axis |
| `causal_mask` | `True` where forbidden (strict upper triangle) |
| `scaled_dot_product_attention` | returns `(output, weights)` |
| `split_heads` / `merge_heads` | reshapes only; no maths |
| `multi_head_attention` | `x @ wq`, etc., then merge, then `@ wo` |
| `attention_entropy_bits` | mean row entropy — how *sharp* is attention |
| `expand_kv_heads` | GQA repeat factor |

Tests include a reference loop implementation. If your vectorised version
disagrees with the loop, the loop is right and you are wrong, every time.

## Break it (45 min)

1. Remove the causal mask. Loss on the toy corpus drops to ~0 almost instantly.
   That is not learning, it is copying: every position can see its own answer.
   Keep the loss curve in your notes — you will see this shape again in a
   real codebase.
2. Set `scale = 1` (no `√d`). Print `attention_entropy_bits`. Watch it collapse
   toward 0 as you increase `d`: saturated softmax, dead gradients.
3. Skip the `@ wo` projection. Everything still runs and the model still trains.
   This is the general shape of an attention bug: silent, not crashing.

## Play (45 min)

`explorables/04-attention.html` — click rows, drag the temperature slider, toggle
the causal mask. Do this *before* writing code if you can; the picture is worth
more than the notation.

Then generate a real heatmap from your trained model:

```bash
uv run python -m weeks.w03_attention.heatmap "the cat that the dog chases sees the moon"
```

It prints an ASCII heatmap and the entropy per layer. Look for the head that
attends to the token after `that` — that is a relative-position head, and seeing
it is the moment attention stops being abstract.

## Explain back (30 min)

In 200 words: *why does attention scale quadratically, why does that matter, and
what do the three main escape hatches (sliding window, GQA/MQA, linear/SSM
hybrids) each actually buy?* Be precise about which one saves compute versus
which one saves memory.

## 2026 lens

- **Still true:** attention is the retrieval primitive; masking bugs are still the
  most common silent failure; multi-head specialisation is real and measurable.
- **Changed:** production models are not full quadratic attention over the whole
  context. GQA is standard (fewer KV heads = smaller cache, week 7), sliding
  windows and hybrid SSM layers are common at long context, and attention sinks
  are the mechanism people use to keep a stable first token.
- **Open:** whether hybrid attention/SSM stacks scale as cleanly as pure
  attention, and whether "context length" stays the axis everyone competes on.

## Stretch

Implement RoPE (rotate q and k by position-dependent angles, no added
parameters) and swap it in for learned positions in `mygpt/model.py`. Then blame
something on it. RoPE's failure mode at long context is a genuinely useful thing
to have seen with your own eyes.
