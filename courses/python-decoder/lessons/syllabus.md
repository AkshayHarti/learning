---
title: Syllabus
---
# Syllabus

44 hours of core material across 8 weeks, plus a 6–8 hour capstone. Sized for
4–6 hours a week: each week is one "derive" sitting (60–90 min), one "build"
sitting (2–3 h), and one short sitting for break/play/explain.

## Prerequisites

- Python you can write without looking things up.
- Matrix multiply, dot product, softmax as "normalise into a distribution".
- The chain rule. You do **not** need to have implemented backprop; week 4 does it.
- No GPU. No API key. No network after `uv sync`.

## Learning outcomes

By the end you can, without notes:

1. Relate cross-entropy, perplexity, and bits-per-byte, and say which is
   comparable across tokenizers (W1).
2. Train a BPE tokenizer and predict its pathologies before seeing the output
   (W2).
3. Derive scaled dot-product attention from "I need a learned similarity", and
   explain why the `√d` and the causal mask exist (W3).
4. Write and numerically verify an autograd engine, then train a transformer with
   it and diagnose a diverging run from the loss curve alone (W4).
5. Explain why greedy decoding loops, and choose a decoding policy with a
   measurement rather than a preference (W5).
6. Derive the DPO loss, state what `β` controls, and argue when RLVR beats
   preference learning (W6).
7. Compute KV cache size and decode economics for a given model, context length
   and concurrency, and explain why GQA and paged attention exist (W7).
8. Design an eval with a stated estimand, sample size, interval, judge
   calibration and contamination check — and say what regression it cannot detect
   (W8).

## Week-by-week

### W1 — Prediction is compression (5h)
Entropy, cross-entropy, KL, perplexity, bits-per-char. n-gram LM with add-k
smoothing. *Lab:* smoothed n-gram with a perplexity table. *Break:* k=0 → infinite
perplexity; n=6 → overfitting you can see. *Deliverable:* the perplexity table.

### W2 — Tokens are learned, not given (5h)
Byte-level BPE: pair counting, greedy merges, rank-ordered application. Cost and
context arithmetic; digit, unicode and whitespace pathologies. *Lab:* BPE from
scratch. *Break:* make the tokenizer expensive on numbers and code indent.
*Deliverable:* chars/token for three corpora, with an explanation.

### W3 — Attention is differentiable lookup (6h)
QKV as retrieval, `√d` scaling, softmax as mixture, causal masking, multi-head as
subspaces, GQA expansion. *Lab:* softmax, scaled dot-product attention, heads.
*Break:* remove the mask (silent cheating), remove the scale (saturation), remove
`wo` (silent no-op). *Deliverable:* an ASCII attention heatmap from your trained
model, with one head explained.

### W4 — The block, the gradient, the trained model (6h)
Pre-LN residuals, LayerNorm, GELU MLP, parameter arithmetic, Adam + warmup +
cosine. *Lab:* assemble the block so it matches the reference to 1e-10, then
train. *Break:* no residuals / no LN / lr=0.3 / lr=1e-5. *Deliverable:* a
checkpoint on disk and a written diagnosis of one failure.

### W5 — Decoding, and what "thinking longer" buys (5h)
Temperature, top-k, top-p, min-p, ordering, determinism, self-consistency,
test-time compute economics. *Lab:* the samplers. *Break:* the 5×4 grid — find the
loop, find the noise floor. *Deliverable:* the grid, annotated.

### W6 — Post-training (5h)
SFT masking, preference data, RLHF → DPO derivation, `β` as trust region, RLVR +
GRPO, LoRA arithmetic, scaling-law fitting. *Lab:* DPO/GRPO/LoRA/power law.
*Break:* β=0, β=10, zero-variance reward group, fake scaling law. *Deliverable:*
a written post-training plan for a domain with a 96%-accurate verifier.

### W7 — Serving (6h)
Prefill vs decode, KV cache, cache size arithmetic, continuous batching, padding
waste, speculative decoding, cost per million. *Lab:* `step_cached`, proven equal
to full forward. *Break:* cache `q`, off-by-one positions, static batching.
*Deliverable:* the speedup number and the cache budget for a real model.

### W8 — Measurement (6h)
pass@k vs pass^k, bootstrap intervals, sample size, Cohen's κ, judge calibration,
n-gram contamination, regression gates, span-level observability. *Lab:* the
estimators. *Break:* 20-item eval, vague rubric, deliberate contamination.
*Deliverable:* an eval card with intervals and a stated blind spot.

### Capstone (6–8h)
See `CAPSTONE.md`: serve your model with a KV cache, gate a change on an eval
with an interval, and emit a trace per request with token counts, latency and
cost.

## Durable vs perishable, as of 2026

This is the part worth arguing about. The course takes a position: teach the
durable layer deeply, flag the perishable layer explicitly.

**Durable (learn it properly, it will still be true):**
cross-entropy and perplexity; BPE mechanics and cost arithmetic; attention as
learned retrieval and the causal mask; residuals + normalisation + Adam; the KV
cache and the prefill/decode asymmetry; decoding as a policy over a fixed
distribution; eval statistics (intervals, calibration, contamination).

**Perishable (learn the shape, expect it to move):**
exact architecture choices (RMSNorm, RoPE, GQA ratios, MoE router details);
specific sampling defaults (min-p displacing top-k); serving topologies
(disaggregated prefill/decode, prefix caching policies); framework names.

**Genuinely open (hold lightly, reason from first principles):**
whether next-token prediction suffices for reasoning versus needing RL on
verifiable rewards; whether fixed tokenizers survive; whether long context is
solved by architecture or by memory economics; how to grade long-horizon agent
work at all.

If you are deciding what to teach your team, teach the durable column and let
them read the perishable column from release notes.

## Assessment (self or team)

| Artifact | Weight | Bar |
|---|---|---|
| Weekly lab tests green | 30% | your code, not `solutions/` |
| "Explain back" paragraphs | 30% | no jargon you cannot define; numbers where numbers exist |
| Break-it writeups | 20% | predicted before observed; explains the mechanism |
| Capstone | 20% | passes the acceptance criteria in `CAPSTONE.md` |

The "explain back" weight is deliberately equal to the code weight. Code that
works for reasons you cannot articulate is a liability you have just added to
your team's on-call rotation.
