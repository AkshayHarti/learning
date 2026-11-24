# Decision Models — research brief and interactive curriculum

Status: **Acts I–II built** (`decision-course.html`, steps 01–10, verified in Chrome
at 320px and 1440px, console clean). Act III is specified below and not yet built.
Sits alongside `course.html` (the LLM course) as a second track.
Written 2026-11-21. Vendor claims are as of that date.

---

## 1. What changed while we weren't looking

Jev stopped being a curiosity. Between 15 Sep and 11 Nov 2026 the "typed decision"
idea went from one startup's API to an interface that three hyperscalers ship and
every major inference stack serves:

| | TypeSafe | Google | Microsoft |
|---|---|---|---|
| Model | Jev 1.14 (`jev-1.14.0`) | Gemini Decision 1 (`gemini-decision-1`) | Microsoft-Decision-1.1 |
| Shipped | 15 Sep 2026 | 11 Nov 2026 | GA, docs updated 17 Nov 2026 |
| Endpoint | `POST /v1/systemone` | `client.decisions.create` (SDK); `/v1/systemone`, `/v1/decisions` via LiteLLM/OpenRouter | `POST {endpoint}/providers/microsoft/v1/systemone` |
| Request | `state` + `questions` | `input` + `questions` | `state` + `questions` (± `assets`) |
| Primitives | `noul` `choice` `score` `box` | `noul` `choice` `score` | `noul` `choice` `score` |
| Options per question | ≤ 255 | 2–255 | not stated |
| Questions per call | many, parallel | up to 1,000 | many, parallel |
| Input | text, images | text, image, audio, video, PDF | text, JSON, images |
| Context | 64k/request, 32k/question (262k with header) | 256k tokens | not stated |
| Price | $0.042 / Mtok in, output free | $0.10 / Mtok in, output free | per Foundry deployment |
| Latency (vendor) | 70–500 ms | 150–250 ms e2e, 50–100 ms compute | not stated |

**The headline for a course: the three are the same API.** Not similar — identical
primitive names, identical `criteria` shapes, identical answer payloads. Microsoft
even uses TypeSafe's path. Google's docs describe `noul` exactly as TypeSafe does.
That convergence in eight weeks is the single most teachable fact in this space,
because it means the interface is now a stable thing to learn once.

And it isn't only the hyperscalers. Served behind the same route today:

- **Serving/inference:** vLLM, SGLang, LM Studio, LiteLLM, OpenRouter.
- **Open models with documented readouts:** Laya (ModernBERT-large), Open-Jev
  (DeBERTa-v3-large), this-that-model-1.0 (1.88B, 30 ms, Apache-2.0), JevLite
  (Qwen3-4B LoRA), Visual Jev, PixelJev, SemIf-4B, Qwen3-0.6B-RLCD.
- **Local engines:** `decision-cascade` (Apache-2.0, Noul/Choice/Score + ECE/Brier).

So the syllabus is no longer "learn Jev." It is: **learn the decision interface, the
statistics that make its output usable, and the ways it fails.** Vendor-neutral, with
Jev/Google/Microsoft as the three worked examples.

### The rest of the field (added 2026-11-21, after further research)

The three-hyperscaler table is the spine, but it is not the market. Two more vendors
ship the same interface, and the open-weight side is larger than the commercial side.

**Commercial, same request shape:**

| | Cloudflare | Inception |
|---|---|---|
| Model | Clef (`@cf/cloudflare/clef`), Clef-flash | Mercury Decide (`mercury-decide`) |
| Shipped | announced with a public RL fine-tuning platform | 30 Sep 2026 |
| Access | Workers AI (`env.AI.run`), REST | OpenRouter, `POST /v1/decisions` |
| Shape | `state` + `questions{type,instructions,criteria}` | same; OpenRouter documents it as "the same `/v1/systemone` schema as Jev" |
| Primitives | `noul` `choice` `score` | `noul` `choice` `score` |
| Size / context | 27B multimodal, 65,536 tokens | 65,536 tokens |
| Input | text, JSON, images, video | text, images |
| Price | **$0.24 / M input**, output free | ~$0.02 / M input, output free (secondary listing) |
| Throughput | Workers AI fleet | up to 14 decisions/s |
| Openness | **open-source models** | closed |

That price column is the most useful fact in this table. The same interface, the same
primitive names, the same ~64k context, and an **order of magnitude spread** in price
($0.02 → $0.24 / M). Which means the interface is commoditised and the differentiation
is calibration, throughput, modality, and hosting — exactly the things Act II and
Act III are about. A course that teaches "call the endpoint" ages badly; a course that
teaches "measure the calibration, then choose" does not.

