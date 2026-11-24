/* The decision course — Acts I–II. Ten lessons, one page, no dependencies.
 *
 * Shell contract is shared with course.html: c-nav / c-lesson / c-head /
 * c-pager, and labs are mounted inside L.frame() so they inherit .c-lab
 * chrome. Nothing here invents a palette.
 */
(function () {
  'use strict';

  var LESSONS = [
    {
      id: 'interface',
      nav: 'Interface',
      kicker: 'Step 01 · the whole idea',
      title: 'A decision model is not a text generator',
      lede: 'Send a state and a set of typed questions. Get back one probability distribution per question. Nothing is generated, so nothing can be malformed.',
      body:
        '<p>Three vendors shipped this interface inside eight weeks. TypeSafe\'s Jev on 15 September 2026, Microsoft-Decision-1.1 in Foundry, and Google\'s Gemini Decision 1 on 11 November — and all three take the same request: a <strong>state</strong>, a map of <strong>questions</strong>, and a fixed set of options declared at call time. Microsoft serves it at <code>/v1/systemone</code>, which is TypeSafe\'s path.</p>' +
        '<p>That matters for a course, because it means you are not learning a vendor. You are learning an interface that has already converged: <code>noul</code>, <code>choice</code>, <code>score</code>. vLLM, SGLang, LM Studio, LiteLLM and OpenRouter all serve it too, with open models behind it.</p>' +
        '<p>The structural difference is where the answer lives. A generator puts the answer <em>inside</em> a sequence of tokens, so you need a schema, a parser, and a repair path when the parse fails. A decision model puts the answer in a <strong>simplex</strong> — a vector of probabilities over exactly the options you supplied. There is no text to parse and no out-of-set answer to handle. It can still be wrong; it cannot be unparseable.</p>' +
        '<p>Run both below on the same state. The generator pane samples from the same belief so the comparison isolates the interface, not the model. Count the distinct strings across twenty runs, then look at what the decision model returned.</p>',
      lab: 'one',
      labTitle: 'one state, two interfaces',
      labNote: 'same belief · different output shape',
      look: 'the generator produced several different strings from one input, because sampling is sampling, and every one of them needs a parser. The decision model produced one distribution, the same one every time. Note what the generator cannot give you at all: a number you can threshold.',
      why: 'This is the reason the category exists. If a downstream branch needs "is this a refund request, with what probability", asking a chat model to write a number is asking it to be a probability distribution, and asking a parser to enforce your schema. A decision model makes that the only thing it does.',
      src: 'TypeSafe System One docs · Google, "Gemini Decisions API", 11 Nov 2026 · Microsoft Learn, "Microsoft-Decision-1.1"'
    },
    {
      id: 'primitives',
      nav: 'Primitives',
      kicker: 'Step 02 · the three types',
      title: 'Three primitives, and the one you should not have picked',
      lede: 'A yes/no, an unordered set, an ordered scale. Each returns a different shape, and picking the wrong one silently changes what you can compute.',
      body:
        '<p><strong>noul</strong> — <em>is this true?</em> One probability from 0 to 1. No confidence field, because there is nothing to collapse: the probability already is the answer. This is the cheapest primitive and the one every "screen first" pattern is built on.</p>' +
        '<p><strong>choice</strong> — <em>which of these?</em> Two to 255 unordered options. You get the winner and the normalised distribution, plus a <code>confidence</code> of <code>(p_max − 1/n)/(1 − 1/n)</code>. Because the options are unordered, the mean of the distribution is meaningless — there is no arithmetic to do on "billing" and "shipping".</p>' +
        '<p><strong>score</strong> — <em>which level?</em> An ordered rubric starting at 0. The returned score is the probability-weighted mean of the level indexes, Σ i·pᵢ, so a four-level scale returns something like 1.77 and it can land between levels. Its confidence uses a different formula, based on mean absolute deviation from the mode.</p>' +
        '<p>Now the part that decides real systems: <strong>a choice over an ordered scale throws the order away, and a score over unordered labels invents one.</strong> If you ask "which of these" about severity you cannot rank the answers. If you ask "what level" about teams you have told the model that legal sits between billing and shipping. Microsoft puts the limit on its own model plainly: prefer scores for relative ordering and thresholds, not as absolute calibrated ratings.</p>',
      lab: 'two',
      labTitle: 'the same model, three readouts',
      labNote: 'switch the primitive, not the model',
      look: 'switch types and watch the answer change shape. noul gives you one number. choice gives you a winner and a distribution you cannot average. score gives you a distribution you can average — and a mean that hides whether the mass was all on one level or split across two distant ones.',
      why: 'Most "the model is inconsistent" reports are type errors wearing a data costume. A rubric whose levels are not ordered will produce a score that moves when nothing about the input moved. Decide what question you are actually asking before you look at an answer.',
      src: 'TypeSafe primitives · Microsoft Learn, "Use Score for ranking and grading" · Google, "score (Ordered Rubric)"'
    },
    {
      id: 'options',
      nav: 'Options',
      kicker: 'Step 03 · the finding',
      title: 'The question is the model',
      lede: 'Nothing in the weights changes when you rename an option. The answer changes anyway, because the option name is scored text.',
      body:
        '<p>Every option is a name plus a definition. The model is asked to score the option — and in the open implementations that document their readout, what gets scored is the option\'s <em>text</em>. Laya scores a marker token placed at each option; Open-Jev pools the representation over the name and the definition. Change the name and you have changed the input.</p>' +
        '<p>The result is not subtle. Rebinding definitions to different yes/no <em>names</em>, with no other change, moved decision-flip rates by up to 70 points and AUC from 0.938 to 0.232 — while the type-error rate stayed at 0.0%. Every answer was a valid label. The interface held perfectly and the decisions did not.</p>' +
        '<p>This is already a shipped bug, not a hypothetical. Laya\'s own issue tracker records that on one checkpoint <code>noul</code> can follow its <code>false:</code> / <code>true:</code> labels instead of the state. The recommendation is to use neutral option keys or a two-option <code>choice</code>.</p>' +
        '<p>The lab below runs the experiment at this scale. Edit a name. Rotate the definitions under the same names. Then strip the names entirely and see which of the two actually mattered.</p>',
      lab: 'three',
      labTitle: 'rewrite the options, hold the model fixed',
      labNote: '40 tickets the model never saw',
      look: 'baseline is about 90% on forty tickets the model never saw. Rotate the definitions under the fixed names and accuracy collapses below chance — 38 of 40 answers change. Then replace every name with opt_1 and the accuracy comes back. The names were doing the work, and nothing type-checked.',
      why: 'Your option list is part of your model, and it is versioned by every pull request that touches a string. When accuracy moves after a "copy change", this is why. Microsoft says it directly: poorly framed questions still return scores.',
      src: 'arXiv 2609.26758, "Type-Safe Is Not Error-Free" · Laya issue #156 · Microsoft, "Wording sensitivity"'
    },
    {
      id: 'reading',
      nav: 'Reading',
      kicker: 'Step 04 · the output',
      title: 'Six numbers from one distribution, and they disagree',
      lede: 'argmax, p_max, margin, entropy, normalised entropy, and the vendor confidence. Pick the wrong one and your gate fires on the wrong thing.',
      body:
        '<p>Given probabilities, everyone reaches for the argmax. That is fine until you need to know <em>how sure</em> — and then there are several answers.</p>' +
        '<p><strong>p_max</strong> is the top probability. <strong>Margin</strong> is p₁ − p₂, which tells you about the runner-up rather than the winner. <strong>Entropy</strong> measures how spread the mass is. The vendor\'s <strong>confidence</strong> is <code>(p_max − 1/n)/(1 − 1/n)</code> for choice and noul, and a deviation-from-mode formula for score.</p>' +
        '<p>The thing worth internalising: for a fixed number of options, <strong>confidence is a monotone transform of p_max</strong>. It adds no independent evidence. Add a sixth option and confidence falls while p_max barely moves — the number changed because <em>n</em> changed, not because the evidence did. If you gate on confidence and then edit the option list, you moved your threshold without touching it.</p>' +
        '<p>Score has a sharper version of the same problem. A score of 2.0 can mean everything on level 2, or a split between 0 and 4. The mean averages the disagreement away, and the confidence formula only looks at distance from the mode.</p>',
      lab: 'four',
      labTitle: 'one distribution, six numbers',
      labNote: 'temperature · option count',
      look: 'drag temperature. p_max and confidence move together, always. Then add distractor options: p_max dips slightly, confidence drops much further, and the argmax does not move. Nothing about the evidence changed. Then push temperature below 0.5 and watch confidence pin at 1 while accuracy does not improve at all.',
      why: 'A gate is a threshold on one number, so the choice of number is a design decision with a failure mode. p_max is the honest default; margin catches near-ties; entropy catches splits. Confidence is a convenience that hides which of those you have.',
      src: 'TypeSafe confidence docs · arXiv 2609.32160 §5, finding 4'
    },
    {
      id: 'parallel',
      nav: 'Parallel',
      kicker: 'Step 05 · the shape of a call',
      title: 'One state, many questions, no conversation',
      lede: 'Questions in one request are answered independently and in parallel. That is where the latency comes from, and it is also the constraint you will hit first.',
      body:
        '<p>Google accepts up to 1,000 questions against one multimodal input and reports latency staying nearly flat from 1 to 100 questions. TypeSafe\'s phrase for exploiting this is <em>speculative fan-out</em>: ask everything you might need, including the questions whose answers you will throw away, and let your code decide what is relevant. The shared state is billed once no matter how many questions ride on it.</p>' +
        '<p>The constraint is in the name. A question cannot see another question\'s answer. So routing that depends on the predicted category needs a second request, and a three-stage pipeline needs three. Every "just chain it in one call" design turns back into serial the moment the second question is conditional on the first.</p>' +
        '<p>That is not a limitation of the product so much as the definition of the primitive: one forward pass, no autoregression, no intermediate text. It is exactly why the latency is flat.</p>' +
        '<p><em>The numbers below are a stated cost model — a fixed per-request overhead plus a small marginal cost per question — not a measurement. Set the overhead and price to whatever your vendor quotes and the shape holds.</em></p>',
      lab: 'five',
      labTitle: 'bundle the questions',
      labNote: 'stated cost model, not a benchmark',
      look: 'drag questions from 1 to 200. Parallel grows slowly while serial goes linear, and cost per question falls toward the marginal cost of one question — the state is paid for once. Then switch to one request per question and watch the state get re-sent 200 times.',
      why: 'Flat latency and parallel questions are the same fact. Design around it: ask everything you can afford in one pass, score the extras speculatively, and accept that genuine chains cost a second round trip. Bundling questions you can answer independently is free; bundling dependent ones is a bug that returns plausible answers.',
      src: 'Google, "Gemini Decisions API" · TypeSafe, "Speculative fan-out" · arXiv 2609.32160 §3.3'
    },
    {
      id: 'calibration',
      nav: 'Calibration',
      kicker: 'Step 06 · act II · the number',
      title: 'A distribution is not a probability until you check',
      lede: 'Temperature changes no weights and no decisions. It changes whether the number you gate on means what it says.',
      body:
        '<p>A softmax is a normalised score, not a frequency. Nothing in training forces the top number to equal the hit rate, and in practice it does not. The router here is 90% accurate on tickets it never saw, while its most confident bin claims 0.973 and is right <em>every time</em> — it is under-stating itself. That gap between claimed and observed is <strong>calibration error</strong>, and it can run in either direction.</p>' +
        '<p>The one-parameter repair is temperature: divide every logit by <em>T</em> before the softmax. <em>T</em> = 1 is what the model emits, <em>T</em> &lt; 1 sharpens, <em>T</em> &gt; 1 softens. Fitting <em>T</em> on held-out data minimises log loss. It cannot change the argmax — dividing every logit by the same positive number preserves order — so <strong>accuracy is identical at every temperature</strong>. That is the whole trick and the whole limitation.</p>' +
        '<p>The lab fits <em>T</em> at load, on a split the lessons never report. The router\'s is 0.53, taking ECE from 0.130 to 0.032. Now switch to the refund head. Its fit returns <b>0.99</b> and ECE moves 0.034 → 0.033 — the procedure looked and found nothing to fix, because that head was already honest. Two heads, same code, opposite conclusions. <strong>The direction of the error is measured, not guessed:</strong> nothing about a softmax tells you whether it needs sharpening or softening.</p>' +
        '<p>What a temperature cannot do is repair a question that was never separable. Step 02\'s tone head is that case: four levels where "mild" and "frustrated" overlap by construction, and one scalar would have to sharpen one end while softening the other. If fitting does not move your number, the problem is upstream of calibration.</p>' +
        '<p>Read the dot sizes, too. Forty and forty-four cases are small calibration sets; a bin with one case and a bin with twenty-seven carry very different evidence, and ECE weights them by count, not by confidence.</p>',
      lab: 'six',
      labTitle: 'does the number mean what it says',
      labNote: 'reliability · ECE · log loss',
      look: 'the router\'s top bins sit left of the diagonal — it claims 0.85 and is right 10 times out of 10 — so the fit sharpens, T = 0.53, ECE 0.130 → 0.032, with accuracy pinned at 90.0%. Switch to refund and the fit returns 0.99: ECE 0.034 → 0.033, because that head was already honest. Two heads, same code, opposite conclusions. Read the dot sizes in both.',
      why: 'If the number gates a human review or a refund, then "0.83" has to mean roughly 83 out of 100. Fitting a temperature is the cheapest step from a score to a probability — but it cannot move accuracy, and it cannot fix a question whose options were never separable. Fit it, then check whether the fit did anything.',
      src: 'Guo et al., "On Calibration of Modern Neural Networks" · arXiv 2609.32160 §5 · TypeSafe, confidence docs'
    },
    {
      id: 'scoring',
      nav: 'Scoring rules',
      kicker: 'Step 07 · act II · the penalty',
      title: 'Two models can be 90% accurate and not equally wrong',
      lede: 'Accuracy cannot tell a miss at p = 0.4 from a miss at p = 0.01. A scoring rule can.',
      body:
        '<p>Accuracy counts wins. Being wrong at p = 0.4 and being wrong at p = 0.01 are the same event to a counter and completely different events to a business. A <strong>scoring rule</strong> scores the whole distribution rather than the winner.</p>' +
        '<p><strong>Brier</strong> is the mean squared error between the probability vector and the one-hot truth: bounded, gentle, and it treats a confident miss as bad but not catastrophic. <strong>Log loss</strong> is −log p(true class): unbounded, and the punishment grows without limit as confidence in the wrong answer grows. Both are <em>proper</em> — they are minimised in expectation only by reporting your true belief — which is why they are the honest way to compare two systems that both claim 90%.</p>' +
        '<p>The table holds accuracy fixed at every temperature, exactly as step 06 says it must. Watch the other columns. At <em>T</em> = 0.3 the single worst case costs <b>3.85 nats</b> — a billing ticket the model filed under cancellation, with 0.02 on the right answer. At <em>T</em> = 3 the worst case is capped at 1.60 nats, but even the <em>cheapest</em> case costs 0.148. That is the whole trade: sharpening makes the hits free and the misses ruinous; softening does the reverse.</p>' +
        '<p>The two panels show the same model at the same temperature, sorted by loss. One ticket can carry most of the average. That is what log loss is for, and why "90% accurate" is not a statement about risk.</p>',
      lab: 'seven',
      labTitle: 'same model, three scoring rules',
      labNote: 'accuracy · Brier · log loss',
      look: 'accuracy reads 90.0% in every row of the table at every temperature, because temperature cannot move the argmax. Brier bottoms out near the fitted T; log loss bottoms in the same region but is dominated by one case. Drag T to 0.3 and the worst case costs 3.85 nats; drag it to 3 and the worst case falls to 1.60 while the cheapest case rises off zero.',
      why: 'If you report one number, report a proper scoring rule next to accuracy, and always look at the worst case. A model selected on accuracy alone will be the one that is confidently wrong on exactly the cases the system exists to catch.',
      src: 'Brier (1950) · Gneiting & Raftery, "Strictly Proper Scoring Rules" · arXiv 2609.32160'
    },
    {
      id: 'threshold',
      nav: 'Thresholds',
      kicker: 'Step 08 · act II · the gate',
      title: '0.5 is not a threshold, it is a default',
      lede: 'A gate minimises expected cost at c_FP / (c_FP + c_FN) — which is almost never 0.5, and rarely exactly where a small sample puts the empirical minimum.',
      body:
        '<p>The refund head answers one <code>noul</code>: does this reply commit the company to returning money? Forty-four held-out replies, 22 each way. The word "refund" appears on both sides — "I have refunded the full amount" against "I am unable to issue a refund outside the thirty day policy" — so this is not a keyword lookup. That is what makes it a fair test of the gate rather than of the tokeniser.</p>' +
        '<p>Two errors, two costs. A <strong>false positive</strong> sends a case to the refund workflow that should not have fired; annoying, cheap. A <strong>false negative</strong> misses a promise the company already made; the customer is charged twice, expensive — 20× here. Expected cost per case is (FP·c_FP + FN·c_FN)/n, minimised at threshold <code>c_FP/(c_FP+c_FN)</code> for a calibrated model. At 1:20 that is <b>0.048</b>, nowhere near 0.5.</p>' +
        '<p>The empirical argmin on 44 cases lands at 0.12 instead, because the model is not perfectly calibrated and 44 cases is a small sample. <b>The gap between the analytic line and the empirical minimum is your calibration error, drawn.</b> It shrinks as the corpus grows; it does not shrink because you moved the threshold.</p>' +
        '<p>Drag both costs. At 20:1 the gate opens almost everything, which is correct — a missed promise is twenty times worse than an extra review. Bring the ratio toward 1:1 and the optimum walks back to the middle. The model has not changed in either direction. Only the policy changed.</p>',
      lab: 'eight',
      labTitle: 'what the gate should be set to',
      labNote: '44 replies · two error costs',
      look: 'at 1:20 the empirical argmin is 0.12 and catches all 22 promises for 7 needless reviews — 0.159 cost units per case, against 1.409 if you leave the threshold at 0.50 and miss 3 promises. The strip shows each case at its p, green above the line, grey below. Lower the false-negative cost and watch the argmin slide right.',
      why: 'A threshold is a business decision wearing a number. It belongs in the same review as the cost of the two mistakes, not in a notebook of hyperparameters. Teams that tune it on validation accuracy without costs are optimising the wrong objective and will not notice, because accuracy moves by one case.',
      src: 'Selective classification / reject option · Microsoft, "Set confidence thresholds based on the cost of false positives and false negatives"'
    },
    {
      id: 'cascade',
      nav: 'Cascades',
      kicker: 'Step 09 · act II · the second model',
      title: 'A cascade buys accuracy only when the errors differ',
      lede: 'An 87.5% keyword table and a 90% router made a 95% system, because they were wrong on different tickets.',
      body:
        '<p>The cheapest thing a team ships is a keyword table: count hits per queue, take the max. It runs in microseconds, costs nothing, and on these 40 tickets it gets 35 right (87.5%). The learned router gets 36 (90.0%). Neither is good enough alone.</p>' +
        '<p>A cascade sends the cases the cheap model is unsure about to the expensive one. Whether that helps is <em>not</em> a tuning question. It depends on one property of your traffic: how often the two models are wrong on the same case. Here the cheap model wins 3 cases the router loses, the router wins 4 the cheap one loses, and both are wrong on exactly 1. <b>That overlap is the entire opportunity.</b></p>' +
        '<p>At a 0.4 escalation threshold the cascade reaches 95.0% — better than either component — while escalating 25% of traffic. Set the threshold to 1.0 and you have bought the router and paid for all of it: 90.0% at full price. Set it to 0 and you have the keyword table. Every point between is a price you chose, and the readout prints it as a cost index.</p>' +
        '<p>On a workload where both models miss the same tickets, the middle of this range is worthless. Complementarity is a property of your traffic, not of the vendors — which is also why the published cascade gains are modest (about 1.5 points) when the strong model repeats the weak one\'s errors, and large only when it does not.</p>',
      lab: 'nine',
      labTitle: 'cheap model, then the expensive one',
      labNote: '40 tickets · measured disagreement',
      look: 'the disagreement cells are the lesson: cheap-only 3, router-only 4, both-wrong 1. Slide escalation and watch the cascade reach 95.0% at 25% escalation, then fall back toward the router as you escalate everything. The cost index moves with it: 1× at zero escalation, 13× at full escalation.',
      why: 'Most "we added a second model and got nothing" results are a complementarity failure, not a model failure. Measure both on the same cases before building the plumbing, and remember the gain is capped by the cases where they disagree — not by how good either one is.',
      src: 'arXiv 2609.26550 (92.5 vs 93.1 at 57% of fee) · arXiv 2609.32160 finding 5 (~1.5 pts when errors correlate)'
    },
    {
      id: 'slices',
      nav: 'Slices',
      kicker: 'Step 10 · act II · the mix',
      title: 'A calibration number is a property of a traffic mix',
      lede: 'Holding the model completely fixed, pooled ECE moves when you change which queue the tickets come from.',
      body:
        '<p>The router\'s per-queue gaps are stable, and they are not the same. Technical is its best class on accuracy (8 of 8) and its least honest on confidence: mean 0.734 against 1.000 accuracy, a gap of −0.266. Billing and account are near-honest. Cancellation is under by 0.114. None of those numbers move when you slide the traffic mix.</p>' +
        '<p>The <em>pooled</em> number does. It is an average over whatever you sent, so changing the share of technical tickets changes it while no weight, no per-queue accuracy and no per-queue gap changes at all. That is not a paradox; it is what an average is. A vendor\'s "ECE 0.03" is a claim about a mix, and the mix is usually theirs.</p>' +
        '<p>The worst-slice row is the one to keep. A slice can be badly mis-calibrated at every mix and still be invisible in the pooled figure — or dominate it, depending on the week. If the slice you care about is cancellation, the pooled number is not about you.</p>' +
        '<p>This is why calibration sits in Act II rather than in a footnote. It is per model, per workload, per slice — and it decays when the world moves. Act III is about what to do once it has.</p>',
      lab: 'ten',
      labTitle: 'the same model under a different mix',
      labNote: 'per-queue gaps · pooled ECE',
      look: 'technical carries a −0.266 gap at every mix, yet the pooled ECE still changes as you slide the technical share — same model, same weights, same per-queue accuracy. Temperature then moves every number at once without changing the ordering of the gaps.',
      why: 'Never accept a pooled calibration figure without the slice breakdown and the traffic mix behind it. The question is not "is this model calibrated" but "is it calibrated on the cases I am about to send it, at the rate I am about to send them".',
      src: 'arXiv 2609.32160 §7.4 (median per-benchmark ECE 0.168 vs pooled 0.047 in the same study)'
    }
  ];

  // ------------------------------------------------------------------ mount

  var nav = document.getElementById('c-nav');
  var mount = document.getElementById('c-lesson');
  var progressBar = document.getElementById('c-progress-bar');
  var railFoot = document.getElementById('c-rail-foot');
  if (!nav || !mount) return;

  var current = -1;
  var cleanup = null;
  var seen = {};

  try { seen = JSON.parse(localStorage.getItem('decfp.course.seen') || '{}'); } catch (e) { seen = {}; }

  LESSONS.forEach(function (l, i) {
    var a = document.createElement('a');
    a.href = '#' + l.id;
    a.dataset.idx = i;
    a.innerHTML = '<span class="n">' + String(i + 1).padStart(2, '0') + '</span><span>' + l.nav + '</span>';
    nav.appendChild(a);
  });

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function markSeen(i) {
    seen[LESSONS[i].id] = 1;
    try { localStorage.setItem('decfp.course.seen', JSON.stringify(seen)); } catch (e) {}
    var count = Object.keys(seen).length;
    if (progressBar) progressBar.style.width = (count / LESSONS.length * 100) + '%';
    if (railFoot) railFoot.innerHTML = count + ' of ' + LESSONS.length + ' visited · <kbd>←</kbd> <kbd>→</kbd> to move';
    Array.prototype.forEach.call(nav.children, function (a) {
      if (seen[LESSONS[Number(a.dataset.idx)].id]) a.classList.add('seen');
    });
  }

  function render(i, push) {
    if (i < 0 || i >= LESSONS.length) return;
    if (typeof cleanup === 'function') { try { cleanup(); } catch (e) {} cleanup = null; }
    current = i;
    var l = LESSONS[i];

    mount.innerHTML =
      '<div class="c-lesson">' +
        '<header class="c-head">' +
          '<p class="c-kicker">' + esc(l.kicker) + '</p>' +
          '<h1>' + esc(l.title) + '</h1>' +
          '<p class="c-lede">' + esc(l.lede) + '</p>' +
        '</header>' +
        '<div class="c-body">' + l.body +
          '<div id="lab-mount"></div>' +
          (l.look ? '<p class="c-look"><b>look for</b> ' + esc(l.look) + '</p>' : '') +
          (l.why ? '<details><summary>Why this matters</summary><p>' + esc(l.why) + '</p></details>' : '') +
          (l.src ? '<p class="foot">Sources: ' + esc(l.src) + '</p>' : '') +
        '</div>' +
        '<nav class="c-pager">' +
          (i > 0 ? '<a href="#' + LESSONS[i - 1].id + '" class="prev"><span>previous</span>← ' + esc(LESSONS[i - 1].title) + '</a>' : '') +
          (i < LESSONS.length - 1
            ? '<a href="#' + LESSONS[i + 1].id + '" class="next"><span>next</span>' + esc(LESSONS[i + 1].title) + ' →</a>'
            : '<a href="assessment.html" class="next"><span>next</span>Assess yourself →</a>') +
        '</nav>' +
      '</div>';

    Array.prototype.forEach.call(nav.children, function (a) {
      a.setAttribute('aria-current', Number(a.dataset.idx) === i ? 'true' : 'false');
    });

    var host = document.getElementById('lab-mount');
    if (host && l.lab && window.DECLABS && window.DECLABS[l.lab]) {
      var labHost;
      if (window.LABS && window.LABS.util && window.LABS.util.frame) {
        var f = window.LABS.util.frame(esc(l.labTitle || 'lab'), esc(l.labNote || ''));
        host.appendChild(f);
        labHost = f.body;
      } else {
        labHost = host;
      }
      try {
        cleanup = window.DECLABS[l.lab](labHost) || null;
      } catch (err) {
        labHost.innerHTML = '<p class="c-note">This lab failed to start: ' + esc(String(err.message || err)) + '</p>';
        if (window.console) console.error(err);
      }
    }

    // the pager is drawn above the lab body, so make sure the lab frame sits
    // before it rather than after the sources line
    markSeen(i);
    if (push !== false) {
      try { history.replaceState(null, '', '#' + l.id); } catch (e) { location.hash = l.id; }
    }
    window.scrollTo(0, 0);
    document.title = l.title + ' · Decision models';
  }

  function indexFromHash() {
    var id = (location.hash || '').replace('#', '');
    for (var i = 0; i < LESSONS.length; i++) if (LESSONS[i].id === id) return i;
    return 0;
  }

  window.addEventListener('hashchange', function () {
    var i = indexFromHash();
    if (i !== current) render(i, false);
  });

  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.metaKey || e.ctrlKey) return;
    if (e.key === 'ArrowRight') render(Math.min(LESSONS.length - 1, current + 1));
    if (e.key === 'ArrowLeft') render(Math.max(0, current - 1));
  });

  var start = indexFromHash();
  if (start === 0 && !location.hash) {
    try { history.replaceState(null, '', '#' + LESSONS[0].id); } catch (e) {}
  }
  render(start, false);
  if (progressBar) progressBar.style.width = (Object.keys(seen).length / LESSONS.length * 100) + '%';
})();
