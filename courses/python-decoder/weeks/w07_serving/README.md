# Week 7 — Serving: caches, batches, and the bill

**Time:** 6h · **Deliverable:** a cached decoder that is provably identical and measurably faster
**Prereq:** weeks 3–5 (attention and decoding)

## The one idea

Prefill is compute-bound: one big matmul over the prompt, parallel across tokens.
Decode is *memory*-bound: one token at a time, and the arithmetic per token is
trivial next to moving the weights and the cache. Every serving trick you have
heard of — KV cache, continuous batching, GQA, paged attention, prefix caching,
speculative decoding, disaggregated prefill/decode — is a consequence of that
asymmetry. Learn the asymmetry and the tricks stop being trivia.

## Derive (90 min)

1. Without a cache, generating token `n` re-runs attention over `n` positions.
   Total work for `N` tokens is `O(N²)` in the *incremental* sense, on top of
   being `N×` redundant. Week 3's model already computed every intermediate it
   needs — it just threw them away.
2. K and V are the only things worth keeping. Q is used once, per step, and never
   again. That is why the cache is "KV", not "QKV".
3. Cache size: `2 · n_layer · n_kv_head · head_dim · seq_len · bytes`. A
   32-layer, 32-head, 128-dim model at 8k context in fp16 is **4.3 GB per
   sequence**; at 128k it is **69 GB**. Drop to 8 KV heads (GQA) and those become
   1.1 GB and 17 GB. That factor of 4 for ~no quality change is why GQA is
   universal, and why paged KV exists (allocate in blocks, share prefixes).
   "Long context" is a memory product, not an attention product.
4. Static batching pads to the longest sequence: utilisation `Σlen / (n · max)`.
   Continuous batching admits/retires per step so padding waste goes away, at the
   cost of a scheduler.
5. Speculative decoding: draft `k` tokens cheaply, verify them in one target pass.
   Expected accepted tokens per step is `Σ_{i=1..k} α^i + 1` where `α` is the
   acceptance rate. At `α=0.7, k=4` that is ~2.5 tokens per verification, and
   *outputs are identical to the target model* — the draft only proposes. This is
   the rare optimisation that is free in quality.
6. Cost: `input_price` is cheap because prefill parallelises. `output_price` is
   3-5x higher because decode is serial. Your product's unit economics are
   therefore a function of *output tokens per request*, which is a prompt-design
   and decoding-policy decision (week 5).

## Build (180 min)

`lab.py`:

| Function | Contract |
|---|---|
| `kv_bytes` | `2·L·H_kv·hd·T·bpe` |
| `decode_flops` | cached vs uncached rough FLOPs |
| `padding_waste` | static-batch utilisation |
| `step_cached` | one token with a KV cache; must equal full forward to 1e-9 |
| `spec_expected_tokens` | geometric acceptance sum + bonus |
| `tokens_per_second`, `cost_per_million` | the two numbers your CFO will ask for |

```bash
uv run pytest weeks/w07_serving
uv run python -m weeks.w07_serving.bench   # naive vs cached, same model
```

`bench.py` prints tokens/sec for both paths and the speedup. On the toy model
expect roughly 3-6x for 64 new tokens; the gap widens with context length, which
is exactly the point. Then it prints the KV cache size for a realistic model so
the 64 GB number above stops being abstract.

## Break it (45 min)

1. Cache `q` as well as `k`/`v` and use the cached `q`. Outputs diverge
   immediately. Write one sentence on why: `q` is a function of the current
   position only.
2. Off-by-one the position index (`pos-1`). Attention still runs, output is subtly
   wrong, and no test catches it unless you compare to a full forward pass.
   *This* is why serving bugs are expensive.
3. Compare `padding_waste` for `[512, 512, 512]` and `[512, 8, 8]`. Same batch
   size, wildly different utilisation. Ask what your batch-size metric is
   actually measuring.

## Play (30 min)

Nothing visual. Instead: compute the KV cache for the model you actually use in
production (or the largest one you can afford). Multiply by your concurrency
target. If the number is bigger than your GPU memory, you now understand why GQA
and paged attention exist, and you can price a context-length increase correctly.

## Explain back (60 min)

Answer in 250 words: *our p95 latency doubled after we added retrieval that
injects 4k tokens of context. What dominates, what are the three levers, and
which one would you pull first?* Use prefill/decode and the cache arithmetic.
Wrong answers include "upgrade the model" and "add a cache" (there is one).

## 2026 lens

- **Still true:** decode is memory-bound; the KV cache is the core data structure;
  padding waste is real; output tokens cost more than input tokens.
- **Changed:** continuous batching + paged KV + prefix caching are table stakes
  (a shared system prompt is a cache hit, not a discount). Disaggregated
  prefill/decode is common at scale — separate pools, transfer the cache. FP8 KV
  caches and KV-cache offloading to host memory are standard knobs. Speculative
  decoding is default for latency-sensitive products. Serving frameworks differ
  mostly in scheduling policy now, not in maths.
- **Open:** how far prefix caching and cross-request sharing can go before the
  economics of long context change shape entirely; and whether attention's memory
  bill (rather than its compute) is what finally caps context length.

## Stretch

Implement prefix caching: keep the cache for a fixed system prompt and clone it
for each new request (a deep copy per layer is enough at toy scale). Measure
time-to-first-token with and without it, for a 500-token system prompt and a
5-token user message. That ratio is why every provider now prices cached input
tokens separately.