**Open weights, documented readout:**

- **Laya** — `convaiinnovations/laya`, ModernBERT-large, 421M, 512-token context,
  Apache-2.0. Family: base, `laya-multilingual`, `laya-typed-decisions`.
- **this-that-model-1.0** — `flock-io/this-that-model-1.0`, 1.88B, ~31 ms/decision,
  Apache-2.0; answer read from a hidden state at a designated position, restricted to
  the option set; trained on cross-entropy + Brier.
- **Open-Jev** — DeBERTa-v3-large, pooled name+definition readout.
- **JevLite** — Qwen3-4B LoRA; **Visual Jev**, **PixelJev** — multimodal variants;
  **SemIf-4B**; **Qwen3-0.6B-RLCD**.
- **decision-cascade** — `slavabars/decision-cascade`, Apache-2.0; Noul/Choice/Score
  plus ECE/Brier in one small package.

**Research corpus:** `Oscar-dzy/Awesome-jev-papers` indexes **403 entries / 390
papers** as of 2026-11-20 (CC0). The field is not a vendor marketing page; it is a
literature with its own replication and audit culture — which is why sections 3 and
"calibration errors go both ways" can cite audits that contradict vendor cards.

**What this changes in the curriculum:**

1. Step 14 is no longer "Jev vs Google vs Microsoft." It becomes *"the same body,
   five backends — what actually differs?"* The answer is calibration, price,
   throughput and modality; the schema is identical.
2. A new Act III lab: send one request body to three backends (documented shapes,
   no live network — the response fixtures are in-repo and cited) and compare
   `confidence` on the same case. The lesson is that the number is not portable.
3. The open models are the *default* for the calibration labs, because their weights
   and readouts are public and auditable. The commercial ones are the worked examples
   of the interface.
4. Any "which model is best" claim is out of scope. The audits disagree in both
   directions — Jev over-confident, Laya's shipped checkpoint under-confident per an
   independent audit while its own card says over-confident — so the course teaches
   *measure your own*, with those two as the cautionary pair.


## 2. Why this is a different subject from the LLM course

An LLM course teaches a loop that emits tokens. A decision-model course teaches a
call that returns a distribution you must *act on*. None of the hard parts overlap:

| LLM course | Decision-model course |
|---|---|
| attention, KV cache, sampling | calibration, cost matrices, thresholds |
| why it hallucinates | why it is confidently wrong at 0.91 |
| tokenization, embeddings | option names, definitions, closed support |
| temperature as creativity | temperature as a *post-hoc calibration* knob |
| prompt engineering | question/criteria engineering |
| one long generation | N independent judgments, one pass |

The prerequisite is real, not decorative: you need to know that a logit is not a
probability and that softmax renormalises, which the LLM course already teaches.

## 3. What the evidence actually supports

From the 28-paper early audit (*Typed Decision Models: An Early Evidence Audit and
Evaluation Checklist*, arXiv 2609.32160) and the individual studies:

1. **The typed readout has not shown an independent accuracy advantage.** Every
   controlled comparison against a label-probability readout on the same backbone
   lands within noise (AUROC .974 vs .950; macro-acc .761 vs .761). The gain is
   latency, cost, and shape — not accuracy.
2. **Parity claims cluster on saturated tests.** 100/100, 63/63, 212–216/216.
   On discriminating benchmarks the hosted model trails by 5–20 points.
3. **Latency/cost gains are real but context-dependent.** Caching erased a 16–27%
   latency win in one study; the same group reported Jev 70% cheaper in one paper
   and 1.7× *more* expensive per call in another, on different workloads.
4. **Calibration is per-model, per-workload.** Pooled ECE .047 but median
   per-benchmark ECE .168 in the same study. One temperature parameter was enough
   for some cheap LLMs to overtake the decision model.
5. **Confidence-based escalation is the deployment pattern**, and its value depends
   entirely on error *complementarity*. When the stronger model repeats the first
   stage's errors, the cascade gains ~1.5 points.
6. **Option names are part of the model.** Swapping which definition is bound to
   which yes/no *name* moved decision-flip rates by up to 70 points and AUC from
   .938 to .232 — with a 0% type-error rate. Type safety ≠ correctness.

Point 6 is the centrepiece of the course, because it is the one failure that looks
impossible until you see it, and it is reproducible in a lab in twenty lines.

## 4. The course

