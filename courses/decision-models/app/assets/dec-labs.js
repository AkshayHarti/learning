/* The five Act I labs. Each builds real DOM in the host and returns a cleanup fn.
 *
 * Labs receive an empty host (the .c-lab-body) and own everything inside it.
 * Numbers come from window.DEC, which fits its own small models at load time.
 */
(function () {
  'use strict';

  if (!window.LABS || !window.LABS.util) return;
  var L = window.LABS.util;
  var D = window.DEC;
  var X = window.DECLABS = window.DECLABS || {};

  var STATE = 'I was charged twice for the same order and I need one of the charges refunded.';

  // ------------------------------------------------------------------ shared

  function pane(title, note, cls) {
    var el = L.h(
      '<div class="d-pane' + (cls ? ' ' + cls : '') + '">' +
        '<div class="d-ph"><span class="t">' + title + '</span>' +
        (note ? '<span class="n">' + note + '</span>' : '') + '</div>' +
        '<div class="d-pb"></div></div>'
    );
    el.body = el.querySelector('.d-pb');
    return el;
  }

  function btn(label, cls) {
    var b = L.h('<button type="button" class="d-btn' + (cls ? ' ' + cls : '') + '">' + label + '</button>');
    return b;
  }

  function kv(rows) {
    return '<div class="d-kv">' + rows.map(function (r) {
      return '<div><span class="k">' + r[0] + '</span><span class="v' + (r[2] ? ' acc' : '') + '">' + r[1] + '</span></div>';
    }).join('') + '</div>';
  }

  function showBars(host, probs, names) {
    if (!host) return;
    var items = probs.map(function (p, i) {
      return { label: names[i], p: p, note: L.pct(p, 1) };
    });
    L.bars(host, items);
  }

  function sample(p, rnd) {
    var u = rnd(), acc = 0;
    for (var i = 0; i < p.length; i++) {
      acc += p[i];
      if (u <= acc) return i;
    }
    return p.length - 1;
  }

  // ------------------------------------------------------- 01 generator vs decider

  X.one = function (host) {
    var wrap = L.h('<div class="d-lab"></div>');
    host.appendChild(wrap);

    var ta = L.h('<textarea id="d-state-1" class="d-state" rows="2" spellcheck="false"></textarea>');
    ta.value = STATE;

    var bar = L.h('<div class="d-row"></div>');
    var run = btn('run 20 times');
    var hint = L.h('<span class="d-hint">same state, same model, two interfaces</span>');
    bar.appendChild(run);
    bar.appendChild(hint);

    var two = L.h('<div class="d-two"></div>');
    var left = pane('generator', 'samples, then you parse', 'd-gen');
    var right = pane('decision model', 'one distribution, no text', 'd-dec');
    two.appendChild(left);
    two.appendChild(right);

    var out = L.h('<pre class="d-out" aria-live="polite"></pre>');
    var lex = L.h('<div class="d-verdict"></div>');
    left.body.appendChild(out);
    left.body.appendChild(lex);

    var barsHost = L.h('<div class="d-bars-host"></div>');
    var rex = L.h('<div class="d-verdict"></div>');
    right.body.appendChild(barsHost);
    right.body.appendChild(rex);

    wrap.appendChild(L.h('<label class="d-cap" for="d-state-1">state</label>'));
    wrap.appendChild(ta);
    wrap.appendChild(bar);
    wrap.appendChild(two);

    var timer = null;

    function render() {
      var r = D.predict(ta.value);
      var names = D.OPTIONS.map(function (o) { return o.name; });

      // -- decision side: identical every time, because nothing is sampled
      showBars(barsHost, r.probabilities, names);
      rex.innerHTML = '<b>' + L.esc(r.choice) + '</b> · p ' + L.pct(r.pmax, 1) +
        ' · confidence ' + r.confidence.toFixed(3) + ' · 20 runs, 1 distinct answer';

      // -- generator side: draw 20 answers, then write one of them as tokens
      var rnd = D.utils.mulberry32((Date.now() & 0xffffff) || 1);
      var seen = Object.create(null), runs = [];
      for (var i = 0; i < 20; i++) {
        var pick = sample(r.probabilities, rnd);
        runs.push(pick);
        seen[pick] = true;
      }
      var distinct = Object.keys(seen).length;

      // A JSON object is the cheapest thing a generator can be asked for, and
      // it is still five tokens that each have to land.
      var toks = ['{', '"team"', ':', '"' + names[runs[0]] + '"', '}'];
      out.textContent = '';
      var n = 0;
      clearInterval(timer);
      timer = setInterval(function () {
        n++;
        out.textContent = toks.slice(0, n).join(' ');
        if (n >= toks.length) {
          clearInterval(timer);
          var flat = out.textContent.replace(/\s+/g, '');
          var m = flat.match(/"team":"?([a-z]+)"?/);
          lex.innerHTML = m
            ? 'parsed <b>' + m[1] + '</b> · ' + toks.length + ' tokens · ' +
              '20 draws produced <b>' + distinct + '</b> distinct answer' + (distinct > 1 ? 's' : '') +
              ' — and no probability'
            : '<b>no label found</b> · the parse failed, so the caller has nothing to act on';
        }
      }, 110);
    }

    run.addEventListener('click', render);
    ta.addEventListener('change', render);

    render();
    return function () { clearInterval(timer); };
  };

  // ------------------------------------------------------ 02 three primitives

  X.two = function (host) {
    var wrap = L.h('<div class="d-lab"></div>');
    host.appendChild(wrap);

    var tabs = L.h('<div class="d-tabs" role="tablist"></div>');
    var body = L.h('<div class="d-two"></div>');
    wrap.appendChild(tabs);
    wrap.appendChild(body);

    var MODES = {
      noul: {
        req: '{"type": "noul",\n "instructions": "Does this reply promise a refund?"}',
        note: 'One probability. No confidence field, because there is nothing to collapse.',
        state: 'I refunded your $200. You do not need to contact billing.'
      },
      choice: {
        req: '{"type": "choice",\n "criteria": {"billing": "…", "technical": "…", …}}',
        note: 'An unordered set. Confidence is (p_max − 1/n)/(1 − 1/n), a rescaling of p_max.',
        state: STATE
      },
      score: {
        req: '{"type": "score",\n "criteria": ["Calm …", "Mild …", "Frustrated …", "Furious …"]}',
        note: 'An ordered scale. The score is Σ i·pᵢ, so it lands between levels.',
        state: 'I have contacted support three times and nobody has fixed this.'
      }
    };

    var cur = 'choice';
    var ta = L.h('<textarea id="d-state-2" class="d-state" rows="2" spellcheck="false"></textarea>');
    var left = pane('request', 'what you send');
    var right = pane('answer', 'what comes back');
    body.appendChild(left);
    body.appendChild(right);

    var req = L.h('<pre class="d-out d-req"></pre>');
    left.body.appendChild(req);
    left.body.appendChild(L.h('<label class="d-cap" for="d-state-2">state</label>'));
    left.body.appendChild(ta);

    var ans = L.h('<div></div>');
    right.body.appendChild(ans);

    function draw() {
      ta.value = MODES[cur].state;
      req.textContent = MODES[cur].req;
      var html = '';

      if (cur === 'noul') {
        var n = D.predictNoul(ta.value);
        html += '<div class="d-big">' + n.p.toFixed(3) + '<span>P(true)</span></div>';
        html += '<div class="d-mini"><i style="width:' + (n.p * 100) + '%"></i></div>';
        html += kv([
          ['threshold', '0.50'],
          ['answer', n.p >= 0.5 ? 'true' : 'false', true],
          ['confidence', 'not returned']
        ]);
      } else if (cur === 'choice') {
        var c = D.predict(ta.value, D.OPTIONS);
        html += '<div class="d-bars-host"></div>';
        html += kv([
          ['choice', L.esc(c.choice), true],
          ['p_max', c.pmax.toFixed(3)],
          ['margin', c.margin.toFixed(3)],
          ['confidence', c.confidence.toFixed(3)],
          ['entropy', c.entropy.toFixed(3) + ' nats']
        ]);
      } else {
        var s = D.predictScore(ta.value, D.TONE_LEVELS);
        html += '<div class="d-bars-host"></div>';
        html += kv([
          ['score', s.score.toFixed(2), true],
          ['mode', 'L' + s.mode],
          ['confidence', s.confidence.toFixed(3)],
          ['entropy', s.entropy.toFixed(3) + ' nats']
        ]);
      }
      html += '<p class="d-note">' + MODES[cur].note + '</p>';
      ans.innerHTML = html;

      if (cur === 'choice') {
        showBars(ans.querySelector('.d-bars-host'), c.probabilities, D.OPTIONS.map(function (o) { return o.name; }));
      } else if (cur === 'score') {
        showBars(ans.querySelector('.d-bars-host'), s.probabilities, D.TONE_LEVELS.map(function (t, i) {
          return 'L' + i + ' · ' + t.split('—')[0].trim();
        }));
      }
    }

    Object.keys(MODES).forEach(function (k) {
      var b = L.h('<button type="button" role="tab" class="d-tab' + (k === cur ? ' on' : '') + '">' + k + '</button>');
      b.addEventListener('click', function () {
        cur = k;
        Array.prototype.forEach.call(tabs.children, function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        draw();
      });
      tabs.appendChild(b);
    });

    ta.addEventListener('input', draw);
    draw();
    return function () {};
  };

  // --------------------------------------------------- 03 the question is the model

  X.three = function (host) {
    var wrap = L.h('<div class="d-lab"></div>');
    host.appendChild(wrap);

    var stateTa = L.h('<textarea id="d-state-3" class="d-state" rows="2" spellcheck="false"></textarea>');
    stateTa.value = STATE;
    var instr = L.h('<input id="d-instr-3" class="d-in" type="text" spellcheck="false">');
    instr.value = 'Which team should handle this ticket?';

    wrap.appendChild(L.h('<label class="d-cap" for="d-state-3">state</label>'));
    wrap.appendChild(stateTa);
    wrap.appendChild(L.h('<label class="d-cap" for="d-instr-3">instructions <i>— changes the prompt, not the options</i></label>'));
    wrap.appendChild(instr);

    var editor = L.h('<div class="d-opt-editor"></div>');
    wrap.appendChild(L.h('<span class="d-cap">options <i>— name, then definition</i></span>'));
    wrap.appendChild(editor);

    var rows = D.OPTIONS.map(function (o, oi) {
      var row = L.h(
        '<div class="d-opt-row">' +
          '<input id="d-name-' + oi + '" class="d-in d-name" type="text" spellcheck="false" aria-label="option ' + (oi + 1) + ' name">' +
          '<input id="d-def-' + oi + '" class="d-in d-def" type="text" spellcheck="false" aria-label="option ' + (oi + 1) + ' definition">' +
        '</div>'
      );
      var n = row.querySelector('.d-name'), d = row.querySelector('.d-def');
      n.value = o.name;
      d.value = o.definition;
      n.addEventListener('input', score);
      d.addEventListener('input', score);
      editor.appendChild(row);
      return { name: n, def: d };
    });

    var bar = L.h('<div class="d-row"></div>');
    var bRot = btn('rotate definitions under fixed names');
    var bNeut = btn('neutral names, same definitions');
    var bReset = btn('reset', 'ghost');
    bar.appendChild(bRot);
    bar.appendChild(bNeut);
    bar.appendChild(bReset);
    wrap.appendChild(bar);

    var res = L.h('<div class="d-two"></div>');
    var pv = pane('this state, right now', '');
    var ev = pane('the 40 held-out tickets', 'never trained on');
    res.appendChild(pv);
    res.appendChild(ev);
    wrap.appendChild(res);

    var BASE = D.OPTIONS.map(function (o) { return { name: o.name, definition: o.definition }; });

    function current() {
      return rows.map(function (r) { return { name: r.name.value, definition: r.def.value }; });
    }

    function setOpts(list) {
      rows.forEach(function (r, i) {
        r.name.value = list[i].name;
        r.def.value = list[i].definition;
      });
      score();
    }

    function verdict(acc) {
      if (acc < 0.35) return 'The names say one thing and the definitions say another. The model follows the names. That is the whole finding, and the type checker is perfectly happy.';
      if (acc < 0.75) return 'Some answers moved while the task did not change. Option wording is not cosmetic — it is half the model.';
      if (acc > 0.93) return 'Nothing much moved. Now try rotating the definitions and watch what the names were doing all along.';
      return 'Accuracy and stability are different questions. Watch which one you were optimising.';
    }

    function score() {
      var opts = current();
      var st = stateTa.value;

      var r = D.predict(st, opts);
      pv.body.innerHTML = '<div class="d-bars-host"></div>';
      showBars(pv.body.querySelector('.d-bars-host'), r.probabilities, opts.map(function (o) { return o.name; }));
      pv.body.insertAdjacentHTML('beforeend', kv([
        ['choice', L.esc(r.choice), true],
        ['p_max', r.pmax.toFixed(3)],
        ['confidence', r.confidence.toFixed(3)]
      ]));

      var ok = 0, flips = 0, wrong = [];
      D.DEMO.forEach(function (ex) {
        var a = D.predict(ex.text, BASE).index;
        var b = D.predict(ex.text, opts).index;
        if (b === ex.label) ok++; else wrong.push(ex);
        if (a !== b) flips++;
      });
      var acc = ok / D.DEMO.length;

      ev.body.innerHTML =
        '<div class="d-two-num">' +
          '<div class="d-stat"><b>' + L.pct(acc, 1) + '</b><span>accuracy</span></div>' +
          '<div class="d-stat"><b>' + flips + '<i>/40</i></b><span>answers changed</span></div>' +
        '</div>' +
        '<div class="d-verdict">' + verdict(acc) + '</div>' +
        (wrong.length ? '<div class="d-wrong">' + wrong.slice(0, 4).map(function (w) {
          return '<div><span class="d-wl">' + L.esc(BASE[w.label].name) + '</span> → <b>' +
            L.esc(D.predict(w.text, opts).choice) + '</b> <i>' + L.esc(w.text.slice(0, 62)) + '…</i></div>';
        }).join('') + '</div>' : '');
    }

    bRot.addEventListener('click', function () {
      var cur = current();
      var defs = cur.map(function (o) { return o.definition; });
      setOpts(cur.map(function (o, i) {
        return { name: o.name, definition: defs[(i + 1) % defs.length] };
      }));
    });
    bNeut.addEventListener('click', function () {
      setOpts(BASE.map(function (o, i) { return { name: 'opt_' + (i + 1), definition: o.definition }; }));
    });
    bReset.addEventListener('click', function () { setOpts(BASE); });

    stateTa.addEventListener('input', score);
    instr.addEventListener('input', score);
    score();
    return function () {};
  };

  // -------------------------------------------------- 04 reading a distribution

  X.four = function (host) {
    var wrap = L.h('<div class="d-lab"></div>');
    host.appendChild(wrap);

    var DISTRACT = ['legal', 'sales', 'security', 'press', 'partners', 'careers', 'abuse', 'feedback', 'spam'];

    var rows = L.h('<div class="d-ctl-row"></div>');
    var hostBars = L.h('<div class="d-bars-host"></div>');
    var nums = L.h('<div class="d-grid"></div>');
    var note = L.h('<p class="d-note"></p>');
    wrap.appendChild(rows);
    wrap.appendChild(hostBars);
    wrap.appendChild(nums);
    wrap.appendChild(note);

    var S = { T: 1, extra: 0 };

    L.slider(rows, {
      key: 'temp', label: 'temperature', min: 0.2, max: 3, step: 0.05, value: 1,
      format: function (v) { return v.toFixed(2); },
      onInput: function (v) { S.T = v; draw(); }
    });
    L.slider(rows, {
      key: 'extra', label: 'extra distractor options', min: 0, max: 9, step: 1, value: 0,
      format: function (v) { return '+' + v; },
      onInput: function (v) { S.extra = v; draw(); }
    });

    function draw() {
      var opts = D.OPTIONS.concat(DISTRACT.slice(0, S.extra).map(function (n) {
        return { name: n, definition: 'General request belonging to the ' + n + ' queue.' };
      }));
      var r = D.predict(STATE, opts, S.T);
      showBars(hostBars, r.probabilities, opts.map(function (o) { return o.name; }));

      var cells = [
        ['argmax', L.esc(r.choice), true],
        ['p_max', r.pmax.toFixed(3)],
        ['margin p₁−p₂', r.margin.toFixed(3)],
        ['confidence (vendor)', r.confidence.toFixed(3)],
        ['1 − H/log n', r.normEntropy.toFixed(3)],
        ['entropy', r.entropy.toFixed(2) + ' nats'],
        ['n options', String(opts.length)],
        ['accuracy (40, T=1)', L.pct(D.evaluate(D.DEMO, D.OPTIONS, 1).accuracy, 1)]
      ];
      nums.innerHTML = cells.map(function (c) {
        return '<div class="d-cell"><span class="k">' + c[0] + '</span><span class="v' +
          (c[2] ? ' acc' : '') + '">' + c[1] + '</span></div>';
      }).join('');

      if (S.T > 1.6) {
        note.textContent = 'Flattened. p_max and confidence fall together — they are the same number wearing different hats.';
      } else if (S.T < 0.5) {
        note.textContent = 'Sharpened. Confidence is pinned near 1 while the model has learned nothing new. This is why a confidence gate can feel safe and still be wrong.';
      } else if (S.extra > 0) {
        note.textContent = 'Adding options renormalised everything. p_max fell slightly and confidence fell much further — for a reason that has nothing to do with the evidence.';
      } else {
        note.textContent = 'Confidence is a monotone function of p_max for fixed n. Margin and entropy tell you about the runner-up; confidence tells you about the winner.';
      }
    }

    draw();
    return function () {};
  };

  // ------------------------------------------------ 05 one pass, many questions

  X.five = function (host) {
    var wrap = L.h('<div class="d-lab"></div>');
    host.appendChild(wrap);

    var rows = L.h('<div class="d-ctl-row"></div>');
    var out = L.h('<div class="d-grid"></div>');
    var chartHost = L.h('<div class="d-chart"></div>');
    var banner = L.h('<div class="d-verdict"></div>');
    wrap.appendChild(rows);
    wrap.appendChild(out);
    wrap.appendChild(chartHost);
    wrap.appendChild(banner);

    var S = { q: 12, price: 0.10, serial: false };

    L.slider(rows, {
      key: 'q', label: 'questions per request', min: 1, max: 200, step: 1, value: 12,
      format: function (v) { return String(v); },
      onInput: function (v) { S.q = v; draw(); }
    });
    L.slider(rows, {
      key: 'price', label: '$ / million input tokens', min: 0.02, max: 0.60, step: 0.01, value: 0.10,
      format: function (v) { return '$' + v.toFixed(2); },
      onInput: function (v) { S.price = v; draw(); }
    });
    L.toggle(rows, {
      key: 'serial', label: 'one request per question', value: false,
      onChange: function (v) { S.serial = v; draw(); }
    });

    // A stated model, not a measurement: fixed overhead dominates, each
    // question adds a little. This is the shape vendors report, and the
    // parameters are yours to argue with.
    var OVER = 60, PER_Q = 1.1, TOK_Q = 90, TOK_STATE = 260;

    function draw() {
      var par = OVER + PER_Q * S.q;
      var ser = S.q * (OVER + PER_Q);
      var ms = S.serial ? ser : par;
      var tokens = S.serial ? S.q * (TOK_STATE + TOK_Q) : TOK_STATE + TOK_Q * S.q;
      var cost = (tokens / 1e6) * S.price;

      out.innerHTML = [
        ['requests', S.serial ? String(S.q) : '1'],
        ['latency', ms.toFixed(0) + ' ms'],
        ['input tokens', tokens.toLocaleString()],
        ['cost per call', '$' + cost.toFixed(5)],
        ['cost per question', '$' + (cost / S.q).toFixed(6)],
        ['questions / second', (1000 / (ms / S.q)).toFixed(0)]
      ].map(function (c) {
        return '<div class="d-cell"><span class="k">' + c[0] + '</span><span class="v">' + c[1] + '</span></div>';
      }).join('');

      var parPts = [], serPts = [];
      for (var q = 1; q <= 200; q += 4) {
        parPts.push([q, Math.log10(OVER + PER_Q * q)]);
        serPts.push([q, Math.log10(q * (OVER + PER_Q))]);
      }
      chartHost.innerHTML = L.lineChart({
        w: 600, h: 180, xd: [1, 200], yd: [1.4, 4.6], yLog: true,
        xTicks: 5, xLabel: 'questions in the request', yLabel: 'log₁₀ ms',
        xFmt: function (v) { return String(Math.round(v)); },
        yFmt: function (v) { return v.toFixed(1); },
        series: [
          { pts: parPts, cls: 'c-line' },
          { pts: serPts, cls: 'c-line2' }
        ]
      });

      banner.innerHTML = S.serial
        ? 'Serial. Each question is a round trip, so latency scales linearly and the state is re-sent every time. This is what a chat API makes you do.'
        : 'Parallel. One state, many independent questions, near-flat latency. The catch is the next line: <b>the questions cannot see each other\'s answers.</b> Chain them and you are back to serial.';
    }

    draw();
    return function () {};
  };
})();
