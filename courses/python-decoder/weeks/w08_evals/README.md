# Week 8 — Measurement: evals, judges, traces

**Time:** 6h · **Deliverable:** an eval card for your own model, with intervals
**Prereq:** weeks 1–7

## The one idea

Every earlier week produced a number you could not yet trust. An eval is a
measurement instrument, and instruments have bias, variance, and failure modes.
The three questions that separate a real eval from a demo:

1. **What is the estimand?** (capability, reliability, or subjective quality — they
   are three different metrics and they move in different directions)
2. **How uncertain is it?** (a pass rate on 40 items is ±15 points; say so)
3. **Is the benchmark measuring the model or the benchmark?** (contamination,
   judge bias, leakage, overfitting to your own suite)

And the fourth, which is where teams actually fail: **can you see what happened in
production?** Offline evals and production traces disagree, always. The job is to
make the disagreement *visible*, not to declare one of them authoritative.

## Derive (90 min)

1. **pass@k vs pass^k.** pass@k is capability: with `n` samples, `c` successes,
   `P(≥1 success in k) = 1 - C(n-c,k)/C(n,k)`. pass^k is reliability:
   `Π (c-i)/(n-i)`. A flaky model can score >0.99 on pass@5 and <0.1 on pass^5.
   If you ship an agent, pass^k is your metric and pass@k is your ceiling.
2. **Intervals or it didn't happen.** A pass rate is a proportion: with `n` items
   and `p≈0.8`, the standard error is `sqrt(p(1-p)/n)`. For ±3 points at 95%
   confidence you need ~680 items. Most teams eval on 50 and then argue about a
   2-point "regression".
3. **Judges are models too.** An LLM judge is an estimator with known biases:
   position (it prefers the first), verbosity (it prefers longer), and
   self-preference (it prefers its own family). Calibrate with Cohen's κ against
   human labels; raw agreement is useless when one label dominates. A judge that
   always says "pass" is 90% accurate and κ=0.
4. **`β`-careful:** changing the judge, the rubric, or the prompt template is a
   *new instrument*. Re-calibrate or your trend line is fiction.
5. **Contamination.** If 13-grams of your test set appear in pretraining data, the
   number is a memory test. Measure the overlap and report it. Nobody does, and
   that is why benchmark numbers do not transfer.
6. **Observability.** A trace is a span tree: request → retrieval → model call →
   tool call → post-processing. Without per-span token counts, latency, and cost,
   you cannot answer "why was p95 bad" or "which step burned the budget". The
   OpenTelemetry GenAI conventions give you the attribute vocabulary
   (`gen_ai.operation.name`, `gen_ai.usage.input_tokens`, …) so your traces
   compose with everything else — but content capture is opt-in and is a privacy
   decision, not a default.

## Build (180 min)

`lab.py`:

| Function | Contract |
|---|---|
| `pass_at_k` / `pass_hat_k` | the two estimators, exact |
| `bootstrap_ci` | percentile interval, seeded |
| `cohen_kappa` | chance-corrected agreement, degenerate case handled |
| `pearson` | correlation, constant-input safe |
| `judge_report` | κ + correlation + a verdict you can defend |
| `ngram_contamination` | overlap fraction |
| `sample_size` | items needed for a target CI width |
| `regression_gate` | ship / hold / block with an interval on the delta |

```bash
uv run pytest weeks/w08_evals
uv run python -m weeks.w08_evals.report   # an eval card for the model you trained
```

## Break it (60 min)

1. Take your week 4 model and eval it on 20 items instead of 200. Watch the CI
   width swallow the entire difference between two decoding settings. That is not
   a null result; it is an underpowered experiment.
2. Judge your own model's outputs with a rubric of "is this good?" vs a rubric
   with three anchored levels. Compute κ against your own labels both ways. The
   vague rubric will have κ near 0 and you will have learned the most important
   lesson in this course.
3. Contaminate deliberately: put 5 test items verbatim into the "training" set.
   Recompute. Notice that nothing in your pipeline complains — because nothing in
   your pipeline checks.

## Play (30 min)

No explorable. Instead, pull one real trace from anything you operate (or
sketch your last production incident as a span tree on paper). Mark where you
have token counts, where you have latency, where you have nothing. The gaps are
your week 9.

## Explain back (60 min)

Write the eval card for your model in the form you would put in a design doc:

- task, metric, estimand, n, point estimate, 95% CI
- pass@1 and pass^5, with the gap explained
- judge calibration (κ) if a judge was used
- contamination measurement
- cost per 1k requests, p50/p95 latency
- one sentence: "this eval would fail to detect a regression smaller than X"

That last sentence is the one that gets you taken seriously.

## 2026 lens

- **Still true:** proportions need intervals; judges need calibration; contamination
  is endemic; offline ≠ online.
- **Changed:** agentic evals are now the hard part — multi-turn, tool-using, with
  state, where a single task has hundreds of valid trajectories, so grading moves
  from exact match to trajectory-level rubrics and outcome validators. pass^k
  matters more than pass@k for anything with an action loop. Telemetry has
  standardised: OTel GenAI semantic conventions (still "Development" status,
  moved to its own repo) give you `gen_ai.*` attributes, and agent spans for
  planning, tool execution and memory operations. Content capture is opt-in, so
  "we log all prompts" is now a deliberate privacy posture with a threat model —
  trace stores are attacker-controllable text and any model that reads traces is
  a prompt-injection surface.
- **Open:** how to grade long-horizon agent work at all; whether LLM judges can be
  made stable enough to be a primary metric rather than a filter; and how to keep
  a regression suite alive when the model under test changes monthly.

## Stretch

Build a 30-item eval for your week 4 model with three graders: exact match, a
rubric judge (simulated by a deterministic function you write), and a
human-labelled golden set you create by hand. Report all three with κ between
them. Then write down which one you would gate a deploy on and why the other two
still exist.