Sixteen steps, three acts. Every step has one live lab. No network, no keys, no
build step — the engine is a real (small) model running in the page.

### Act I — The interface (steps 1–5)

**01 · A decision model is not a text generator**
State in, one distribution per question out. Same input, two boxes side by side: a
n-gram generator emitting tokens, a decision model emitting probabilities. Nothing
is sampled; the distribution *is* the answer.
*Knob:* the state text. *Readout:* the bar chart redrawing, no tokens appearing.
*Kills:* "it's a small LLM." *Source:* System One docs, Thoughtworks.

**02 · Three primitives, and when each is wrong**
`noul`, `choice`, `score` on one state. Then break each: a `choice` over an ordered
scale throws away the order; a `score` over unordered labels invents one; a `noul`
loses the third case.
*Knob:* question type. *Readout:* answer shape, and the expected value that a
`choice` cannot produce. *Kills:* "pick the type you like."
*Source:* primitives docs; Microsoft's "score returns the probability-weighted
average of level indexes."

**03 · The question is the model**
Nothing about the model changes; only `instructions` and `criteria` move. Edit the
criteria text and watch the distribution shift. Then the hard one: keep the
definitions identical and change only the option *names*.
*Knob:* instruction text, criteria text, option names. *Readout:* probabilities,
plus a flip-rate counter over a fixed 40-example set.
*Kills:* "the label is cosmetic." *Source:* arXiv 2609.26758 (AUC .938 → .232,
0% type-error rate).

**04 · Reading a distribution**
Six numbers computed live from the same bars: argmax, expectation, max-probability,
margin (p1 − p2), entropy, and the vendor's own `confidence` formula. They disagree,
and the lab makes them disagree on purpose.
*Knob:* option count *n*, distribution shape. *Readout:* all six, plus which one
crosses a threshold first. *Kills:* "confidence is new information." It is a
monotone transform of p_max for fixed *n*. *Source:* TypeSafe confidence docs.

