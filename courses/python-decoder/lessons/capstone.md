---
title: Capstone — ship the thing you understand
minutes: 480
---
# Capstone — ship the thing you understand

**Time:** 6–8 hours · **Prereq:** weeks 1–8

The capstone is not a bigger model. It is the smallest complete system that has
the same *shape* as a production LLM service, built from parts you wrote:

```
request ──► tokenizer ──► prefill ──► decode loop (KV cache) ──► detokenize
                  │                        │
                  │                        └──► trace span (tokens, latency, cost)
                  └──► eval gate (interval, not vibe) ──► ship / hold / block
```

## Deliverables

### 1. A cached server (2–3h)

`capstone/serve.py` — a `serve(request) -> response` function over your week 4
model:

- one process, no framework required; a plain function with a CLI is enough
- **prefix cache**: a fixed system prompt's KV cache is built once and reused
  across requests (deep-copy per request at toy scale)
- **batching**: a `serve_batch(requests)` that shares a forward pass and reports
  utilisation using `padding_waste` semantics
- **sampling policy** exposed as parameters, with the order documented

Acceptance criteria:

- [ ] `serve` output is token-for-token identical to `generate()` for the same
      seed and settings (prove it in a test)
- [ ] time-to-first-token with a warm prefix cache is measurably lower than cold,
      and you report both in ms
- [ ] `serve_batch` beats `serve` per request, and you report the utilisation
      number that explains why
- [ ] every response carries `{n_input_tokens, n_output_tokens, ttft_ms,
      total_ms, usd}`

### 2. An eval gate (2–3h)

`capstone/gate.py`:

- 30+ items, each with a prompt and an automatic check
- `pass@1` and `pass^5` (they will differ; explain the gap in one sentence)
- a bootstrap 95% CI on the difference between your baseline and your candidate
- a decision: `ship` / `hold` / `block`, using week 8's `regression_gate`
- a written statement: *"this gate cannot detect a regression smaller than X"*

Acceptance criteria:

- [ ] the gate blocks a deliberately-broken variant (e.g. temperature 2.0, or a
      tokenizer that drops whitespace) and says so with an interval
- [ ] the gate returns `hold` on an underpowered comparison, and you do not
      override it by hand
- [ ] contamination is measured and reported (week 8's n-gram check)

### 3. A trace (1–2h)

`capstone/trace.py`: one JSON span tree per request, with per-stage timing:

```json
{"trace_id": "...", "spans": [
  {"name": "tokenize", "ms": 0.3},
  {"name": "prefill",  "ms": 12.1, "gen_ai.usage.input_tokens": 64},
  {"name": "decode",   "ms": 210.4, "gen_ai.usage.output_tokens": 48},
  {"name": "evals",    "ms": 0.9}
]}
```

Use the OpenTelemetry GenAI attribute names where they exist
(`gen_ai.operation.name`, `gen_ai.usage.input_tokens`,
`gen_ai.usage.output_tokens`, `gen_ai.provider.name`) so your spans would survive
contact with a real collector. Two rules that matter more than the schema:

- content (prompt/completion text) is **opt-in**, off by default
- anything that reads traces back into a model is untrusted input; say so in a
  comment, because it is a prompt-injection surface

Acceptance criteria:

- [ ] p50 and p95 for `ttft_ms` and `total_ms`, computed from your own traces
- [ ] cost per 1k requests, computed from token counts, not estimated
- [ ] one paragraph: which span you would look at first if p95 doubled, and why

### 4. The memo (1h)

One page, addressed to your team, answering:

1. What did you build, in one diagram and two sentences?
2. What did you measure, with intervals?
3. What would break first at 100x traffic — and what is the arithmetic that says
   so? (Cache memory, batch utilisation, or output-token cost. Pick one, show the
   number.)
4. What did you learn that contradicts what you believed in week 1?

Question 4 is the assessment. "Nothing" is a fail; the course is designed so that
almost everyone has at least one belief punctured — usually "attention is the
expensive part" (it is the memory) or "temperature controls correctness" (it
controls the tail you keep).

## Stretch (only if the core is done)

- Swap in RoPE and re-run your eval. Report the delta or the absence of one.
- Add speculative decoding with your own tiny draft model (a 1-layer copy that
  shares the tokenizer). Verify identical outputs, measure the speedup at
  acceptance rate α, and check it against `spec_expected_tokens`.
- Add a judge grader calibrated against 30 of your own hand labels. Report κ. If
  κ < 0.4, say so and keep the exact-match gate as primary — that decision is
  the deliverable, not the judge.

## What "done" looks like

A repo where someone else can read `serve.py` in five minutes, run one command to
get an eval card with intervals, and find the trace for a given request. It is
small. It is measured. Every number has a denominator and an interval. That is
the difference between an engineer who uses LLMs and one who can be trusted with
them.
