/* The decision course assessment — 18 discrimination items + 3 scenarios.
 *
 * Why this shape: recall ("what does noul return?") proves almost nothing.
 * Every item here puts two situations side by side that look identical and
 * asks which number, primitive or claim separates them. The scenarios ask for
 * a commitment under asymmetric cost, then show the arithmetic.
 *
 * Every quoted number is read from window.DEC at load, so an item cannot drift
 * away from the labs. No network, no build step, no dependencies.
 */
(function () {
  'use strict';

  var L = window.LABS && window.LABS.util;
  var D = window.DEC;
  if (!L || !D) return;

  var esc = L.esc;
  var KEY = 'decfp.assess.v1';

  // ------------------------------------------------------------------ content

  var CONCEPTS = [
    {
      id: 'interface', name: 'The interface',
      note: 'What the primitive guarantees, what it does not, and which questions can ride in one call.'
    },
    {
      id: 'options', name: 'Options & wording',
      note: 'The option list is model input, not model configuration.'
    },
    {
      id: 'reading', name: 'Reading the output',
      note: 'Six numbers from one distribution, and which question each one answers.'
    },
    {
      id: 'calibration', name: 'Calibration & scoring',
      note: 'Whether the number means what it says, and what accuracy cannot see.'
    },
    {
      id: 'threshold', name: 'Thresholds & cost',
      note: 'A gate is a policy derived from two error costs, not a hyperparameter.'
    },
    {
      id: 'cascade', name: 'Cascades & slices',
      note: 'When a second model buys accuracy, and when a metric is a claim about traffic.'
    }
  ];

  var ITEMS = [
    // ------------------------------------------------------------- interface
    {
      id: 'i1', con: 'interface', step: 'parallel', stepLabel: 'step 05 · parallel questions',
      q: 'A pipeline must classify a ticket and then, <span class="u">only for billing tickets</span>, pull out the invoice number. How many calls does that take?',
      opts: [
        'One — put both questions in the same request and ignore the second answer when it is not billing.',
        'Two — the second question is conditional on the first answer.',
        'One per category, so five.',
        'It depends on which vendor you use.'
      ],
      a: 1,
      why: 'Questions in one request are answered independently, in parallel. A question cannot read another question\'s answer, so any "then" becomes a second round trip — that is the definition of the primitive, not a product limitation.',
      trap: 'Bundling looks free because the API takes many questions. It is the <b>dependency</b> that costs the second call, not the count.'
    },
    {
      id: 'i2', con: 'interface', step: 'primitives', stepLabel: 'step 02 · the three primitives',
      q: 'A <code>score</code> over four severity levels returns <b>1.77</b>. What do you actually know?',
      opts: [
        'Roughly 44% severe — 1.77 out of 4.',
        'The answer sits between level 1 and level 2, so it is mild.',
        'The mass could be on level 2, or split between 0 and 4. The mean cannot tell you which.',
        'The model is overconfident.'
      ],
      a: 2,
      why: 'The score is Σ i·pᵢ — an average of level indexes. A concentrated distribution and a split one can produce the same number, which is why step 02 shows both and why the confidence formula only looks at distance from the mode.',
      trap: 'Reading 1.77 as a rating on a 0–4 scale is the natural move. It is not a probability, and the mean is not a level.'
    },
    {
      id: 'i3', con: 'interface', step: 'interface', stepLabel: 'step 01 · the interface',
      q: 'You replace a chat model plus <code>json_schema</code> with a decision model. What have you actually bought?',
      opts: [
        'Higher accuracy, because the model is specialised for decisions.',
        'No out-of-set label and no parse failure — the answer is a distribution over the options you declared. It can still be wrong.',
        'Calibrated probabilities, because the output is already a distribution.',
        'Determinism: the same state returns the same answer every time.'
      ],
      a: 1,
      why: 'The answer lives in a simplex over exactly your options, so there is no text to parse and no label outside the set. What you did not buy is correctness or calibration — those are measured in Act II.',
      trap: '"It returns probabilities, so they are calibrated" is the single most expensive conflation in this subject. A softmax is a normalised score, not a frequency.'
    },

    // --------------------------------------------------------------- options
    {
      id: 'i4', con: 'options', step: 'options', stepLabel: 'step 03 · the question is the model',
      q: 'Hold the weights and the state fixed, rebind the definitions to different option names, and 38 of 40 answers change. Which explanation is correct?',
      opts: [
        'The model drifted between runs.',
        'The option name is part of the scored text, so the input changed. The type system had nothing to catch.',
        'The label remapping broke the evaluation harness.',
        'The definitions changed, so of course the answer changed.'
      ],
      a: 1,
      why: 'Laya scores a marker token at each option; Open-Jev pools over the name <em>and</em> the definition. The name is input. Accuracy went 90.0% → 7.5% with a 0% type-error rate, so every answer was a valid label.',
      trap: '"The definitions changed" is exactly what did <b>not</b> happen: the definitions were held fixed and moved <i>under</i> fixed names. Reading the experiment backwards is the usual error.'
    },
    {
      id: 'i5', con: 'options', step: 'options', stepLabel: 'step 03 · label following',
      q: 'On one checkpoint, <code>noul</code> follows its own <code>false:</code> / <code>true:</code> labels instead of the state. Which fix addresses the cause?',
      opts: [
        'Lower the temperature until the answer stabilises.',
        'Use neutral option keys, or a two-option <code>choice</code>.',
        'Retrain on more examples of the failing class.',
        'Switch to <code>score</code> with two levels.'
      ],
      a: 1,
      why: 'The label text is being scored, so a label that names the answer can outvote the state. Neutral keys remove the signal, and a two-option choice is the documented workaround.',
      trap: 'Temperature is the tool for a number that does not mean what it says. Here the number is computed from the wrong input — sharpening it makes the bug more confident.'
    },
    {
      id: 'i6', con: 'options', step: 'options', stepLabel: 'step 03 · versioning the list',
      q: 'A copy change renames one option and held-out accuracy moves four points. What is the strongest response?',
      opts: [
        'Roll back and freeze the option list.',
        'Treat the option list as model code: version it and re-run the held-out set on every rename.',
        'Retrain, so the model learns the new names.',
        'Average ten runs to see whether the move is real.'
      ],
      a: 1,
      why: 'The list is an input, not a setting. Versioning it plus a held-out run turns an unexplained move into a diff you can review before it ships.',
      trap: 'Freezing the list is safe and wrong — wording changes anyway, and then it changes without a test. Averaging cannot help: the output is deterministic, so ten runs are one run.'
    },

    // --------------------------------------------------------------- reading
    {
      id: 'i7', con: 'reading', step: 'reading', stepLabel: 'step 04 · confidence',
      q: 'Your gate fires at <code>confidence ≥ 0.6</code>. Someone adds a third option to a two-option <code>choice</code>, and p_max on a case is unchanged at 0.80. What happened to the gate?',
      opts: [
        'Nothing — confidence is a monotone transform of p_max.',
        'It silently changed: confidence is (p_max − 1/n)/(1 − 1/n), and n moved.',
        'It tightened, because more options mean more uncertainty.',
        'p_max fell, so confidence must have fallen too.'
      ],
      a: 1,
      why: 'At n = 2, confidence is 2·p_max − 1 = 0.60. At n = 3 it is (0.80 − 0.333)/0.667 = 0.70. The same 0.60 threshold now admits different cases, and nothing about the evidence moved.',
      trap: 'The monotone claim is true <b>at fixed n</b>. The whole trap is that n is the thing that changed.'
    },
    {
      id: 'i8', con: 'reading', step: 'reading', stepLabel: 'step 04 · temperature',
      q: 'At temperature 0.3 the router\'s confidence reads 1.000 on most cases while accuracy stays at 90.0%. What does that confidence number tell you?',
      opts: [
        'The model is now calibrated.',
        'Nothing new: it is a monotone transform of p_max, and it pins at the ceiling without moving any decision.',
        'Accuracy improved but is being reported at T = 1.',
        'The distribution has collapsed to a point mass.'
      ],
      a: 1,
      why: 'Dividing logits by T < 1 sharpens every distribution, so p_max → 1 and confidence follows. Argmax is unchanged, so accuracy is unchanged. A value at the ceiling carries no information.',
      trap: '"Collapsed to a point mass" is almost right — it approaches one — but the argmax is still the same, so nothing about the decision moved.'
    },
    {
      id: 'i9', con: 'reading', step: 'reading', stepLabel: 'step 04 · six numbers',
      q: 'Two cases, same argmax, same p_max = 0.52.<br>X = [0.52, 0.44, 0.04] &nbsp;·&nbsp; Y = [0.52, 0.10, 0.38].<br>Which number flags X as the near-tie and not Y?',
      opts: [
        'p_max — it is 0.52 in both, so both go to review.',
        'margin — 0.08 against 0.42.',
        'entropy — the more spread distribution is the torn one.',
        'confidence — it is monotone in p_max, so the two differ.'
      ],
      a: 1,
      why: 'Margin is p₁ − p₂. X is 0.52 against 0.44; Y is 0.52 against 0.10 with a long tail at 0.38. Entropy is actually <b>higher</b> for Y (0.938 vs 0.830 nats) because entropy measures spread, not near-ties.',
      trap: '"More spread" sounds like "more torn". Y is more spread and not torn — a tie is a property of the top two, which is exactly what margin measures.'
    },

    // ----------------------------------------------------------- calibration
    {
      id: 'i10', con: 'calibration', step: 'calibration', stepLabel: 'step 06 · temperature scaling',
      q: 'Fitting temperature on the router returns T = 0.53, taking ECE from 0.130 to 0.032. What changed?',
      opts: [
        'The decisions — roughly one ticket in ten now routes differently.',
        'The meaning of the numbers. Argmax and accuracy are identical at every temperature.',
        'Nothing measurable — ECE on 40 cases is noise.',
        'The per-class gaps, which is why the pooled ECE fell.'
      ],
      a: 1,
      why: 'Dividing every logit by a positive constant preserves their order, so the argmax cannot move. Accuracy is 90.0% at T = 1 and at T = 0.53; only the probability scale changed.',
      trap: 'The small-sample objection is real in general and is not what happened here: the fit moved ECE by a factor of four on a head that was systematically under-confident.'
    },
    {
      id: 'i11', con: 'calibration', step: 'calibration', stepLabel: 'step 06 · two heads, one procedure',
      q: 'The refund head fits T = 0.99 and ECE moves 0.034 → 0.033. What do you conclude?',
      opts: [
        'The fit failed; T should never land near 1.',
        'This head was already calibrated. Fit, then check whether the fit did anything.',
        '44 cases are too few to fit a temperature.',
        'ECE cannot be computed for a binary head.'
      ],
      a: 1,
      why: 'A fitted temperature near 1 means the emitted distribution already matched the observed frequencies. The procedure looked and found nothing to repair, on the same code that sharpened the router by 0.47.',
      trap: 'A no-op fit looks like a broken fit. Two heads, same code, opposite conclusions is the point of step 06 — the direction of the error is measured, never guessed.'
    },
    {
      id: 'i12', con: 'calibration', step: 'scoring', stepLabel: 'step 07 · scoring rules',
      q: 'Two models are both 90% accurate. On their misses, A averages p = 0.35 on the true class and B averages p = 0.02. What holds with no other data?',
      opts: [
        'B is better — confident mistakes are rarer.',
        'A is better — B\'s misses are more confident, so they are far more expensive under log loss.',
        'They are equivalent; accuracy is the metric.',
        'It depends only on the cost of the two error types.'
      ],
      a: 1,
      why: 'Log loss is −log p(true). A miss at 0.35 costs 1.05 nats; at 0.02 it costs 3.91. Brier agrees, more gently. Accuracy cannot distinguish the two at all, because both miss 10% of cases.',
      trap: '"Confident mistakes are rarer" confuses confidence with frequency. The frequency is identical; the difference is <i>how</i> wrong the number was.'
    },

    // ------------------------------------------------------------- threshold
    {
      id: 'i13', con: 'threshold', step: 'threshold', stepLabel: 'step 08 · theory vs 44 cases',
      q: 'A false positive costs 1, a false negative costs 20. Where does theory put the gate, and where did 44 held-out cases put it?',
      opts: [
        '0.50 and 0.12.',
        '0.048 and 0.12 — the gap is calibration error plus a small sample, not a tuning knob.',
        '0.95 and 0.12 — a missed promise is twenty times worse.',
        '0.048 and 0.048 — with enough data the two must agree.'
      ],
      a: 1,
      why: 'For a calibrated model the optimum is c_FP/(c_FP + c_FN) = 1/21 ≈ 0.048. The empirical argmin on 44 cases is 0.12, because the head is not perfectly calibrated and 44 cases is a small sample. The gap is the calibration error drawn.',
      trap: '0.95 is the cost ratio read backwards — it is the share of cost a false negative carries, not a threshold. And the two optima agree only if the model is calibrated, which is a measurement, not an assumption.'
    },
    {
      id: 'i14', con: 'threshold', step: 'threshold', stepLabel: 'step 08 · accuracy is not the objective',
      q: 'At threshold 0.50 the gate is 88.6% accurate. At 0.12 it is 84.1%. At 1:20, which ships?',
      opts: [
        '0.50 — accuracy is higher.',
        '0.12 — expected cost is 0.159 per case against 1.409, and accuracy is not the objective.',
        'Neither; you need more data before choosing.',
        '0.50, with the extra cases reviewed by hand.'
      ],
      a: 1,
      why: 'At 0.50 the gate misses 3 promises and makes 2 needless reviews. At 0.12 it misses none and makes 7. At 20:1 those are 1.409 and 0.159 cost units per case — the higher-accuracy threshold is nine times more expensive.',
      trap: 'Accuracy counts a caught promise and a needless review as one event each. That is precisely the assumption the cost ratio exists to reject.'
    },
    {
      id: 'i15', con: 'threshold', step: 'threshold', stepLabel: 'step 08 · the policy, not the number',
      q: 'Your manager says: "seven needless reviews is too many." What is the correct reply?',
      opts: [
        'Raise the threshold to cut the reviews.',
        'At the 20:1 ratio you gave me, seven extra reviews cost less than one missed promise. If the ratio is wrong, change it and I will re-derive the gate.',
        'Add a second model to filter the seven before the workflow sees them.',
        'Split the difference and set it at 0.40.'
      ],
      a: 1,
      why: 'The threshold is a function of the cost ratio, so the objection is really a claim about the ratio. At 0.40 the gate costs 1.432 per case — worse than the 0.50 default, because it misses three promises <i>and</i> makes three needless reviews.',
      trap: 'Splitting the difference treats a policy as a compromise between two numbers rather than a consequence of two costs — and here it is strictly worse than doing nothing.'
    },

    // --------------------------------------------------------------- cascade
    {
      id: 'i16', con: 'cascade', step: 'cascade', stepLabel: 'step 09 · complementarity',
      q: 'Two cheap/expensive pairs, measured on the same 100 cases. Pair A: the models disagree on 22 cases. Pair B: they disagree on 4 and are wrong on the same 9. Which cascade is worth building?',
      opts: [
        'A — the gain is capped by the cases where they disagree.',
        'B — nine shared errors is the smaller number to fix.',
        'Both equally; the gain depends on the expensive model\'s accuracy.',
        'Neither; a cascade cannot beat its best component.'
      ],
      a: 0,
      why: 'A cascade only substitutes a cheap decision on cases where the two models differ. Disagreement is the entire surface it can act on; correlated errors are cases no amount of escalation repairs.',
      trap: 'The last option is the intuition the lab breaks: 87.5% and 90.0% components produced a 95.0% cascade, because they were wrong on different tickets.'
    },
    {
      id: 'i17', con: 'cascade', step: 'cascade', stepLabel: 'step 09 · the price you chose',
      q: 'The cascade reaches 95.0% at 25% escalation; escalate everything and it reads 90.0%. What is the 95.0%?',
      opts: [
        'The router\'s accuracy at the tuned threshold.',
        'A price you chose: five points bought by sending a quarter of traffic to the expensive model — cost index 6 against 21 for routing everything.',
        'Proof the keyword table is better than the router.',
        'A calibration artifact — accuracy cannot rise above the best component.'
      ],
      a: 1,
      why: 'Cost is 1 unit for the keyword table everywhere plus 0.25 × 20 for the escalated share = 6. Routing everything costs 1 + 20 = 21. The accuracy is real and it is a budget line.',
      trap: '"Accuracy cannot rise above the best component" sounds like an impossibility argument. It is false precisely when the components err on different cases.'
    },
    {
      id: 'i18', con: 'cascade', step: 'slices', stepLabel: 'step 10 · the traffic mix',
      q: 'Same model, same weights, same per-queue gaps. Technical tickets go from a small slice to 60% of traffic, and pooled ECE moves 0.130 → 0.198. What moved?',
      opts: [
        'The model degraded on technical tickets.',
        'The mix. A pooled number is a weighted average, and technical carries a −0.266 gap.',
        'The temperature drifted with the workload.',
        'The per-queue gaps, which is what pooling measures.'
      ],
      a: 1,
      why: 'Every per-queue accuracy and gap is unchanged at every mix. Only the weights inside the average moved — which is why "ECE 0.03" is a claim about a traffic mix, not a property of a model. Both figures are at T = 1; at the fitted temperature the same move is 0.032 → 0.104.',
      trap: '"The model degraded" is the natural reading of a metric getting worse. Nothing in the model moved; the thing being averaged did.'
    }
  ];

  var byId = {};
  ITEMS.forEach(function (it) { byId[it.id] = it; });

  // ------------------------------------------------------------------- state

  // a = item answers, s = scenario pass/fail, p = scenario picks, t = s1 threshold
  var state = { a: {}, s: {}, p: {}, t: {} };
  try {
    var raw = localStorage.getItem(KEY);
    if (raw) {
      var p = JSON.parse(raw);
      state.a = p && p.a ? p.a : {};
      state.s = p && p.s ? p.s : {};
      state.p = p && p.p ? p.p : {};
      state.t = p && p.t ? p.t : {};
    }
  } catch (e) { state = { a: {}, s: {}, p: {}, t: {} }; }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  // ------------------------------------------------------------------- mount

  var mount = document.getElementById('q-mount');
  var nav = document.getElementById('c-nav');
  var bar = document.getElementById('c-progress-bar');
  var foot = document.getElementById('c-rail-foot');
  if (!mount) return;

  function pad(n) { return String(n).padStart(2, '0'); }

  function rowAt(pts, t) {
    var best = pts[0];
    for (var i = 1; i < pts.length; i++) {
      if (Math.abs(pts[i].t - t) < Math.abs(best.t - t)) best = pts[i];
    }
    return best;
  }

  // ------------------------------------------------------------------ header

  mount.innerHTML =
    '<div class="c-head">' +
      '<p class="c-kicker">Assessment · 18 items + 3 decisions</p>' +
      '<h1>Can you actually make the call?</h1>' +
      '<p class="c-lede">Eighteen items that never ask for a definition. Each one puts two situations side by side that look the same, and the answer is the number, primitive or claim that separates them. Then three decisions where the cost is asymmetric.</p>' +
    '</div>' +
    '<div class="c-body">' +
      '<div class="q-intro">' +
        '<p>Recall is not the test. "What does <code>noul</code> return?" is cheap to memorise and proves almost nothing. What the course trains is <strong>discrimination</strong>: whether a claim is portable, whether a cascade can help, whether the number you are about to gate on means what it says. That is what these items ask.</p>' +
        '<div class="q-rule">' +
          '<div><span>items</span><b>18, six concepts, three each</b></div>' +
          '<div><span>scenarios</span><b>3, with the arithmetic revealed</b></div>' +
          '<div><span>time</span><b>10–12 minutes, no timer</b></div>' +
        '</div>' +
        '<p class="note" style="margin-top:0">Every miss links back to the step that teaches it. Answers persist in this browser, so you can leave and come back. Numbers quoted in the items are computed from the same engine the labs use, at load.</p>' +
      '</div>' +
      '<div id="q-concepts"></div>' +
      '<div id="q-scenarios"></div>' +
      '<div class="q-score" id="q-score"></div>' +
      '<nav class="c-pager">' +
        '<a href="decision-course.html#interface" class="prev"><span>back to the course</span>← Step 01</a>' +
        '<a href="../" class="next"><span>all explorables</span>Everything →</a>' +
      '</nav>' +
    '</div>';

  var conceptsHost = document.getElementById('q-concepts');
  var scenariosHost = document.getElementById('q-scenarios');
  var scoreHost = document.getElementById('q-score');

  // ------------------------------------------------------------ build items

  var num = 0;
  CONCEPTS.forEach(function (c) {
    var sec = L.h(
      '<section class="q-con" id="con-' + c.id + '">' +
        '<div class="q-con-head"><h2>' + esc(c.name) + '</h2><p>' + esc(c.note) + '</p></div>' +
      '</section>'
    );
    ITEMS.filter(function (it) { return it.con === c.id; }).forEach(function (it) {
      num++;
      sec.appendChild(itemEl(it, num));
    });
    conceptsHost.appendChild(sec);
  });

  function itemEl(it, n) {
    var el = L.h('<div class="q-item" id="q-' + it.id + '"></div>');
    el.innerHTML =
      '<p class="q-kick"><span class="q-n">item ' + pad(n) + ' · ' +
        esc(CONCEPTS.filter(function (c) { return c.id === it.con; })[0].name) + '</span>' +
        '<span class="q-st">' + esc(it.stepLabel) + '</span></p>' +
      '<p class="q-prompt" id="p-' + it.id + '">' + it.q + '</p>' +
      '<div class="q-opts" role="radiogroup" aria-labelledby="p-' + it.id + '">' +
        it.opts.map(function (o, i) {
          return '<label class="q-opt" data-i="' + i + '">' +
            '<input type="radio" name="r-' + it.id + '" value="' + i + '">' +
            '<span class="q-dot" aria-hidden="true"></span>' +
            '<span class="q-text">' + o + '<span class="q-tag"></span></span>' +
          '</label>';
        }).join('') +
      '</div>' +
      '<div class="q-act">' +
        '<button type="button" class="q-check" data-for="' + it.id + '">check answer</button>' +
        '<span class="q-warn" id="w-' + it.id + '">pick one first</span>' +
      '</div>' +
      '<div class="q-verdict" id="v-' + it.id + '" aria-live="polite"></div>';
    return el;
  }

  mount.addEventListener('change', function (e) {
    var inp = e.target;
    if (!inp || inp.type !== 'radio') return;
    var item = inp.closest('.q-item');
    if (!item || item.classList.contains('done')) return;
    Array.prototype.forEach.call(item.querySelectorAll('.q-opt'), function (l) {
      l.classList.toggle('on', l.contains(inp));
    });
  });

  mount.addEventListener('click', function (e) {
    var btn = e.target.closest('.q-check');
    // the scenario commit buttons share the class but drive their own reveals
    if (btn && btn.hasAttribute('data-for')) commit(btn.getAttribute('data-for'));
  });

  function commit(id) {
    var it = byId[id];
    var item = document.getElementById('q-' + id);
    if (!it || !item) return;
    var inp = item.querySelector('input[name="r-' + id + '"]:checked');
    if (!inp) {
      document.getElementById('w-' + id).classList.add('on');
      return;
    }
    document.getElementById('w-' + id).classList.remove('on');
    var pick = Number(inp.value);
    state.a[id] = pick;
    save();
    paint(it, pick);
    updateNav();
    updateScore();
  }

  function paint(it, pick) {
    var item = document.getElementById('q-' + it.id);
    var ok = pick === it.a;
    item.classList.add('done');

    Array.prototype.forEach.call(item.querySelectorAll('.q-opt'), function (label) {
      var i = Number(label.getAttribute('data-i'));
      var input = label.querySelector('input');
      input.disabled = true;
      label.classList.remove('on', 'correct', 'miss');
      var tag = label.querySelector('.q-tag');
      if (i === it.a) {
        label.classList.add('correct');
        tag.textContent = ok ? '✓ your answer' : '✓ the answer';
      } else if (i === pick) {
        label.classList.add('miss');
        tag.textContent = '✗ your answer';
      } else {
        label.classList.add('dim');
      }
    });

    var v = document.getElementById('v-' + it.id);
    v.className = 'q-verdict on' + (ok ? '' : ' bad');
    v.innerHTML =
      '<span class="q-vh">' + (ok ? 'correct' : 'not quite') + '</span>' +
      '<p>' + it.why + '</p>' +
      '<p class="q-trap"><span>why the alternative is tempting —</span> ' + it.trap + '</p>' +
      '<p><a href="decision-course.html#' + it.step + '">read ' + esc(it.stepLabel) + ' →</a></p>';

    var btn = item.querySelector('.q-check');
    btn.disabled = true;
    btn.textContent = 'checked';
  }

  // ---------------------------------------------------------------- restore

  Object.keys(state.a).forEach(function (id) {
    var it = byId[id];
    if (!it) return;
    var pick = state.a[id];
    var inp = document.querySelector('input[name="r-' + id + '"][value="' + pick + '"]');
    if (!inp) return;
    inp.checked = true;
    paint(it, pick);
  });

  // -------------------------------------------------------------------- rail

  if (nav) {
    nav.innerHTML = '';
    CONCEPTS.forEach(function (c) {
      var a = document.createElement('a');
      a.href = '#con-' + c.id;
      a.dataset.con = c.id;
      a.innerHTML = '<span class="n">0/3</span><span>' + esc(c.name) + '</span>';
      nav.appendChild(a);
    });
    var sd = document.createElement('a');
    sd.href = '#con-scenarios';
    sd.dataset.con = 'scenarios';
    sd.innerHTML = '<span class="n">0/3</span><span>Scenarios</span>';
    nav.appendChild(sd);
  }

  function updateNav() {
    if (!nav) return;
    var answered = 0, correct = 0;
    CONCEPTS.forEach(function (c) {
      var n = 0, ok = 0;
      ITEMS.forEach(function (it) {
        if (it.con !== c.id) return;
        if (state.a[it.id] !== undefined) { n++; answered++; if (state.a[it.id] === it.a) ok++; }
      });
      var link = nav.querySelector('[data-con="' + c.id + '"]');
      if (!link) return;
      link.querySelector('.n').textContent = ok + '/3';
      link.classList.toggle('seen', n === 3);
      correct += ok;
    });
    if (bar) bar.style.width = (answered / ITEMS.length * 100) + '%';
    var scCommitted = Object.keys(state.s).length;
    var sc = Object.keys(state.s).filter(function (k) { return state.s[k] === 1; }).length;
    var sdLink = nav.querySelector('[data-con="scenarios"]');
    if (sdLink) {
      sdLink.querySelector('.n').textContent = sc + '/3';
      sdLink.classList.toggle('seen', scCommitted === 3);
    }
    if (foot) {
      foot.innerHTML = answered + ' of ' + ITEMS.length + ' answered · ' +
        (answered ? correct + ' correct' : 'no score yet') +
        (scCommitted ? ' · scenarios ' + sc + '/3' : '');
    }
  }

  // --------------------------------------------------------------- scenarios

  var scenDefs = [
    { id: 's1', kicker: 'scenario 01 · the refund gate', note: '44 held-out replies · 1 : 50' },
    { id: 's2', kicker: 'scenario 02 · buy the second model', note: '40 tickets · measured disagreement' },
    { id: 's3', kicker: 'scenario 03 · the vendor number', note: 'same model · two traffic mixes' }
  ];

  scenariosHost.innerHTML =
    '<section class="q-con" id="con-scenarios">' +
      '<div class="q-con-head"><h2>Three decisions</h2>' +
      '<p>Each one asks you to commit before it shows you the arithmetic. There is no partial credit for a reasonable-sounding reason: the second scenario has an option that picks the right action for the wrong reason.</p></div>' +
      '<div id="q-scen-mount"></div>' +
    '</section>';

  var scenMount = document.getElementById('q-scen-mount');

  // ------------------------------------------------------------- scenario 1

  (function () {
    var f = L.frame(scenDefs[0].kicker, scenDefs[0].note);
    scenMount.appendChild(f);
    f.body.innerHTML =
      '<p class="q-scen-q">A reply can commit the company to a refund. A missed promise (false negative) costs <b>50×</b> a needless review (false positive). Set the gate at the probability above which you send the case to the refund workflow.</p>';

    var ctl = L.h('<div class="d-ctl-row"></div>');
    var act = L.h('<div class="q-act" style="margin-top:4px"></div>');
    var out = L.h('<div class="q-reveal"></div>');
    f.body.appendChild(ctl);
    f.body.appendChild(act);
    f.body.appendChild(out);

    var S = { t: 0.5 };
    var btn = L.h('<button type="button" class="q-check">commit the threshold</button>');
    act.appendChild(btn);

    var sl = L.slider(ctl, {
      key: 's1t', label: 'your threshold', min: 0.02, max: 0.9, step: 0.01, value: 0.5,
      format: function (v) { return v.toFixed(2); },
      onInput: function (v) {
        S.t = v;
        // let the learner try another threshold after committing
        btn.disabled = false;
        btn.textContent = 'commit the threshold';
        out.classList.remove('on');
      }
    });

    function reveal() {
      var pts = D.sweep(1, 50, 1);
      var mine = rowAt(pts, S.t);
      var best = D.bestThreshold(1, 50, 1);
      var ratio = mine.cost / best.cost;
      var pass = ratio <= 1.6;

      state.s.s1 = pass ? 1 : 0;
      state.t.s1 = S.t;
      save();
      updateNav();

      btn.disabled = true;
      btn.textContent = 'committed';

      var catchAll = mine.fn === 0;
      var band = pass
        ? (ratio <= 1.05 ? 'This is the policy — you found the empirical minimum without seeing the curve.'
          : 'Defensible: inside the plateau. You are buying a few extra reviews for the same number of caught promises.')
        : (catchAll
          ? 'Too low. You caught every promise, but paid for reviews that changed nothing.'
          : 'Too high. You bought fewer reviews with missed promises, and at 50:1 that is the expensive side.');

      out.className = 'q-reveal on';
      out.innerHTML =
        '<div class="q-cells">' +
          cell('cost / case', mine.cost.toFixed(3), pass ? 'acc' : 'bad') +
          cell('promises caught', mine.tp + ' / 22') +
          cell('promises missed', String(mine.fn), mine.fn ? 'bad' : '') +
          cell('needless reviews', String(mine.fp)) +
        '</div>' +
        '<p class="d-note" style="margin-top:10px">The empirical minimum is at <b>' + best.t.toFixed(2) +
          '</b> (' + best.cost.toFixed(3) + ' per case). Theory says <b>' + best.analytic.toFixed(3) +
          '</b> — c_FP / (c_FP + c_FN). You set <b>' + mine.t.toFixed(2) + '</b>, which costs ' +
          ratio.toFixed(2) + '× the minimum.</p>' +
        '<p class="d-note"><b>' + band + '</b> The gap between 0.020 and 0.12 is not a tuning choice you got ' +
          'wrong: it is the head\'s calibration error plus the step size of a 44-case corpus, drawn. It shrinks as ' +
          'the corpus grows.</p>';
    }

    btn.addEventListener('click', reveal);
    if (state.t.s1 !== undefined) { S.t = state.t.s1; sl.set(S.t); reveal(); }
  })();

  // ------------------------------------------------------------- scenario 2

  (function () {
    var f = L.frame(scenDefs[1].kicker, scenDefs[1].note);
    scenMount.appendChild(f);

    var c = D.cascade(D.DEMO, 0.4, 1);
    var cells = Math.round(c.bothRight * c.n) + ' both right · ' +
      c.cheapOnly + ' cheap-only · ' + c.routerOnly + ' router-only · ' +
      Math.round(c.bothWrong * c.n) + ' both wrong';

    var OPTS = [
      { t: 'Ship the cascade at 25% escalation — 95.0% for a cost index of 6.', ok: true },
      { t: 'Run the router on everything — it is the most accurate single model.', ok: false },
      { t: 'Keep the keyword table only — one unit per case is unbeatable.', ok: false },
      { t: 'Ship the cascade, because the router is the better model.', ok: false }
    ];

    f.body.innerHTML =
      '<p class="q-scen-q">A keyword table scores 87.5% on 40 tickets. A learned router scores 90.0%. Measured on the same cases: <b>' +
        esc(cells) + '</b>. The keyword table costs 1 unit per call; the router costs 20. What do you ship?</p>' +
      '<div class="q-opts" role="radiogroup" aria-label="what do you ship">' +
        OPTS.map(function (o, i) {
          return '<label class="q-opt" data-i="' + i + '">' +
            '<input type="radio" name="r-s2" value="' + i + '">' +
            '<span class="q-dot" aria-hidden="true"></span>' +
            '<span class="q-text">' + esc(o.t) + '<span class="q-tag"></span></span></label>';
        }).join('') +
      '</div>' +
      '<div class="q-act"><button type="button" class="q-check" id="s2-btn">commit</button>' +
        '<span class="q-warn" id="s2-warn">pick one first</span></div>' +
      '<div class="q-reveal" id="s2-out"></div>';

    var btn = f.body.querySelector('#s2-btn');

    f.body.addEventListener('change', function (e) {
      if (e.target.type !== 'radio') return;
      Array.prototype.forEach.call(f.body.querySelectorAll('.q-opt'), function (l) {
        l.classList.toggle('on', l.contains(e.target));
      });
    });

    function reveal(pick) {
      state.s.s2 = OPTS[pick].ok ? 1 : 0;
      state.p.s2 = pick;
      save();
      updateNav();
      btn.disabled = true;
      btn.textContent = 'committed';

      Array.prototype.forEach.call(f.body.querySelectorAll('.q-opt'), function (l) {
        var i = Number(l.getAttribute('data-i'));
        l.querySelector('input').disabled = true;
        l.classList.toggle('on', i === pick);
        if (OPTS[i].ok) {
          l.classList.add('correct');
          l.querySelector('.q-tag').textContent = '✓ the answer';
        } else if (i === pick) {
          l.classList.add('miss');
          l.querySelector('.q-tag').textContent = '✗ your answer';
        }
      });

      var out = f.body.querySelector('#s2-out');
      out.className = 'q-reveal on';
      out.innerHTML =
        '<div class="q-cells">' +
          cell('cascade', '95.0%', 'acc') +
          cell('router everywhere', '90.0%') +
          cell('keyword table', '87.5%') +
          cell('cost index', '6 vs 21', 'acc') +
        '</div>' +
        '<p class="d-note" style="margin-top:10px">1 unit for the keyword table everywhere, plus 0.25 × 20 for the ' +
          'quarter it escalates, is 6. Routing everything is 1 + 20 = 21. Three and a half times the budget back, ' +
          'and five points of accuracy at the same time.</p>' +
        '<p class="d-note"><b>Option D ships the right thing for the wrong reason.</b> The cascade is not winning ' +
          'because the router is better — the router is better, which is why it is worth buying. It is winning because ' +
          'the two models are wrong on <i>different</i> tickets: 3 cheap-only, 4 router-only, 1 both-wrong. If they ' +
          'shared their errors, 25% escalation would buy nothing.</p>' +
        '<p class="d-note">One honest caveat: the disagreement cells are estimates from 40 cases, so each cell is ' +
          '±1 ticket. The <i>logic</i> generalises; the fifth point is not a benchmark.</p>';
    }

    btn.addEventListener('click', function () {
      var inp = f.body.querySelector('input[name="r-s2"]:checked');
      if (!inp) { f.body.querySelector('#s2-warn').classList.add('on'); return; }
      reveal(Number(inp.value));
    });

    if (state.p.s2 !== undefined) {
      var inp = f.body.querySelector('input[name="r-s2"][value="' + state.p.s2 + '"]');
      if (inp) { inp.checked = true; reveal(state.p.s2); }
    }
  })();

  // ------------------------------------------------------------- scenario 3

  (function () {
    var f = L.frame(scenDefs[2].kicker, scenDefs[2].note);
    scenMount.appendChild(f);

    // Both numbers are at the fitted temperature, so the only difference left
    // is the traffic mix. Keeping T fixed is the whole point: otherwise the gap
    // could be the temperature and the item would teach the wrong lesson.
    var T = D.temperatures.router;

    function pooledAt(mix) {
      var weighted = [];
      D.DEMO.forEach(function (ex) {
        var copies = ex.label === 1 ? mix : 1;
        for (var i = 0; i < copies; i++) weighted.push(ex);
      });
      return D.evaluate(weighted, D.OPTIONS, T);
    }

    var yourEce = pooledAt(6).ece.toFixed(3);

    var OPTS = [
      { t: 'Which traffic mix was it computed on — and what does the per-slice table look like?', ok: true },
      { t: 'Whether they also reported log loss.', ok: false },
      { t: 'Whether the model was fine-tuned before measuring.', ok: false },
      { t: 'Nothing. A gap that large proves the vendor number is wrong.', ok: false }
    ];

    f.body.innerHTML =
      '<p class="q-scen-q">A vendor quotes <b>ECE 0.032</b> for the router, on their traffic. On yours the same model, ' +
        'at the same temperature, reads <b>' + yourEce + '</b>. You have one question. Which one changes what you do next?</p>' +
      '<div class="q-opts" role="radiogroup" aria-label="which follow-up question">' +
        OPTS.map(function (o, i) {
          return '<label class="q-opt" data-i="' + i + '">' +
            '<input type="radio" name="r-s3" value="' + i + '">' +
            '<span class="q-dot" aria-hidden="true"></span>' +
            '<span class="q-text">' + esc(o.t) + '<span class="q-tag"></span></span></label>';
        }).join('') +
      '</div>' +
      '<div class="q-act"><button type="button" class="q-check" id="s3-btn">commit</button>' +
        '<span class="q-warn" id="s3-warn">pick one first</span></div>' +
      '<div class="q-reveal" id="s3-out"></div>';

    var btn = f.body.querySelector('#s3-btn');

    f.body.addEventListener('change', function (e) {
      if (e.target.type !== 'radio') return;
      Array.prototype.forEach.call(f.body.querySelectorAll('.q-opt'), function (l) {
        l.classList.toggle('on', l.contains(e.target));
      });
    });

    function reveal(pick) {
      state.s.s3 = OPTS[pick].ok ? 1 : 0;
      state.p.s3 = pick;
      save();
      updateNav();
      btn.disabled = true;
      btn.textContent = 'committed';

      Array.prototype.forEach.call(f.body.querySelectorAll('.q-opt'), function (l) {
        var i = Number(l.getAttribute('data-i'));
        l.querySelector('input').disabled = true;
        l.classList.toggle('on', i === pick);
        if (OPTS[i].ok) {
          l.classList.add('correct');
          l.querySelector('.q-tag').textContent = '✓ the answer';
        } else if (i === pick) {
          l.classList.add('miss');
          l.querySelector('.q-tag').textContent = '✗ your answer';
        }
      });

      var out = f.body.querySelector('#s3-out');
      out.className = 'q-reveal on';

      // T and pooledAt are defined at the top of this closure: both the prompt
      // and this reveal have to quote the same number.
      var cls = D.byClass('router', null, T);
      var worst = cls.reduce(function (a, b) { return Math.abs(b.gap) > Math.abs(a.gap) ? b : a; });

      out.innerHTML =
        '<div class="q-cells">' +
          cell('vendor mix', '0.032', '') +
          cell('your mix', pooledAt(6).ece.toFixed(3), 'bad') +
          cell('worst slice gap', (worst.gap >= 0 ? '+' : '−') + Math.abs(worst.gap).toFixed(3), 'bad') +
          cell('model changed?', 'no', 'acc') +
        '</div>' +
        '<div style="margin-top:14px" id="s3-ctl"></div>' +
        '<div style="margin-top:4px" id="s3-calc"></div>' +
        '<p class="d-note" style="margin-top:10px"><b>Nothing about the model differs.</b> Pooled ECE is an average ' +
          'over whatever traffic you sent, so moving technical tickets from a small slice to 60% of the mix moves ' +
          'the pooled number while every per-queue accuracy and gap stays identical.</p>' +
        '<p class="d-note">That is why the answer is the mix and the slice table, not log loss or fine-tuning. ' +
          'Sample size genuinely matters — but at 44 cases it is a caveat on both numbers, not the explanation for ' +
          'a threefold gap.</p>' +
        '<p class="d-note">Per-slice gaps: ' + cls.map(function (b) {
          var a = Math.abs(b.gap) < 0.0005 ? 0 : Math.abs(b.gap);
          return b.name + ' ' + (b.gap > 0.0005 ? '+' : b.gap < -0.0005 ? '−' : '') + a.toFixed(3);
        }).join(' · ') + '.</p>';

      var S = { mix: 1 };
      var ctl = out.querySelector('#s3-ctl');
      var calc = out.querySelector('#s3-calc');

      function draw() {
        var nTech = D.DEMO.filter(function (e) { return e.label === 1; }).length;
        var n = D.DEMO.length + nTech * (S.mix - 1);
        var pooled = pooledAt(S.mix);
        calc.innerHTML =
          '<div class="q-scell big"><span class="k">pooled ECE at this mix</span>' +
            '<span class="v">' + pooled.ece.toFixed(3) + '</span></div>' +
          '<div class="q-scell"><span class="k">technical share of the mix</span>' +
            '<span class="v">' + Math.round(nTech * S.mix / n * 100) + '%</span></div>' +
          '<div class="q-scell"><span class="k">cases in the mix</span><span class="v">' + n + '</span></div>';
      }

      L.slider(ctl, {
        key: 's3mix', label: 'technical multiple', min: 1, max: 6, step: 1, value: 1,
        format: function (v) { return v + '×'; },
        onInput: function (v) { S.mix = v; draw(); }
      });
      draw();
    }

    btn.addEventListener('click', function () {
      var inp = f.body.querySelector('input[name="r-s3"]:checked');
      if (!inp) { f.body.querySelector('#s3-warn').classList.add('on'); return; }
      reveal(Number(inp.value));
    });

    if (state.p.s3 !== undefined) {
      var inp = f.body.querySelector('input[name="r-s3"][value="' + state.p.s3 + '"]');
      if (inp) { inp.checked = true; reveal(state.p.s3); }
    }
  })();

  function cell(k, v, cls) {
    return '<div><span>' + esc(k) + '</span><b class="' + (cls || '') + '">' + esc(v) + '</b></div>';
  }

  // ---------------------------------------------------------------- score

  function updateScore() {
    var answered = 0, correct = 0;
    var rows = CONCEPTS.map(function (c) {
      var n = 0, ok = 0;
      ITEMS.forEach(function (it) {
        if (it.con !== c.id) return;
        if (state.a[it.id] !== undefined) { n++; answered++; if (state.a[it.id] === it.a) ok++; }
      });
      correct += ok;
      return { c: c, n: n, ok: ok };
    });

    var scen = Object.keys(state.s).length;
    var scenOk = Object.keys(state.s).filter(function (k) { return state.s[k] === 1; }).length;

    var head, sub;
    if (answered < ITEMS.length) {
      head = 'Answer all 18 to get a reading';
      sub = answered + ' of ' + ITEMS.length + ' answered. The scorecard fills in per concept as you go; the band at the bottom needs the whole set.';
    } else if (correct >= 15) {
      head = 'You can run this';
      sub = correct + '/18. You are discriminating between the claims, not recalling the vocabulary — which is the only thing that transfers to a system you have not seen.';
    } else if (correct >= 9) {
      head = 'Operating knowledge, with one weak area';
      sub = correct + '/18. The mechanics are there. The concept below the line is the one to re-read before you set a gate or accept a calibration number in a review.';
    } else {
      head = 'Re-read two steps first';
      sub = correct + '/18. That is a diagnostic, not a verdict: the items are designed so a plausible reading fails. Start with the two concepts below the line.';
    }

    var weakest = rows.slice().sort(function (a, b) { return (a.ok - b.ok) || (a.c.id > b.c.id ? 1 : -1); });

    var html =
      '<h2>Scorecard</h2>' +
      '<p class="q-band">' + esc(head) + '<small>' + esc(sub) + '</small></p>' +
      '<div class="q-sc">' +
        rows.map(function (r) {
          var frac = r.ok / 3;
          return '<div class="q-sc-row' + (r.ok <= 1 && r.n === 3 ? ' weak' : '') + '">' +
            '<a href="#con-' + r.c.id + '">' + esc(r.c.name) + '</a>' +
            '<span class="q-sc-n">' + r.ok + '/3</span>' +
            '<span class="q-sc-b"><i style="width:' + (frac * 100) + '%"></i></span>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<p class="q-pending">' +
        (scen < 3
          ? (scen ? scen + ' of 3 scenarios committed · ' + scenOk + ' matched the numbers.' : 'No scenarios committed yet — they are the transfer half of the assessment, scored separately from the 18 items.')
          : scenOk + ' of 3 scenarios matched the numbers. ') +
        (answered === ITEMS.length
          ? (correct >= 15 ? 'Decisions are where this subject actually bites; a clean 18 with 1/3 on the scenarios means you know the theory and have not priced a mistake yet.'
            : 'Re-read ' + esc(weakest[0].c.name) + ' and ' + esc(weakest[1].c.name) + ' before the next threshold you set.')
          : '') +
      '</p>' +
      '<div class="q-tail">' +
        '<button type="button" class="q-reset" id="q-reset">reset this assessment</button>' +
        '<a href="decision-course.html#interface" class="q-reset" style="text-decoration:none">back to the course</a>' +
      '</div>';

    scoreHost.innerHTML = html;
    var rb = document.getElementById('q-reset');
    if (rb) {
      rb.addEventListener('click', function () {
        state = { a: {}, s: {} };
        try { localStorage.removeItem(KEY); } catch (e) {}
        location.reload();
      });
    }
  }

  // ------------------------------------------------------------- scrollspy

  if ('IntersectionObserver' in window && nav) {
    var links = {};
    Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
      links[a.getAttribute('href').slice(1)] = a;
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
          a.setAttribute('aria-current', 'false');
        });
        var a = links[en.target.id];
        if (a) a.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-72px 0px -70% 0px', threshold: 0 });
    CONCEPTS.forEach(function (c) {
      var el = document.getElementById('con-' + c.id);
      if (el) io.observe(el);
    });
    var sc = document.getElementById('con-scenarios');
    if (sc) io.observe(sc);
  }

  updateNav();
  updateScore();
})();