**05 · One pass, many questions**
Ask 1, 10, 100 questions about one state. Watch cost and latency stay nearly flat
while serial calls scale linearly. Then ask two questions where the second depends
on the first, and watch it break.
*Knob:* question count, serial vs parallel. *Readout:* latency/cost curve; then an
error banner: "questions are independent."
*Kills:* "I'll just chain them in one request." *Source:* Google ("nearly flat from
1 to 100 questions"), TypeSafe patterns (speculative fan-out).

### Act II — The statistics (steps 6–10) — built

**06 · Calibration**
Two heads, one procedure. A reliability diagram, ECE and Brier on the router's 40
held-out tickets, then on the refund head's 44 replies. Fit temperature: the router
sharpens (T = 0.53, ECE 0.130 → 0.032) and the refund head comes back unchanged
(T = 0.99, ECE 0.034 → 0.033). Accuracy is identical at every T by construction.
Which direction the correction runs is measured, not assumed — and no scalar can
repair a rubric whose levels overlap (step 02's tone head).
*Knob:* temperature, which head. *Readout:* reliability plot, ECE, Brier, log loss,
fitted T, and two curves (ECE and log loss against T) that do not have to agree.
*Kills:* "softmax output is a probability" and "temperature scaling fixes calibration."
*Source:* Guo et al., temperature scaling; arXiv 2609.32160 §5.

**07 · A scoring rule is not accuracy**
Accuracy, Brier and log loss over the same 40 cases as T moves. Accuracy reads 90.0%
in every row. The worst single case costs 3.85 nats at T = 0.3 and 1.60 at T = 3,
while even the cheapest case costs 0.148 at T = 3.
*Knob:* temperature. *Readout:* the three metrics, plus the most and least expensive
case with its text and true class. *Kills:* "90% accurate is a statement about risk."
*Source:* Brier (1950); Gneiting & Raftery, proper scoring rules.

**08 · A threshold is a policy**
44 refund replies, 22 positive. Expected cost at every threshold, with the analytic
optimum c_FP/(c_FP+c_FN) drawn against the empirical argmin. At 1:20 the analytic
optimum is 0.048 and the empirical one is 0.12; at 1:1 they meet near 0.45.
*Knob:* cost of a false positive, cost of a false negative. *Readout:* cost curve,
argmin, confusion counts, probability strip with the cut drawn. *Kills:* "0.5 is the
threshold." *Source:* selective classification / reject option; Microsoft's guidance
on setting thresholds from the two error costs.

**09 · Cascades**
A keyword table (87.5%) and the learned router (90.0%) measured on the same 40
tickets. The disagreement cells: cheap-only 3, router-only 4, both-wrong 1. The
cascade reaches 95.0% at 25% escalation; the cost index prints the price of every
operating point.
*Knob:* escalation threshold, router cost. *Readout:* disagreement counts,
cascade accuracy, coverage, kept vs escalated accuracy, cost index.
*Kills:* "a cascade is free accuracy." *Source:* arXiv 2609.26550 (92.5 vs 93.1 at
57% of fee); 2609.32160 finding 5 (~1.5 pts when errors correlate).

**10 · Slices and traffic mix**
Per-queue accuracy, mean confidence and signed gap, plus pooled ECE under a
reweighted traffic mix. The model is fixed. The pooled number moves (0.130 → 0.198
at 6× technical share) while the worst slice stays at −0.266.
*Knob:* technical share of traffic, temperature. *Readout:* per-queue table, pooled
ECE, worst-slice gap, "model changed? no". *Kills:* "its ECE is 0.03" as a portable
claim. *Source:* arXiv 2609.32160 §7.4 (median per-benchmark ECE 0.168 vs pooled
0.047 in the same study).

### Act III — Building with it (steps 11–16)

**11 · Decomposition**
One vague question ("what should we do with this ticket?") versus five atomic ones
(team, severity, repeat-contact, refund-promised, language). Same state, both
pipelines. The atomic version is more accurate *and* cheaper, and the lab shows the
error arithmetic that makes it so.
*Knob:* pipeline shape (1-wide vs 5-wide vs chained). *Readout:* end-to-end
accuracy with per-stage contribution; cost. *Kills:* "one big question is simpler."
*Source:* companion-noul and fan-out patterns; controller role in 2609.32160 §4.

**12 · Ground truth is the bottleneck**
Label noise, prevalence, and a deliberately mislabelled class. Watch ECE and Brier
respond to label error while accuracy barely moves — then see a threshold chosen on
bad labels fail on clean ones.
*Knob:* label-noise rate, prevalence, holdout split. *Readout:* confusion matrix,
ECE, threshold transfer. *Kills:* "calibration is a training problem."
*Source:* 2609.32160 finding 6; the 4.8%-vs-2.7% prevalence overstatement.

**13 · Evaluating one properly**
The 14-item checklist as a live form: press "audit" and it grades a sample
evaluation. Then run the actual harness: Brier, log loss, per-class ECE, agreement,
three repeated runs for stability, and an option-order permutation test.
*Knob:* which checks run; repeats; permutations. *Readout:* scorecard with the
failing items named. *Kills:* "accuracy is the metric."
*Source:* 2609.32160 §6 checklist; nondeterminism (≤1.33% flips between identical runs).

**14 · The same request, three vendors**
A request builder. Fill in state, questions, criteria; it emits the TypeSafe body,
the Google `input`/`questions` body, and the Microsoft `state`/`assets`/`questions`
body side by side, plus the `curl` for each. Then the capstone: a full ticket-triage
workflow — classify → route → score → gate — with every knob from steps 1–13 on one
panel and a trace from state to decision.
*Kills:* "vendor lock-in starts at the API." It doesn't; it starts at the eval set.

**15 · Everything is a renormalisation** *(moved from Act II — not built)*
Add an option, remove one, ask 300 options instead of 3. Probabilities redistribute.
Above 255 the vendor switches to two-stage scoring, and the argument order starts to
matter.
*Knob:* option set, option count, order. *Readout:* the full bar chart, normalised;
a warning at 255. *Kills:* "adding an option is additive."
*Source:* TypeSafe limit + two-stage procedure; arXiv 2609.32160 §3.5 (unmeasured).

**16 · Shift** *(moved from Act II — not built)*
Train-once-then-change-the-world: a drift slider moves the input distribution, option
definitions get stale, a tool list gains a member the model never learned. Calibration
decays before accuracy does.
*Knob:* drift, staleness, unseen option share. *Readout:* accuracy (slow to fall) vs
ECE (fast to rise). *Kills:* "calibration is a property of the model."
*Source:* arXiv 2609.32160 §7.4.

### The assessment (built)

`assessment.html` answers "how do I know what I learned" without testing recall.
Three levels are separable, and only two are worth grading:

1. **Recall** — "what does `noul` return?" Cheap to memorise, proves nothing.
2. **Discrimination** — can you tell apart two situations that look identical? This
   is what the course trains, so every one of the 18 items is a discrimination item.
   Six concepts × three: the interface, options & wording, reading the output,
   calibration & scoring, thresholds & cost, cascades & slices.
3. **Transfer** — can you commit under asymmetric cost? Three scenarios: set the
   refund gate at 1:50, decide whether to buy the second model, and challenge a
   vendor's ECE claim. Each reveals its arithmetic only after you commit.

Design rules that keep it honest:

- Every quoted number is read from `window.DEC` at load, so an item cannot drift away
  from the labs. The 1:50 scenario calls `bestThreshold(1, 50, 1)`, not a literal.
- Each item states why the correct answer is correct **and** why the tempting wrong
  one is tempting. On this subject the wrong answers are designed to look right.
- Scenario 2's fourth option ships the right thing for the wrong reason (the cascade
  wins on complementarity, not on the router being better). Right action, wrong causal
  claim is marked wrong, because the reason is what transfers.
- The scorecard bands on the 18 items only — 15+ "you can run this", 9–14 "operating
  knowledge with one weak area named", below 9 "re-read these two steps". The three
  scenarios are reported separately as decision quality. A score on 18 items is a
  diagnostic, not a qualification: no timer, no login, no certificate.
- Progress persists in `localStorage('decfp.assess.v1')`, including the scenario
  picks, so a half-finished run is recoverable. The reset button clears it.

---

## 5. How "live parameter change → live result" actually works

The engine must be honest, or the calibration lesson is a lie. Design:

- **Model:** per-option logistic scorer. `score(option) = w · feats(state, name, definition)`,
  then softmax over the declared options. This is the documented readout geometry of
  Laya and Open-Jev (pooled representation over option name + definition), not an
  invention. Because the option *name* is in the feature string, renaming an option
  changes the answer with the definition held fixed — step 03 reproduces the
  published result rather than asserting it.
- **Features:** hashed word unigrams/bigrams with a small stemmer, plus state×option
  interaction terms (a token shared by state and option is worth more than a token
  that only one has), a bias and a length term. 8,192 hashed dims; state-only
  unigrams are deliberately **not** emitted, because they are constant across
  options for a given state and cancel in the softmax — pure cost, no gradient.
- **Training:** fit on an embedded, hand-written corpus at page load: 40 base tickets
  × 6 deterministic slot variants = 240 for the router, 44 refund replies, 32 tone
  sentences. Deterministic seed, shuffled epochs, Adam, L2. The 40 base tickets are
  held out **entirely** — no lesson ever reports train-set accuracy.
- **Calibration:** temperature fitted at load time on a separate held-out split by
  minimising NLL. Step 06 lets you move T back to 1 and forward to the fitted value,
  so you can see what the fit removed — and what it did not. The router moves
  (0.130 → 0.032); the refund head, already honest, does not (0.034 → 0.033).
  The direction of the correction is an empirical result, not a rule.
- **Why step 06 does not use the tone head:** its holdout is 7 sentences. An ECE
  computed there is exactly the kind of number this course tells you not to trust,
  so the calibration lab uses the two heads with 40 and 44 held-out cases. The tone
  head still carries the score-primitive lesson in step 02, where 7 examples are
  enough to show a shape and no calibration claim is made.
- **Decision layer:** separate module that owns the cost matrix, thresholds,
  abstention, escalation and the cascade arithmetic. The model never sees it — that
  is the course's point in one sentence. It exposes `byClass`, `binaryPreds`, `sweep`,
  `bestThreshold`, `tempCurve`, `cascade` and the keyword `heuristic`, all computed
  from the same held-out sets the lessons use.
- **No sampling.** Every readout is a deterministic function of the inputs, which
  makes the labs reproducible and makes "why did it change?" answerable.

Costs/latencies in steps 05, 08 and 14 are a **stated model**, not measurements:
a per-token price, a fixed per-request overhead, a per-question marginal. The lab
labels them as such and exposes the parameters so the arithmetic is inspectable.

## 6. Files

```
explorables/
  decision-course.html          shell: nav, hash router, 10 sections (Acts I–II)
  assessment.html               shell: the 18-item diagnostic + 3 scenarios
  assets/
    dec-engine.js               featuriser, trainer, softmax, temperature, metrics,
                                three fitted heads (router / refund / tone), plus the
                                Act II statistics and the keyword baseline
    dec-labs.js                 renderers for steps 01–05
    dec-labs-2.js               renderers for steps 06–10 (statistics)
    dec-course.js               the lessons: copy + lab wiring + hash router
    dec-assess.js               item bank, grading, scorecard, the three scenarios
    dec.css                     lab chrome only; design tokens come from style.css
    dec-assess.css              .q-* option cards, verdicts, scorecard
  index.html                    three cards (decoder, decision, assessment)
```

Reuses `assets/style.css` tokens and `assets/course.css` shell (`.c-shell`,
`.c-nav`, `.c-head`, `.c-lab`, `.c-pager`), plus `assets/labs.js` for its DOM
helpers (`h`, `bars`, `slider`, `lineChart`, `frame`). No new dependencies, no
build step, no network — same contract as the existing files.

The engine fits **three** small heads at load time, not one: routing (5 options),
refund `noul` (2 options), tone `score` (4 levels). One model cannot answer all
three question types, and pretending otherwise was the first bug found while
building — a routing model asked "how angry is this?" returns a uniform
distribution, which is the honest answer and not a lesson.

## 7. Build phases

| Phase | Delivers | Done when |
|---|---|---|
| 1 ✅ | `dec-engine.js` + a headless test page | fit → predict → calibrate is correct at T=1 and T≠1; Brier/ECE match hand arithmetic. **Done:** three heads, temperatures 0.53 / 0.99 / 1.82; router ECE 0.130 → 0.032 after fitting |
| 2 ✅ | steps 01–05 | every knob changes its readout; 320px and 1440px clean; console clean. **Done:** option rename takes 90.0% → 7.5% with 38/40 flips; distractor options move confidence 0.827 → 0.695 while p_max moves 0.862 → 0.723 |
| 3 ✅ | steps 06–10 | reliability, cost and cascade plots are all real, not decorative. **Done:** router ECE 0.130 → 0.032 at T\*; refund 0.034 → 0.033 (nothing to fix); threshold argmin 0.12 at 1:20 and 0.45 at 1:1; cascade 95.0% at 25% escalation, from 87.5% + 90.0% with 3/4/1 disagreement; pooled ECE 0.130 → 0.198 at 6× technical share with the model fixed. Verified at 320px and 1440px, console clean |
| 3b ✅ | `assessment.html` — 18 items + 3 scenarios | every item is a discrimination, not a definition; each miss links to the step; console clean at 320px and 1440px over `http://` and `file://`. **Done:** 18 items across six concepts, scenario 1 reproduces the lab (0.159 / 22 caught / 7 reviews at 0.12), scenario 2 marks "right action, wrong reason" wrong, scenario 3 re-derives pooled ECE 0.032 → 0.104 at the fitted temperature with a mix slider |
| 4 | steps 11–14 + landscape lab | capstone trace works end to end; the same request body against three documented backends |
| 5 | steps 15–16 (renormalisation, shift) | move an option set and a traffic mix, and show ECE moving before accuracy |

Measured engine numbers (all computed at load, deterministic):

| head | options | n held out | accuracy | ECE at T=1 | fitted T | ECE at T\* |
|---|---|---|---|---|---|---|
| router | 5 | 40 | 0.900 | 0.130 | 0.53 | 0.032 |
| refund | 2 | 44 | 0.886 | 0.034 | 0.99 | 0.033 |
| tone | 4 | 7 | 0.714 | — | — | — |

Supporting numbers the Act II labs print:

| quantity | value |
|---|---|
| router ECE, 6× technical share | 0.198 |
| worst router slice gap | technical, −0.266 |
| refund cost/case at 1:20, threshold 0.5 → argmin | 1.409 → 0.159 |
| refund promises caught at argmin | 22 / 22, for 7 needless reviews |
| keyword table vs router accuracy | 87.5% vs 90.0% |
| disagreement cells (cheap-only / router-only / both-wrong) | 3 / 4 / 1 |
| cascade at 25% escalation | 95.0% |

The tone head is deliberately excluded from the calibration figures: 7 held-out
sentences is not a calibration set. That is a design decision, not an omission, and
it is recorded here so nobody "fixes" it by quoting an ECE over seven cases.



## 8. Open questions

1. **Placement.** `llm-first-principles` is named for LLMs. A decision-model course
   fits the *explorables* contract perfectly but not the repo title. Keep it here, or
   spin a sibling repo?
2. **Vendor balance.** Resolved in §1: five commercial backends share the schema, so
   step 14 becomes "same body, many backends — what differs?" (calibration, price,
   throughput, modality) rather than one vendor per step. The open models carry the
   calibration labs because their readouts are auditable.
3. **Numbers.** Do we pin to "as of Nov 2026" and let it age, or write vendor-neutral
   and keep the specific numbers in a collapsible "sources" block?
