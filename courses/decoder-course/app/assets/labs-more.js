/* Labs 07–12. Same contract: build into host, return a cleanup fn. */
(function () {
  'use strict';
  var L = window.LABS;
  var TOY = window.TOY;
  var U = L.util;
  var h = U.h, esc = U.esc, fmt = U.fmt, pct = U.pct, readout = U.readout;
  var bars = U.bars, lineChart = U.lineChart, colorAccent = U.colorAccent;

  function idsOf(text) {
    var ids = [];
    TOY.words(text).forEach(function (w) {
      var id = TOY.lm.idOf.get(w);
      if (id !== undefined) ids.push(id);
    });
    return ids;
  }

  // ================================================================ 07 sampling

  L.sampling = function (host) {
    var f = U.frame('LIVE · one distribution, four ways to edit it');
    host.appendChild(f);
    var b = f.body;

    var CONTEXTS = ['the model predicts the', 'the cat sat on the', 'the loss is the', 'attention is the only place where the'];
    var st = { temp: 0.9, topK: 0, topP: 1, rep: 1, ctx: CONTEXTS[0] };

    var pickRow = h('<div class="c-flow" style="margin-bottom:8px"><span class="st">context</span></div>');
    b.appendChild(pickRow);
    var sel = h('<select class="input" id="smp-context" name="context" aria-label="Context" style="margin-bottom:4px"></select>');
    CONTEXTS.forEach(function (c) {
      sel.appendChild(h('<option value="' + esc(c) + '">' + esc(c) + ' …</option>'));
    });
    b.appendChild(sel);

    var barHost = h('<div></div>');
    b.appendChild(barHost);

    var ro = h('<div class="c-readout" style="margin-top:16px"></div>');
    b.appendChild(ro);

    var sampleHost = h('<div style="margin-top:16px"></div>');
    b.appendChild(sampleHost);

    var ctl = h('<div style="margin-top:8px"></div>');
    b.appendChild(ctl);

    var rng = TOY.rng(1234);
    var lastDraws = [];

    var tempSlider = U.slider(ctl, {
      key: 'temp', label: 'temperature', min: 0.05, max: 2, step: 0.05, value: 0.9,
      format: function (v) { return v <= 0.06 ? '0 (greedy)' : v.toFixed(2); },
      onInput: function (v) { st.temp = v <= 0.06 ? 0 : v; render(); }
    });
    var kSlider = U.slider(ctl, {
      key: 'k', label: 'top-k', min: 0, max: 40, step: 1, value: 0,
      format: function (v) { return v === 0 ? 'off' : v; },
      onInput: function (v) { st.topK = v; render(); }
    });
    var pSlider = U.slider(ctl, {
      key: 'p', label: 'top-p', min: 0.1, max: 1, step: 0.01, value: 1,
      format: function (v) { return v >= 0.995 ? 'off' : v.toFixed(2); },
      onInput: function (v) { st.topP = v; render(); }
    });
    var rSlider = U.slider(ctl, {
      key: 'rep', label: 'repetition penalty', min: 1, max: 1.9, step: 0.05, value: 1,
      format: function (v) { return v.toFixed(2); },
      onInput: function (v) { st.rep = v; render(); }
    });

    var presetRow = h('<div class="c-chips" style="margin-top:12px"></div>');
    [
      ['greedy', { temp: 0, topK: 0, topP: 1, rep: 1 }],
      ['focused', { temp: 0.5, topK: 20, topP: 0.95, rep: 1 }],
      ['balanced', { temp: 0.9, topK: 0, topP: 0.95, rep: 1 }],
      ['unhinged', { temp: 1.8, topK: 0, topP: 1, rep: 1 }]
    ].forEach(function (p) {
      var btn = h('<button class="c-chip">' + p[0] + '</button>');
      btn.addEventListener('click', function () {
        st.temp = p[1].temp; st.topK = p[1].topK; st.topP = p[1].topP; st.rep = p[1].rep;
        tempSlider.set(st.temp); kSlider.set(st.topK); pSlider.set(st.topP); rSlider.set(st.rep);
        lastDraws = [];
        render();
      });
      presetRow.appendChild(btn);
    });
    ctl.appendChild(presetRow);

    var drawRow = h('<div class="c-chips" style="margin-top:14px"></div>');
    b.appendChild(drawRow);

    function current() {
      var ids = idsOf(st.ctx);
      var base = TOY.lm.probs(ids);
      var dec = TOY.decode(base, {
        temperature: st.temp || 0,
        topK: st.topK, topP: st.topP, rep: st.rep,
        recent: ids.slice(-4)
      });
      return { base: base, adj: dec.probs, kept: dec.kept, greedy: dec.greedy };
    }

    function render() {
      var r = current();
      var base = r.base, adj = r.adj;

      var order = [];
      for (var i = 1; i < base.length; i++) order.push(i);
      order.sort(function (a, c) { return base[c] - base[a]; });
      var top = order.slice(0, 12);

      var items = top.map(function (id) {
        return {
          label: TOY.lm.vocab[id],
          p: adj[id],
          ghost: base[id],
          dropped: !r.kept[id],
          note: adj[id] > 0 ? pct(adj[id], 1) : '—'
        };
      });
      barHost.innerHTML = '';
      bars(barHost, items);

      var kept = 0, ent = 0, maxp = 0;
      for (var j = 1; j < adj.length; j++) {
        if (adj[j] > 0) { kept++; ent -= adj[j] * Math.log2(adj[j]); }
        if (adj[j] > maxp) maxp = adj[j];
      }

      ro.innerHTML = readout([
        ['greedy', r.greedy ? 'yes' : 'no'],
        ['tokens kept', kept + ' of ' + (TOY.lm.V - 1)],
        ['top token', pct(maxp, 1)],
        ['effective choices', Math.pow(2, ent).toFixed(1)],
        ['entropy', ent.toFixed(2) + ' bits']
      ]);

      var html = '<div class="lbl" style="margin-bottom:6px">draws with these settings</div><div class="c-chips">';
      if (!lastDraws.length) html += '<span class="c-chip mut">press “draw 60”</span>';
      lastDraws.forEach(function (id) {
        html += '<span class="c-chip">' + esc(TOY.lm.vocab[id]) + '</span>';
      });
      html += '</div>';
      sampleHost.innerHTML = html;
    }

    function draw(n) {
      var r = current();
      lastDraws = [];
      for (var i = 0; i < n; i++) lastDraws.push(TOY.pick(r.adj, rng));
      if (n > 20) lastDraws = lastDraws.slice(0, 20);
      render();
    }

    var btns = h('<div class="c-chips" style="margin-top:14px"></div>');
    var d60 = h('<button class="c-chip">draw 60 tokens</button>');
    d60.addEventListener('click', function () { draw(60); });
    var d1 = h('<button class="c-chip">draw 1</button>');
    d1.addEventListener('click', function () { draw(1); });
    btns.appendChild(d60); btns.appendChild(d1);
    b.appendChild(btns);

    var note = h('<p class="c-note" style="margin-top:16px">The grey tick is the original probability; the bar is what survives your filters. ' +
      'Temperature reshapes, top-k and top-p truncate, the penalty reaches back into the context.</p>');
    b.appendChild(note);

    sel.addEventListener('change', function () { st.ctx = sel.value; lastDraws = []; render(); });
    render();

    return function () {};
  };

  // ==================================================================== 08 loop

  L.loop = function (host) {
    var f = U.frame('LIVE · the autoregressive loop, one token at a time');
    host.appendChild(f);
    var b = f.body;

    var input = h('<input class="input" type="text" id="loop-prompt" name="prompt" value="the model reads the" aria-label="Prompt">');
    b.appendChild(input);

    var runRow = h('<div class="c-chips" style="margin-top:12px"></div>');
    var go = h('<button class="c-chip">generate →</button>');
    var stopBtn = h('<button class="c-chip">stop</button>');
    var clearBtn = h('<button class="c-chip">clear</button>');
    runRow.appendChild(go); runRow.appendChild(stopBtn); runRow.appendChild(clearBtn);
    b.appendChild(runRow);

    var out = h('<div class="c-chips" style="margin-top:16px;min-height:40px"></div>');
    b.appendChild(out);

    var ro = h('<div class="c-readout" style="margin-top:16px"></div>');
    b.appendChild(ro);

    var costHost = h('<div style="margin-top:22px"></div>');
    b.appendChild(costHost);

    var ctl = h('<div style="margin-top:6px"></div>');
    b.appendChild(ctl);

    var st = { layers: 32, d: 4096 };
    var heads = 32;
    U.slider(ctl, {
      key: 'layers', label: 'layers', min: 4, max: 96, step: 4, value: 32,
      format: function (v) { return v; },
      onInput: function (v) { st.layers = v; cost(); }
    });
    var dSel = h('<div class="ctl"><label class="lbl" for="loop-d">model width</label>' +
      '<select class="input" id="loop-d" style="padding:6px 8px"><option>768</option><option selected>4096</option><option>8192</option><option>12288</option></select>' +
      '<output>d_model</output></div>');
    ctl.appendChild(dSel);
    dSel.querySelector('select').addEventListener('change', function (e) {
      st.d = Number(e.target.value);
      cost();
    });

    var timer = null, running = false, seq = [];

    function stop() { running = false; if (timer) { clearTimeout(timer); timer = null; } }

    function renderSeq(fresh) {
      out.innerHTML = seq.map(function (w, i) {
        var last = i >= seq.length - 1;
        return '<span class="c-chip' + (last && fresh ? ' on' : '') + '">' + esc(w) + '</span>';
      }).join('');
      var n = seq.length;
      var curCtx = idsOf(seq.slice(-8).join(' '));
      ro.innerHTML = readout([
        ['tokens', n],
        ['context', n + ' + prompt'],
        ['attention ops', (st.layers * n * n).toLocaleString()],
        ['kv cache', kvMB(st.layers, st.d, n) + ' MB']
      ]);
    }

    function kvMB(layers, d, n) {
      // K and V, 2 bytes per number at fp16
      return (2 * layers * d * n * 2 / 1048576).toFixed(1);
    }

    function tick() {
      if (!running) return;
      var ctx = idsOf(seq.slice(-8).join(' '));
      var p = TOY.lm.probs(ctx);
      var id = TOY.pick(p, Math.random);
      seq.push(TOY.lm.vocab[id]);
      if (seq.length > 90) { stop(); renderSeq(false); return; }
      renderSeq(true);
      timer = setTimeout(tick, 70);
    }

    function start() {
      stop();
      var prompt = TOY.words(input.value);
      seq = prompt.slice();
      running = true;
      renderSeq(false);
      timer = setTimeout(tick, 120);
    }

    go.addEventListener('click', start);
    stopBtn.addEventListener('click', function () { stop(); });
    clearBtn.addEventListener('click', function () { stop(); seq = []; out.innerHTML = ''; renderSeq(false); });

    function cost() {
      var pts = [];
      for (var n = 1; n <= 4096; n += 32) pts.push([n, st.layers * n * n * st.d / 1e9]);
      costHost.innerHTML = '<div class="lbl" style="margin-bottom:6px">attention work vs context length · ' +
        st.layers + ' layers, d=' + st.d + '</div>' +
        lineChart({
          w: 620, h: 160, xd: [0, 4096], yd: [0, Math.max(1, pts[pts.length - 1][1])],
          xTicks: 4, yLabel: 'GFLOP per token', xLabel: 'context length',
          xFmt: function (v) { return Math.round(v); },
          yFmt: function (v) { return v.toFixed(0); },
          series: [{ pts: pts, area: true }],
          marker: seq.length || undefined,
          markerLabel: seq.length ? 'you are here' : ''
        });
      renderSeq(false);
    }

    cost();
    return stop;
  };

  // ================================================================== 09 train

  L.train = function (host) {
    var f = U.frame('LIVE · a real model, real gradients, real overfitting');
    host.appendChild(f);
    var b = f.body;

    var st = { hidden: 32, lr: 0.01, batch: 24, ctx: 2 };
    var tr = null, timer = null, vals = [], running = false;

    var chartHost = h('<div></div>');
    b.appendChild(chartHost);

    var ro = h('<div class="c-readout" style="margin-top:8px"></div>');
    b.appendChild(ro);

    var sampleHost = h('<div class="c-note" style="margin-top:12px;min-height:44px">—</div>');
    b.appendChild(sampleHost);

    var ctl = h('<div style="margin-top:6px"></div>');
    b.appendChild(ctl);

    var hiddenS = U.slider(ctl, {
      key: 'hidden', label: 'hidden units', min: 8, max: 64, step: 4, value: 32,
      format: function (v) { return v; },
      onInput: function (v) { st.hidden = v; reset(); }
    });
    var lrS = U.slider(ctl, {
      key: 'lr', label: 'learning rate', min: 0.001, max: 0.05, step: 0.001, value: 0.01,
      format: function (v) { return v.toFixed(3); },
      onInput: function (v) { st.lr = v; reset(); }
    });
    var batchS = U.slider(ctl, {
      key: 'batch', label: 'batch size', min: 8, max: 64, step: 8, value: 24,
      format: function (v) { return v; },
      onInput: function (v) { st.batch = v; reset(); }
    });
    var ctxS = U.slider(ctl, {
      key: 'ctx', label: 'context tokens', min: 1, max: 2, step: 1, value: 2,
      format: function (v) { return v; },
      onInput: function (v) { st.ctx = v; reset(); }
    });

    var btnRow = h('<div class="c-chips" style="margin-top:12px"></div>');
    var more = h('<button class="c-chip">train 400 more</button>');
    var resetBtn = h('<button class="c-chip">reset</button>');
    btnRow.appendChild(more); btnRow.appendChild(resetBtn);
    b.appendChild(btnRow);

    var paramsHost = h('<p class="c-note" style="margin-top:14px"></p>');
    b.appendChild(paramsHost);

    function paramCount() {
      var V = TOY.lm.V;
      return V * 6 + (st.ctx * 6) * st.hidden + st.hidden + st.hidden * V + V;
    }

    function reset() {
      stop();
      tr = TOY.createTrainer({ lm: TOY.lm, hidden: st.hidden, lr: st.lr, batch: st.batch, ctx: st.ctx, seed: 7 });
      vals = [];
      sampleHost.textContent = '—';
      paramsHost.innerHTML = 'This network has <b>' + paramCount().toLocaleString() +
        '</b> parameters, ' + TOY.lm.ids.length.toLocaleString() +
        ' tokens of training data, and a vocabulary of ' + TOY.lm.V + '. GPT-4 has roughly 10¹¹ parameters and 10¹³ tokens. ' +
        'The loop below is the same loop.';
      render();
      run(400);
    }

    function run(n) {
      if (running) return;
      running = true;
      var target = tr.steps + n;
      var t0 = performance.now();
      function chunk() {
        if (!running) return;
        for (var i = 0; i < 10 && tr.steps < target; i++) tr.step();
        if (tr.steps % 50 === 0) {
          vals.push([tr.steps, tr.valLoss()]);
          if (vals.length > 120) vals = vals.filter(function (_, i) { return i % 2 === 0; });
        }
        render();
        if (tr.steps < target) { timer = setTimeout(chunk, 8); }
        else {
          running = false;
          sampleHost.innerHTML = '<span style="color:#5d646f">sample from “the model reads the” →</span> ' +
            'the model reads the ' + esc(tr.sample(18, 0.8, 'the model reads the')) +
            '<br><span style="color:#5d646f">' + (performance.now() - t0).toFixed(0) + ' ms of compute on your machine</span>';
        }
      }
      chunk();
    }

    function stop() {
      running = false;
      if (timer) { clearTimeout(timer); timer = null; }
    }

    function render() {
      if (!tr) return;
      var hist = tr.history;
      var trainPts = [];
      var stride = Math.max(1, Math.floor(hist.length / 220));
      for (var i = 0; i < hist.length; i += stride) trainPts.push([hist[i][0], hist[i][1]]);
      if (hist.length) trainPts.push([hist[hist.length - 1][0], hist[hist.length - 1][1]]);

      var maxY = 6;
      trainPts.forEach(function (p) { maxY = Math.max(maxY, p[1]); });
      vals.forEach(function (p) { maxY = Math.max(maxY, p[1]); });
      maxY = Math.min(maxY, 12);

      chartHost.innerHTML = '<div class="lbl" style="margin-bottom:6px">loss · lower is less surprised</div>' +
        lineChart({
          w: 620, h: 190, xd: [0, Math.max(200, tr.steps)], yd: [0, maxY],
          xTicks: 4, yTicks: 4, xLabel: 'step', yLabel: 'bits',
          xFmt: function (v) { return Math.round(v); },
          yFmt: function (v) { return v.toFixed(1); },
          series: [
            { pts: trainPts, cls: 'c-line', area: true },
            { pts: vals, cls: 'c-line2' }
          ]
        });

      var last = hist.length ? hist[hist.length - 1][1] : NaN;
      var v = vals.length ? vals[vals.length - 1][1] : NaN;
      ro.innerHTML = readout([
        ['step', tr.steps],
        ['train loss', isFinite(last) ? last.toFixed(3) : '—'],
        ['val loss', isFinite(v) ? v.toFixed(3) : '—'],
        ['perplexity', isFinite(last) ? Math.exp(last).toFixed(1) : '—'],
        ['params', paramCount().toLocaleString()]
      ]);
    }

    more.addEventListener('click', function () { run(400); });
    resetBtn.addEventListener('click', reset);

    reset();
    // let the first run finish, then show the sample
    setTimeout(function () { render(); }, 600);

    return stop;
  };

  // ------------------------------------------------- learning rate, one dimension

  L.lr = function (host) {
    var f = U.frame('LIVE · what a learning rate actually does');
    host.appendChild(f);
    var b = f.body;

    var st = { lr: 0.4 };
    var chartHost = h('<div></div>');
    b.appendChild(chartHost);
    var ro = h('<div class="c-readout" style="margin-top:6px"></div>');
    b.appendChild(ro);

    U.slider(b, {
      key: 'lrdemo', label: 'learning rate', min: 0.02, max: 1.15, step: 0.01, value: 0.4,
      format: function (v) { return v.toFixed(2); },
      onInput: function (v) { st.lr = v; render(); }
    });

    function fOf(w) { return 0.35 * (w - 0.6) * (w - 0.6) + 0.2; }
    function gOf(w) { return 0.7 * (w - 0.6); }

    function render() {
      var w = 2.6;
      var steps = [[w, fOf(w)]];
      var verdict = 'converged';
      for (var i = 0; i < 16; i++) {
        w = w - st.lr * gOf(w);
        if (!isFinite(w) || Math.abs(w) > 40) { verdict = 'diverged'; break; }
        steps.push([w, fOf(w)]);
      }
      if (verdict !== 'diverged') {
        var last = steps[steps.length - 1][0], prev = steps[steps.length - 2][0];
        if (Math.abs(last - 0.6) > 0.2) verdict = 'still moving';
        else if (Math.abs(last - prev) < 0.01) verdict = 'converged';
        else verdict = 'oscillating';
      }

      var curve = [];
      for (var x = -2; x <= 5.5; x += 0.1) curve.push([x, fOf(x)]);

      chartHost.innerHTML = '<div class="lbl" style="margin-bottom:6px">gradient descent on a 1-D loss</div>' +
        lineChart({
          w: 620, h: 210, xd: [-2, 5.5], yd: [0, Math.max(4, Math.min(12, steps.reduce(function (a, s) { return Math.max(a, s[1]); }, 0) * 1.2))],
          xTicks: 5, yTicks: 4, xLabel: 'parameter w', yLabel: 'loss',
          series: [
            { pts: curve, cls: 'c-line', area: false },
            { pts: steps, cls: 'c-line2', dots: true }
          ]
        });

      var finalW = steps[steps.length - 1][0];
      ro.innerHTML = readout([
        ['step size', st.lr.toFixed(2)],
        ['final w', isFinite(finalW) ? finalW.toFixed(2) : '∞'],
        ['final loss', isFinite(steps[steps.length - 1][1]) ? steps[steps.length - 1][1].toFixed(3) : '∞'],
        ['behaviour', verdict]
      ]);
    }

    render();
    return function () {};
  };

  // ================================================================== 10 scale

  L.scale = function (host) {
    var f = U.frame('LIVE · the loss surface in parameters and tokens');
    host.appendChild(f);
    var b = f.body;

    var st = { logN: 9, logD: 10 };
    var chartHost = h('<div></div>');
    b.appendChild(chartHost);
    var ro = h('<div class="c-readout" style="margin-top:8px"></div>');
    b.appendChild(ro);

    var ctl = h('<div style="margin-top:6px"></div>');
    b.appendChild(ctl);

    var nS = U.slider(ctl, {
      key: 'logN', label: 'parameters', min: 6, max: 12, step: 0.1, value: 9,
      format: function (v) { return '10^' + v.toFixed(1); },
      onInput: function (v) { st.logN = v; render(); }
    });
    var dS = U.slider(ctl, {
      key: 'logD', label: 'training tokens', min: 8, max: 14, step: 0.1, value: 10,
      format: function (v) { return '10^' + v.toFixed(1); },
      onInput: function (v) { st.logD = v; render(); }
    });

    var presets = h('<div class="c-chips" style="margin-top:12px"></div>');
    [
      ['GPT-2 small', 9.18, 10.48],
      ['GPT-3', 11.24, 11.48],
      ['Chinchilla', 10.85, 12.15]
    ].forEach(function (p) {
      var btn = h('<button class="c-chip">' + p[0] + '</button>');
      btn.addEventListener('click', function () {
        st.logN = p[1]; st.logD = p[2]; nS.set(p[1]); dS.set(p[2]); render();
      });
      presets.appendChild(btn);
    });
    ctl.appendChild(presets);

    function render() {
      var N = Math.pow(10, st.logN), D = Math.pow(10, st.logD);
      var loss = TOY.scalingLoss(N, D);

      var curve = [];
      for (var e = 6; e <= 12; e += 0.1) curve.push([e, TOY.scalingLoss(Math.pow(10, e), D)]);

      chartHost.innerHTML = '<div class="lbl" style="margin-bottom:6px">loss vs parameters, holding data at 10^' +
        st.logD.toFixed(1) + ' tokens</div>' +
        lineChart({
          w: 620, h: 190, xd: [6, 12], yd: [1.6, 4.2], xTicks: 6, yTicks: 4,
          xLabel: 'parameters', yLabel: 'loss (nats/token)',
          xFmt: function (v) { return '1e' + v.toFixed(0); },
          yFmt: function (v) { return v.toFixed(1); },
          series: [{ pts: curve, area: true }],
          marker: st.logN, markerLabel: 'you'
        });

      var flops = 6 * N * D;
      ro.innerHTML = readout([
        ['loss', loss.toFixed(3)],
        ['perplexity', Math.exp(loss).toFixed(1)],
        ['tokens / param', (D / N).toFixed(1)],
        ['compute', fmt(flops, 1) + ' FLOP'],
        ['irreducible floor', '1.69']
      ]);
    }

    render();
    return function () {};
  };

  // =================================================================== 11 align

  L.align = function (host) {
    var f = U.frame('LIVE · a reward model reweights what the base model already believed');
    host.appendChild(f);
    var b = f.body;

    var CANDIDATES = [
      { text: 'Yes — the bug is in the mask. Here are the three lines to change.', base: 0.42, reward: 0.9 },
      { text: 'It depends on your setup; both approaches are defensible.', base: 0.31, reward: 0.55 },
      { text: 'Great question! I would be happy to help you with that today.', base: 0.19, reward: -0.5 },
      { text: 'I cannot help with that request.', base: 0.08, reward: -1.1 }
    ];

    var st = { beta: 1.0 };
    var barHost = h('<div></div>');
    b.appendChild(barHost);
    var ro = h('<div class="c-readout" style="margin-top:8px"></div>');
    b.appendChild(ro);

    U.slider(b, {
      key: 'beta', label: 'β · how strictly reward is enforced', min: 0.1, max: 3, step: 0.05, value: 1,
      format: function (v) { return v.toFixed(2); },
      onInput: function (v) { st.beta = v; render(); }
    });

    function render() {
      var z = 0;
      var adj = CANDIDATES.map(function (c) {
        var w = c.base * Math.exp(c.reward / st.beta);
        z += w;
        return w;
      });
      adj = adj.map(function (w) { return w / z; });

      var kl = 0;
      CANDIDATES.forEach(function (c, i) {
        if (adj[i] > 0) kl += adj[i] * Math.log(adj[i] / c.base);
      });

      barHost.innerHTML = '';
      var items = CANDIDATES.map(function (c, i) {
        return { label: 'reply ' + (i + 1), p: adj[i], ghost: c.base, note: pct(adj[i], 1) };
      }).sort(function (a, c) { return c.p - a.p; });
      bars(barHost, items);

      var bestIdx = 0;
      adj.forEach(function (p, i) { if (p > adj[bestIdx]) bestIdx = i; });

      ro.innerHTML = readout([
        ['winner', 'reply ' + (bestIdx + 1)],
        ['p(winner)', pct(adj[bestIdx], 1)],
        ['KL from base', kl.toFixed(3) + ' nats'],
        ['base p(winner)', pct(CANDIDATES[bestIdx].base, 1)]
      ]);

      var lines = '<div class="c-note" style="margin-top:14px">';
      CANDIDATES.forEach(function (c, i) {
        lines += '<div style="margin-bottom:6px"><b>reply ' + (i + 1) + '</b> <span style="color:#5d646f">reward ' +
          (c.reward > 0 ? '+' : '') + c.reward.toFixed(1) + '</span> — “' + esc(c.text) + '”</div>';
      });
      lines += '</div>';
      noteHost.innerHTML = lines;
    }

    var noteHost = h('<div></div>');
    b.appendChild(noteHost);

    render();
    return function () {};
  };

  // ============================================================== 12 playground

  L.playground = function (host) {
    var f = U.frame('LIVE · every knob in one place');
    host.appendChild(f);
    var b = f.body;

    var st = {
      temp: 0.85, topK: 0, topP: 0.95, rep: 1.1, seed: 42, n: 24,
      prompt: 'the model reads the'
    };

    var input = h('<input class="input" type="text" id="pg-prompt" name="prompt" value="' + esc(st.prompt) + '" aria-label="Prompt">');
    b.appendChild(input);

    var btnRow = h('<div class="c-chips" style="margin-top:10px"></div>');
    var go = h('<button class="c-chip on">generate</button>');
    var again = h('<button class="c-chip">resample</button>');
    var clear = h('<button class="c-chip">clear</button>');
    btnRow.appendChild(go); btnRow.appendChild(again); btnRow.appendChild(clear);
    b.appendChild(btnRow);

    var out = h('<div class="c-chips" style="margin-top:16px;min-height:36px"></div>');
    b.appendChild(out);

    var trace = h('<div style="margin-top:18px"></div>');
    b.appendChild(trace);

    var ctl = h('<div style="margin-top:10px"></div>');
    b.appendChild(ctl);

    var tempS = U.slider(ctl, { key: 'pg-temp', label: 'temperature', min: 0.05, max: 1.8, step: 0.05, value: st.temp,
      format: function (v) { return v <= 0.06 ? 'greedy' : v.toFixed(2); },
      onInput: function (v) { st.temp = v <= 0.06 ? 0 : v; } });
    var kS = U.slider(ctl, { key: 'pg-k', label: 'top-k', min: 0, max: 40, step: 1, value: 0,
      format: function (v) { return v === 0 ? 'off' : v; },
      onInput: function (v) { st.topK = v; } });
    var pS = U.slider(ctl, { key: 'pg-p', label: 'top-p', min: 0.1, max: 1, step: 0.01, value: 0.95,
      format: function (v) { return v >= 0.995 ? 'off' : v.toFixed(2); },
      onInput: function (v) { st.topP = v; } });
    var rS = U.slider(ctl, { key: 'pg-rep', label: 'repetition penalty', min: 1, max: 1.9, step: 0.05, value: 1.1,
      format: function (v) { return v.toFixed(2); },
      onInput: function (v) { st.rep = v; } });
    var seedS = U.slider(ctl, { key: 'pg-seed', label: 'seed', min: 1, max: 999, step: 1, value: 42,
      format: function (v) { return v; },
      onInput: function (v) { st.seed = v; } });
    var nS = U.slider(ctl, { key: 'pg-n', label: 'tokens', min: 8, max: 60, step: 1, value: 24,
      format: function (v) { return v; },
      onInput: function (v) { st.n = v; } });

    var seq = [];
    var rng = TOY.rng(st.seed);

    function generate() {
      st.prompt = input.value;
      rng = TOY.rng(Math.floor(st.seed) * 7919 + (st.resample || 0));
      seq = TOY.words(st.prompt);
      var lastTrace = null;

      for (var i = 0; i < st.n; i++) {
        var ctxText = seq.slice(-3).join(' ');
        var ids = idsOf(ctxText);
        var base = TOY.lm.probs(ids);
        var dec = TOY.decode(base, { temperature: st.temp, topK: st.topK, topP: st.topP, rep: st.rep, recent: ids.slice(-4) });
        var id = TOY.pick(dec.probs, rng);
        if (i === st.n - 1) lastTrace = { ctxText: ctxText, base: base, adj: dec.probs, id: id, kept: dec.kept };
        seq.push(TOY.lm.vocab[id]);
      }

      render(lastTrace);
    }

    function render(t) {
      var promptLen = TOY.words(st.prompt).length;
      out.innerHTML = seq.map(function (w, i) {
        return '<span class="c-chip' + (i < promptLen ? ' mut' : '') + '">' + esc(w) + '</span>';
      }).join('');

      if (!t) { trace.innerHTML = ''; return; }

      function top3(probs) {
        var order = [];
        for (var i = 1; i < probs.length; i++) order.push(i);
        order.sort(function (a, c) { return probs[c] - probs[a]; });
        return order.slice(0, 3).map(function (id) {
          return esc(TOY.lm.vocab[id]) + ' <b style="color:#7dd3a0">' + (probs[id] * 100).toFixed(1) + '%</b>';
        }).join(' · ');
      }

      trace.innerHTML = '<div class="c-pipe">' +
        '<span class="box">context<b>' + esc(t.ctxText || '∅') + '</b></span><span class="arrow">→</span>' +
        '<span class="box">logits<b>' + top3(t.base) + '</b></span><span class="arrow">→</span>' +
        '<span class="box">after filters<b>' + top3(t.adj) + '</b></span><span class="arrow">→</span>' +
        '<span class="box">sample<b>' + esc(TOY.lm.vocab[t.id]) + '</b></span>' +
        '</div><p class="c-note" style="margin-top:10px">The last token of this run, traced end to end. ' +
        'The context is two tokens wide because the toy model is a 3-gram; a transformer would read the whole window.</p>';
    }

    go.addEventListener('click', function () { st.resample = 0; generate(); });
    again.addEventListener('click', function () { st.resample = (st.resample || 0) + 1; generate(); });
    clear.addEventListener('click', function () { seq = []; out.innerHTML = ''; trace.innerHTML = ''; });

    generate();
    return function () {};
  };
})();
