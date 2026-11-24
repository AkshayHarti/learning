/* The course: twelve lessons, one page, no dependencies. */
(function () {
  'use strict';

  var LESSONS = [
    {
      id: 'prediction',
      nav: 'Prediction',
      kicker: 'Step 01 · the whole idea',
      title: 'A language model is a next-token guesser',
      lede: 'Strip away the chat box and the API. What is left is a function: read a sequence, return one probability for every token that could come next.',
      body:
        '<p>That is the entire contract. Not understanding, not reasoning — a <strong>distribution over the vocabulary, conditioned on the context</strong>. A decoder-only model like GPT is a stack of layers whose only job is to make that distribution accurate.</p>' +
        '<p>Everything else in this course is a consequence of that sentence plus one constraint: it has to run on a GPU. Sampling, context windows, KV caches, temperature, even the assistant persona — all downstream.</p>' +
        '<p>The model below is small on purpose. It is a <strong>3-gram model with backoff</strong> trained on the corpus embedded in this page, about a thousand tokens of text. Its interface is identical to GPT\'s: give it a context, get a probability for every token. Its depth is not. Treat it as a wind tunnel, not a jet.</p>',
      lab: 'predict',
      look: 'click a bar to append that token and watch the distribution move. Nothing about the model changed — only the context did. That is the second step of every generation loop, forever.',
      why: 'Once you see generation as a loop of "condition, predict, sample, append", most model behaviour stops being mysterious. Repetition is a sampler stuck in a loop. Confident nonsense is a distribution that is sharp and wrong. A refusal is a distribution shifted by training. The mechanism is always this one.',
      link: ['01-entropy.html', 'prediction as compression']
    },
    {
      id: 'tokens',
      nav: 'Tokens',
      kicker: 'Step 02 · the input',
      title: 'Tokens are learned, not given',
      lede: 'A model never sees characters. It sees integers from a fixed vocabulary, and the vocabulary is built by frequency, not by linguistics.',
      body:
        '<p>Byte-pair encoding starts with characters and repeatedly merges the most frequent adjacent pair. Merge rank 0 might be <code>t+h</code>, merge rank 40 might be <code>the</code>, and after a few hundred merges you have a vocabulary that is cheap for common words and brutal for rare ones.</p>' +
        '<p>Two consequences follow immediately. First, the model\'s unit of cost is the token, so a page of English and a page of JSON cost very different amounts. Second, <strong>the tokenizer decides what the model can see easily</strong>. A word that fragments into five pieces is five chances to lose the thread — which is why models miscount letters in words they have never tokenized whole.</p>' +
        '<p>The slider below retrains nothing. It replays the merge list learned from this page\'s corpus, in rank order, which is exactly how a real tokenizer applies its vocabulary.</p>',
      lab: 'tokens',
      look: 'at 0 merges the text is characters. Around 40, whole common words appear. At the far end, <b>predicts</b> is still a splinter while <b>the</b> is one piece. Frequency is the only thing that decided.',
      why: 'A large share of "the model is bad at X" reports are tokenizer reports. Arithmetic, spelling, long identifiers, non-Latin scripts, and trailing whitespace all break at this layer before any attention head is involved. When something is weird, tokenize it first.',
      link: ['02-bpe.html', 'byte-pair encoding']
    },
    {
      id: 'embeddings',
      nav: 'Embeddings',
      kicker: 'Step 03 · the representation',
      title: 'Meaning becomes geometry',
      lede: 'Each token id indexes a vector of numbers. Similar contexts pull vectors together, so direction becomes a usable stand-in for meaning.',
      body:
        '<p>The embedding table is just a lookup: token id in, vector out. Nothing about it is semantic until training pushes it around. What training asks is narrow and indirect — <em>make the next-token prediction better</em> — and the geometry is what falls out.</p>' +
        '<p>Similarity is measured by the cosine of the angle between two vectors, which is their dot product after normalising both to length one. The absolute lengths do not matter; the direction does.</p>' +
        '<p>The map below is computed live. It is <strong>positive pointwise mutual information</strong> over a ±3-token window, reduced to two dimensions by power iteration — a classical count-based embedding, not a neural one. The geometry behaves the same way, and you can compute it from the text on this page.</p>',
      lab: 'embed',
      look: 'click <b>cat</b>, then <b>model</b>, then <b>attention</b>. The neighbours are not synonyms; they are words that appeared in similar places. That is the whole claim, and it is weaker than "understands".',
      why: 'Vector arithmetic — king − man + woman — works because directions encode recurring contrasts, not because the model has a concept of royalty. It is a useful probe and a bad explanation. The same geometry is why retrieval works: a question and its answer land near each other.',
      link: ['03-embeddings.html', 'embedding geometry']
    },
    {
      id: 'position',
      nav: 'Position',
      kicker: 'Step 04 · the missing coordinate',
      title: 'Order is information',
      lede: 'Attention compares every token with every other token. By itself it is a set operation: shuffle the input and the arithmetic does not notice.',
      body:
        '<p>"The cat sat on the mat" and "the mat sat on the cat" are the same bag of tokens. Without a position signal, a transformer sees them as identical. Position is not a detail; it is the difference between language and a word cloud.</p>' +
        '<p>The original recipe adds a fixed sinusoid to each embedding. Each dimension oscillates at a different frequency: fast dimensions distinguish neighbouring positions, slow dimensions distinguish paragraphs. The pattern is a clock with many hands, all reading the same tick.</p>' +
        '<p>Modern models mostly use <strong>RoPE</strong> instead, which rotates the query and key vectors by an angle proportional to position, so the dot product depends on the <em>relative</em> distance between two tokens. Same idea, better arithmetic. The sinusoid below is the version you can see.</p>',
      lab: 'position',
      look: 'nearby positions have high cosine similarity and far positions are nearly orthogonal. Some rows stripe quickly (high frequency, local order) and some barely change (low frequency, global order).',
      why: 'This is why order in a prompt matters, why "put the instruction last" is real advice, and why long-context models degrade in the middle: relative position gets harder to resolve as the window grows, and the clock hands start to alias.',
      link: ['04-attention.html', 'attention and position']
    },
    {
      id: 'attention',
      nav: 'Attention',
      kicker: 'Step 05 · the core mechanism',
      title: 'Attention is a differentiable lookup',
      lede: 'Every token asks a question, every token advertises a key, and the answer is a weighted average of what the other tokens carry.',
      body:
        '<p>Three learned projections per token. A <strong>query</strong>: what am I looking for? A <strong>key</strong>: what do I offer? A <strong>value</strong>: what do I pass along if chosen? Compare a query against every key with a dot product, turn the scores into a probability row with a softmax, and mix the values with those weights.</p>' +
        '<p>Two details do real work. The scores are divided by <code>√d</code> so their size does not grow with dimension — otherwise the softmax saturates and the gradient dies. And the <strong>causal mask is applied before the softmax</strong>, setting every future position to −∞ so a token can never read the token it is supposed to predict.</p>' +
        '<p>One head can only express one relation. A block runs many heads in parallel and concatenates them, which is why a layer can track subject-verb agreement in one head and copy a name from the prompt in another.</p>',
      lab: 'attention',
      look: 'change one number in Q and watch a single row of the weight matrix move. Drop the temperature and a row becomes a hard lookup. Remove the mask and row 0 can see token 4 — the answer key inside the question.',
      why: 'Attention is the only place where tokens exchange information, so every capability that depends on context is a claim about these rows. It is also where interpretability claims go wrong: a high weight means information flowed, not that the model understood the relationship.',
      link: ['04-attention.html', 'scaled dot-product attention']
    },
    {
      id: 'blocks',
      nav: 'Blocks',
      kicker: 'Step 06 · the architecture',
      title: 'The residual stream is the working memory',
      lede: 'A transformer is not a pipeline that transforms one vector into another. It is one shared vector that every block reads from and writes to.',
      body:
        '<p>Each block does two things: attention mixes information between positions, then a small MLP transforms each position independently. Both write their result <em>back into</em> the stream through a residual connection: <code>x = x + block(x)</code>.</p>' +
        '<p>That plus sign is why deep transformers train at all. Gradients flow straight down the residual highway, and each block only has to learn a small correction rather than a full replacement. It is also why the stream keeps a roughly constant norm while its <em>direction</em> carries the computation.</p>' +
        '<p><strong>LayerNorm</strong> rescales the stream after each write. Without it, residual additions compound: the norm grows with depth, the logits grow with the norm, the softmax becomes a step function, and the gradient through it becomes zero.</p>',
      lab: 'block',
      look: 'turn off LayerNorm with residuals on and watch the norm climb on a log axis, then the logit span with it. Turn off residuals instead and depth stops accumulating anything. Both toggles break the model in different ways.',
      why: 'This is the mental model that generalises: layers are not stages, they are edits to a shared scratchpad. It explains why mid-layer interventions work, why "the model knows it is lying" is a meaningful claim about a direction in the stream, and why normalisation choices matter more than they look.',
      link: ['04-attention.html', 'one block, drawn']
    },
    {
      id: 'sampling',
      nav: 'Sampling',
      kicker: 'Step 07 · the output',
      title: 'Logits become text',
      lede: 'Temperature, top-k, top-p and repetition penalty are four different edits to one distribution. None of them change what the model knows.',
      body:
        '<p>The final layer emits a <strong>logit</strong> per token, not a probability. Softmax turns logits into a distribution: exponentiate, divide by the sum. Temperature divides the logits <em>before</em> that step, so a low temperature exaggerates differences and a high one smooths them away.</p>' +
        '<p><strong>Top-k</strong> keeps the k highest-probability tokens. <strong>Top-p</strong> keeps the smallest set whose cumulative mass passes p, so it adapts: a confident model keeps two options, an uncertain one keeps fifty. Greedy decoding is just argmax, and it is deterministic — which also means it loops.</p>' +
        '<p>The grey tick below is the model\'s original probability. The green bar is what survives your filters.</p>',
      lab: 'sampling',
      look: 'set temperature to 0 and every draw is the same token. Set top-k to 1 and the temperature stops mattering. Move top-p to 0.5 and watch the cut move on its own as the context changes.',
      why: 'Almost every "the model is being weird" complaint is sampler configuration, not model quality. Repetition at low temperature, incoherence at high temperature, and truncation artifacts from aggressive top-k are all mechanical and all fixable.',
      link: ['05-sampling.html', 'nucleus sampling']
    },
    {
      id: 'loop',
      nav: 'The loop',
      kicker: 'Step 08 · inference',
      title: 'Generation is a loop, and the loop has a price',
      lede: 'One token per forward pass. Append it to the context and run the whole thing again.',
      body:
        '<p>There is no separate "writing" mode. The model produces one token, the token joins the prompt, and the next forward pass reads a longer sequence. Twenty-four tokens means twenty-four passes through every layer.</p>' +
        '<p>Naively, each pass would recompute keys and values for every past token. The <strong>KV cache</strong> stores them, so a new token only computes its own. That is why the first token feels slow and the rest stream: prefill is parallel, decode is sequential.</p>' +
        '<p>Attention itself is quadratic in context length. Doubling the window quadruples the attention work, and the cache grows linearly with every token you keep. This is the entire economics of long context.</p>',
      lab: 'loop',
      look: 'press generate and watch the attention-op counter. Then drag layers up: the cost multiplies, the output does not change. Compute is not quality.',
      why: 'This loop explains latency (time to first token versus tokens per second), the price of long documents, and why "just give it more context" is a budget decision rather than a capability one.',
      link: ['05-sampling.html', 'decoding in practice']
    },
    {
      id: 'training',
      nav: 'Training',
      kicker: 'Step 09 · how the numbers are found',
      title: 'Training is gradient descent on surprise',
      lede: 'The loss is how surprised the model was by the token that actually came next, measured in bits. The gradient says which way to move each parameter.',
      body:
        '<p>Cross-entropy loss is <code>−log p(correct token)</code>. A model that assigned 100% to the right token pays 0 bits. A model that spread its mass evenly over 300 tokens pays 8.2 bits. Training is the search for parameters that pay less.</p>' +
        '<p>Backpropagation computes the derivative of that loss with respect to every parameter, and an optimiser — usually Adam — takes a small step downhill. The step size is the learning rate, and it is the single most consequential hyperparameter in the room.</p>' +
        '<p>The model below is a real one: an embedding, one hidden layer, and a softmax. It trains in your browser with real gradients, and it is small enough to overfit in seconds — which is the second half of the lesson.</p>',
      lab: 'train',
      look: 'the solid line is training loss and the dashed line is held-out loss. Training keeps falling; validation turns up. That gap is memorisation, and no amount of extra steps closes it.',
      why: 'This curve, scaled up by six orders of magnitude, is the whole industry. More parameters and more data move it down; better data moves it down further per token; and the gap between the two lines is why evaluation exists.',
      link: ['01-entropy.html', 'surprisal and entropy']
    },
    {
      id: 'scale',
      nav: 'Scale',
      kicker: 'Step 10 · why bigger works',
      title: 'Scale buys loss, and loss buys behaviour',
      lede: 'Loss falls as a power law in parameters and in data. That regularity is why labs spend billions on a curve they can plot in advance.',
      body:
        '<p>Fit the loss of hundreds of runs against model size and token count, and you get something embarrassingly tidy: <code>L = E + A/N^α + B/D^β</code>. Two reducible terms, one floor. The exponents are stable across many orders of magnitude.</p>' +
        '<p>The practical consequence is a budget split. For a fixed compute budget <code>≈ 6ND</code>, there is an optimal balance between parameters and tokens. The Chinchilla result was that most large models of its era were badly undertrained on data — the fix was more tokens, not more weights.</p>' +
        '<p>The floor <code>E</code> is irreducible entropy of natural language under this model family. You can approach it. You cannot pass it by scaling alone.</p>',
      lab: 'scale',
      look: 'hit the three presets and compare the tokens-per-parameter ratio. GPT-3 was trained on roughly one token per parameter; Chinchilla argued for twenty.',
      why: 'Scaling laws let you predict a run before paying for it, which is why they are guarded. They also bound the story: past a point, the curve is flat enough that data quality, post-training, and tooling buy more than raw size.',
      link: ['01-entropy.html', 'the entropy floor']
    },
    {
      id: 'alignment',
      nav: 'Alignment',
      kicker: 'Step 11 · from text to assistant',
      title: 'Why it feels like a decision',
      lede: 'A base model continues text. An assistant is the same model with its distribution pushed toward answers a reward model prefers.',
      body:
        '<p>Supervised fine-tuning teaches format: here is a question, here is the shape of a good answer. Preference optimisation — RLHF or DPO — goes further and reweights whole responses. The update has a clean form: <code>p_new ∝ p_base · exp(r/β)</code>, where <code>r</code> is the reward and <code>β</code> controls how far you are allowed to move.</p>' +
        '<p>Small β means the reward dominates and the policy collapses onto whatever scores highest. Large β keeps the base model\'s diversity and the reward barely matters. The KL divergence is a direct measure of how much you changed the model\'s mind.</p>' +
        '<p>This is why an assistant feels like it is deciding something. It is still sampling a distribution — the distribution has just been edited, and the edit is where the personality, the refusals, and the sycophancy live.</p>',
      lab: 'align',
      look: 'push β to 0.2 and the top reply takes almost all the mass. Pull it to 3 and the base model shows through again. The knowledge did not change at any point.',
      why: 'Most disagreements about model "values" are disagreements about the reward model and the β, not about what the pretrained model knows. It also explains why alignment can make a model less accurate: you are trading probability mass away from the true continuation toward the preferred one.',
      link: ['05-sampling.html', 'reweighting a distribution']
    },
    {
      id: 'playground',
      nav: 'Playground',
      kicker: 'Step 12 · all of it',
      title: 'The whole machine, one panel',
      lede: 'Every knob from the course, and a trace of the last token from context to sample.',
      body:
        '<p>This is the loop from step 1 with the machinery from steps 2–8 attached. Change the seed and the same settings reproduce the same text — determinism is a property of the sampler, not of the model.</p>' +
        '<p class="c-note" style="margin-top:0">The language ability here is a 3-gram model, which is why the output reads like a word salad with good grammar. A transformer replaces the n-gram with attention over the whole context. The pipeline around it is the same pipeline.</p>' +
        '<h3>The pipeline, in eight lines</h3>' +
        '<div class="c-pipe">' +
        '<span class="box">text<b>prompt</b></span><span class="arrow">→</span>' +
        '<span class="box">tokens<b>ids</b></span><span class="arrow">→</span>' +
        '<span class="box">embed<b>vectors</b></span><span class="arrow">→</span>' +
        '<span class="box">+ position<b>ordered</b></span><span class="arrow">→</span>' +
        '<span class="box">blocks × N<b>attention + mlp</b></span><span class="arrow">→</span>' +
        '<span class="box">logits<b>V numbers</b></span><span class="arrow">→</span>' +
        '<span class="box">filters<b>temp · k · p</b></span><span class="arrow">→</span>' +
        '<span class="box">sample<b>1 token</b></span>' +
        '</div>' +
        '<p style="margin-top:16px">Then the sampled token is appended and the last box feeds the first box. That is the whole of inference.</p>',
      lab: 'playground',
      look: 'change the seed and nothing else: the distribution is identical, the text is different. That is the difference between the model and the sampler in one click.',
      why: 'You now have a checklist for every LLM bug report: tokenize it, look at the distribution, check the sampler, check the context window, check what training optimised. Each question has a specific place to look.',
      link: ['../', 'all five deep-dive explorables']
    }
  ];

  var nav = document.getElementById('c-nav');
  var mount = document.getElementById('c-lesson');
  var progressBar = document.getElementById('c-progress-bar');
  var railFoot = document.getElementById('c-rail-foot');
  var current = -1;
  var cleanup = null;
  var seen = {};

  try {
    seen = JSON.parse(localStorage.getItem('llmfp.course.seen') || '{}');
  } catch (e) { seen = {}; }

  LESSONS.forEach(function (l, i) {
    var a = document.createElement('a');
    a.href = '#' + l.id;
    a.dataset.idx = i;
    a.innerHTML = '<span class="n">' + String(i + 1).padStart(2, '0') + '</span><span>' +
      (l.nav || l.title) + '</span>';
    nav.appendChild(a);
  });

  function markSeen(i) {
    seen[LESSONS[i].id] = 1;
    try { localStorage.setItem('llmfp.course.seen', JSON.stringify(seen)); } catch (e) {}
    var count = Object.keys(seen).length;
    progressBar.style.width = (count / LESSONS.length * 100) + '%';
    railFoot.innerHTML = count + ' of ' + LESSONS.length + ' visited · <kbd>←</kbd> <kbd>→</kbd> to move';
    Array.prototype.forEach.call(nav.children, function (a) {
      if (seen[LESSONS[Number(a.dataset.idx)].id]) a.classList.add('seen');
    });
  }

  function render(i, push) {
    if (i < 0 || i >= LESSONS.length) return;
    if (typeof cleanup === 'function') { try { cleanup(); } catch (e) {} cleanup = null; }
    current = i;
    var l = LESSONS[i];

    var html =
      '<div class="c-lesson">' +
        '<header class="c-head">' +
          '<p class="c-kicker">' + l.kicker + '</p>' +
          '<h1>' + l.title + '</h1>' +
          '<p class="c-lede">' + l.lede + '</p>' +
        '</header>' +
        '<div class="c-body">' + l.body +
          '<div id="lab-mount"></div>' +
          (l.look ? '<p class="c-look"><b>look for</b> ' + l.look + '</p>' : '') +
          (l.why ? '<details><summary>Why this matters</summary><p>' + l.why + '</p></details>' : '') +
          (l.link ? '<p class="foot">Go deeper: <a href="' + l.link[0] + '">' + l.link[1] + '</a></p>' : '') +
        '</div>' +
        '<nav class="c-pager">' +
          (i > 0 ? '<a href="#' + LESSONS[i - 1].id + '" class="prev"><span>previous</span>← ' + LESSONS[i - 1].title + '</a>' : '') +
          (i < LESSONS.length - 1 ? '<a href="#' + LESSONS[i + 1].id + '" class="next"><span>next</span>' + LESSONS[i + 1].title + ' →</a>' : '') +
        '</nav>' +
      '</div>';

    mount.innerHTML = html;

    Array.prototype.forEach.call(nav.children, function (a) {
      a.setAttribute('aria-current', Number(a.dataset.idx) === i ? 'true' : 'false');
    });

    var labHost = document.getElementById('lab-mount');
    if (l.lab && window.LABS[l.lab]) {
      try {
        cleanup = window.LABS[l.lab](labHost) || null;
      } catch (err) {
        labHost.innerHTML = '<div class="c-lab"><div class="c-lab-body"><p class="c-note">This lab failed to start: ' +
          String(err.message || err) + '</p></div></div>';
        if (window.console) console.error(err);
      }
    }

    markSeen(i);
    if (push !== false) {
      try { history.replaceState(null, '', '#' + l.id); } catch (e) { location.hash = l.id; }
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
    document.title = l.title + ' · LLM first principles';
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
    if (e.key === 'ArrowRight') { render(Math.min(LESSONS.length - 1, current + 1)); }
    if (e.key === 'ArrowLeft') { render(Math.max(0, current - 1)); }
  });

  var start = indexFromHash();
  if (start === 0 && !location.hash) {
    try { history.replaceState(null, '', '#' + LESSONS[0].id); } catch (e) {}
  }
  render(start, false);
  progressBar.style.width = (Object.keys(seen).length / LESSONS.length * 100) + '%';
})();
