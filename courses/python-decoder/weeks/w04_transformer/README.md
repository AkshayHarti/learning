# Week 4 — The block, the gradient, the trained model

**Time:** 6h · **Deliverable:** a trained model on disk, and a loss curve you can explain
**Prereq:** weeks 1–3

## The one idea

A transformer block is a *residual stream* with two insertions: attention (moves
information between positions) and an MLP (processes each position
independently). Both are added, not assigned, so gradients flow straight down the
stream. That is why deep stacks train at all, and why removing residuals breaks
training in a way that looks like a bad learning rate.

Backprop is the chain rule applied mechanically — you already wrote the engine in
`mygpt/tensor.py`. This week you verify it numerically, then use it.

## Derive (90 min)

1. `x = x + f(LN(x))` — pre-norm. The `+` is the whole trick: the identity path
   has gradient 1, so the signal reaches layer 0 from layer 40.
2. LayerNorm normalises across features per token. It removes scale ambiguity, so
   the optimiser sees a well-conditioned surface. Gamma/beta restore expressivity.
3. The MLP is `C → 4C → C` with a nonlinearity. Read it as a key-value memory:
   the first matrix picks features, the second writes them back.
4. Parameter count: `12C² + 13C` per layer plus embeddings. Check it against
   `model.num_params()` — a mismatch means you do not yet understand your own
   model, and that is worth 10 minutes now instead of an afternoon later.
5. Why does cross-entropy train so well? Its gradient with respect to logits is
   `softmax(z) - onehot`, bounded in `[-1, 1]`. No exploding gradients from the
   loss itself. Everything else is normalisation, residuals, and the schedule.

## Build (180 min)

`lab.py`:

| Function | Contract |
|---|---|
| `layernorm_forward` | matches `mygpt`'s layernorm exactly |
| `gelu` | tanh approximation |
| `causal_attention` | projections, heads, mask, softmax, merge, `wo` |
| `mlp` | `ln → w1 → gelu → w2` |
| `block_forward` | two residuals, in the right order |
| `param_count` | closed form, must equal `GPT.num_params()` |
| `train_tiny` | returns a model that actually learned something |

The test that matters: `test_block_matches_reference_model` assembles a 1-layer
GPT by hand and compares logits to `GPT.forward` to 1e-10. If that passes, your
understanding and the reference agree, and you can now safely modify the
architecture — which is the entire point of having written it yourself.

```bash
uv run pytest weeks/w04_transformer          # your lab
SOLUTION=1 uv run pytest weeks/w04_transformer  # reference, if stuck
uv run python -m weeks.w04_transformer.train_run
```

## Break it (60 min)

Four experiments, each ~2 minutes of training. Predict first, then run:

1. **Remove the residuals** (assign instead of add). Loss plateaus high.
2. **Remove LayerNorm.** Diverges or crawls — and the *reason* differs with lr.
3. **Set lr = 0.3.** Watch loss spike then go to `nan`. That is your first
   real diverging run; knowing its shape matters.
4. **Set lr = 1e-5.** Loss decreases so slowly it looks broken. This is the most
   common production failure: nothing is on fire, nothing is working.

Write down which one you would have misdiagnosed. That is the valuable output
here, not the loss curve.

## Play (30 min)

Re-run `weeks/w03_attention/heatmap.py` against the model you just trained. Then
look at the loss curve in `train_run.py` output: the first 50 steps are warmup
(lr ramps), then it drops fast, then it flattens. You should now be able to
explain all three phases without looking anything up.

## Explain back (60 min)

Write the "what would I tell my team" paragraph: *which five things about LLM
training would a competent backend engineer get wrong on their first try?* Your
answer should include at least: schedule/warmup, normalisation placement,
residuals, batch-size/lr coupling, and data ordering.

## 2026 lens

- **Still true:** pre-LN residuals, GELU MLPs, Adam + warmup + cosine, tied
  embeddings. The 2019 recipe still trains.
- **Changed:** RMSNorm instead of LayerNorm (cheaper, no mean subtraction), RoPE
  instead of learned positions, MoE layers replacing some MLPs (sparse activation:
  same FLOPs per token, many more parameters), and FP8/FP4 training on hardware
  that supports it. Every one of those is a small edit to the file you just wrote.
- **Open:** how far the "same block stacked deeper" recipe goes before something
  qualitatively different is needed. Also open: whether MoE routing and long-context
  attention make the *dense* transformer a legacy architecture.

## Stretch

Replace one MLP with a 4-expert top-2 MoE in your own code: route by a linear
gate, softmax over experts, take top-2, weight their outputs. Report parameter
count versus active parameters per token. You have just implemented the reason
frontier models are described by two numbers instead of one.
