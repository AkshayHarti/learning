/* Act II labs — steps 06–10. The statistics that make a distribution usable.
 *
 * Same contract as dec-labs.js: build into the host, return a cleanup fn.
 * Every number is computed from window.DEC at call time. Nothing is decorative.
 */
(function () {
  'use strict';

  if (!window.LABS || !window.LABS.util) return;
  var L = window.LABS.util;
  var D = window.DEC;
  var X = window.DECLABS = window.DECLABS || {};

  var STATE = 'I was charged twice for the same order and I need one of the charges refunded.';

  // ------------------------------------------------------------------ shared

  function pane(title, note) {
    var el = L.h(
      '<div class="d-pane"><div class="d-ph"><span class="t">' + title + '</span>' +
      (note ? '<span class="n">' + note + '</span>' : '') + '</div><div class="d-pb"></div></div>'
    );
    el.body = el.querySelector('.d-pb');
    return el;
  }

  function btn(label, cls) {
    return L.h('<button type="button" class="d-btn' + (cls ? ' ' + cls : '') + '">' + label + '</button>');
  }

  function kv(rows) {
    return '<div class="d-kv">' + rows.map(function (r) {
      return '<div><span class="k">' + r[0] + '</span><span class="v' + (r[2] ? ' acc' : '') + '">' + r[1] + '</span></div>';
    }).join('') + '</div>';
  }

  function note(text) {
    return '<p class="d-note">' + text + '</p>';
  }

  // Reliability diagram: one dot per non-empty bin, radius ∝ √n, against the
  // 45° line. Deliberately small — it is a diagnostic, not a dashboard.
  function reliability(bins) {
    var w = 280, h = 280, pad = 40, s = w - pad - 16;
    function Xp(v) { return pad + v * s; }
    function Yp(v) { return h - pad - v * (h - pad - 16); }
    var g = '<svg class="d-rel" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="reliability diagram">';
    g += '<rect x="' + pad + '" y="16" width="' + s + '" height="' + (h - pad - 16) + '" fill="none" stroke="#232830"/>';
    for (var t = 0; t <= 1.001; t += 0.25) {
      g += '<line x1="' + Xp(t) + '" y1="16" x2="' + Xp(t) + '" y2="' + (h - pad) + '" stroke="#161b21"/>';
      g += '<line x1="' + pad + '" y1="' + Yp(t) + '" x2="' + (pad + s) + '" y2="' + Yp(t) + '" stroke="#161b21"/>';
      g += '<text x="' + (pad - 6) + '" y="' + (Yp(t) + 3) + '" text-anchor="end" class="d-ax">' + t.toFixed(2) + '</text>';
      g += '<text x="' + Xp(t) + '" y="' + (h - pad + 13) + '" text-anchor="middle" class="d-ax">' + t.toFixed(2) + '</text>';
    }
    g += '<line x1="' + Xp(0) + '" y1="' + Yp(0) + '" x2="' + Xp(1) + '" y2="' + Yp(1) + '" stroke="#4c545f" stroke-dasharray="3 3"/>';
    var maxN = 1;
    bins.forEach(function (b) { if (b.n > maxN) maxN = b.n; });
    bins.forEach(function (b) {
      var r = 2.5 + Math.sqrt(b.n / maxN) * 5.5;
      var above = b.acc > b.conf;
      g += '<circle cx="' + Xp(b.conf).toFixed(1) + '" cy="' + Yp(b.acc).toFixed(1) + '" r="' + r.toFixed(1) +
        '" fill="' + (above ? '#7dd3a0' : '#c8a0a0') + '" fill-opacity=".22" stroke="' +
        (above ? '#7dd3a0' : '#c8a0a0') + '" stroke-opacity=".8"/>';
    });
    g += '<text x="' + (pad + s / 2) + '" y="' + (h - 4) + '" text-anchor="middle" class="d-ax">stated confidence</text>';
    g += '<text x="12" y="' + (h / 2) + '" text-anchor="middle" transform="rotate(-90 12 ' + (h / 2) + ')" class="d-ax">observed accuracy</text>';
    g += '</svg>';
    return g;
  }

  // A probability strip: every case as a tick at its p, with the current cut.
  function strip(preds, cut) {
    var w = 560, h = 62, pad = 8;
    var g = '<svg class="d-strip" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="probability strip">';
    g += '<line x1="' + pad + '" y1="34" x2="' + (w - pad) + '" y2="34" stroke="#232830"/>';
    for (var t = 0; t <= 1.0001; t += 0.1) {
      var x = pad + t * (w - pad * 2);
      g += '<line x1="' + x + '" y1="30" x2="' + x + '" y2="38" stroke="#2c333d"/>';
      g += '<text x="' + x + '" y="52" text-anchor="middle" class="d-ax">' + t.toFixed(1) + '</text>';
    }
    preds.forEach(function (o) {
      var x = pad + o.p * (w - pad * 2);
      var y = o.y ? 24 : 44;
      g += '<circle cx="' + x.toFixed(1) + '" cy="' + y + '" r="3.1" fill="' +
        (o.y ? '#7dd3a0' : '#8b929e') + '" fill-opacity=".85"/>';
    });
    if (cut !== undefined) {
      var cx = pad + cut * (w - pad * 2);
      g += '<line x1="' + cx.toFixed(1) + '" y1="14" x2="' + cx.toFixed(1) + '" y2="44" stroke="#e8e6e1" stroke-width="1.4"/>';
      g += '<text x="' + cx.toFixed(1) + '" y="10" text-anchor="middle" class="d-ax">cut ' + cut.toFixed(2) + '</text>';
    }
    g += '</svg>';
    return g;
  }
  X.strip = strip;

  // ------------------------------------------------------- 06 calibration

  X.six = function (host) {
    var wrap = L.h('<div class="d-lab"></div>');
    host.appendChild(wrap);

    var S = { head: 'router', T: 1 };

    var tabs = L.h('<div class="d-tabs" role="tablist"></div>');
    var ctl = L.h('<div class="d-ctl-row"></div>');
    var two = L.h('<div class="d-two"></div>');
    var relPane = pane('reliability', 'dots on the line = honest');
    var outPane = pane('numbers', 'accuracy does not move');
    var charts = L.h('<div class="d-two d-charts"></div>');
    var tail = L.h('<div></div>');
    two.appendChild(relPane);
    two.appendChild(outPane);
    wrap.appendChild(tabs);
    wrap.appendChild(ctl);
    wrap.appendChild(two);
    wrap.appendChild(charts);
    wrap.appendChild(tail);

    var sliderT = L.slider(ctl, {
      key: 'cal-t', label: 'temperature', min: 0.3, max: 3, step: 0.01, value: 1,
      format: function (v) { return v.toFixed(2); },
      onInput: function (v) { S.T = v; draw(); }
    });

    var snap = btn('snap to fitted T');
    var reset = btn('back to raw (T = 1)', 'ghost');
    var row = L.h('<div class="d-row"></div>');
    row.appendChild(snap);
    row.appendChild(reset);
    ctl.appendChild(row);

    ['router', 'refund'].forEach(function (k) {
      var b = L.h('<button type="button" role="tab" class="d-tab' + (k === S.head ? ' on' : '') + '">' + k + '</button>');
      b.addEventListener('click', function () {
        S.head = k;
        Array.prototype.forEach.call(tabs.children, function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        draw();
      });
      tabs.appendChild(b);
    });

    snap.addEventListener('click', function () {
      S.T = D.temperatures[S.head];
      sliderT.set(S.T);
      draw();
    });
    reset.addEventListener('click', function () {
      S.T = 1;
      sliderT.set(1);
      draw();
    });

    function current() {
      return S.head === 'router'
        ? D.evaluate(D.DEMO, D.OPTIONS, S.T)
        : D.evaluateHead('refund', D.REFUND_CASES, S.T);
    }

    function draw() {
      var e = current();
      relPane.body.innerHTML = reliability(e.reliability);
      outPane.body.innerHTML = kv([
        ['ECE', e.ece.toFixed(3), true],
        ['Brier', e.brier.toFixed(4)],
        ['log loss', e.nll.toFixed(3)],
        ['accuracy', L.pct(e.accuracy, 1)],
        ['n', String(e.n)],
        ['fitted T', D.temperatures[S.head].toFixed(2)]
      ]);

      // ECE and NLL as functions of T. Two charts, because they disagree.
      var curve = D.tempCurve(S.head);
      var ecePts = curve.map(function (p) { return [p.T, p.ece]; });
      var nllPts = curve.map(function (p) { return [p.T, p.nll]; });
      var maxE = 0.02, maxN = 0.02;
      curve.forEach(function (p) { if (p.ece > maxE) maxE = p.ece; if (p.nll > maxN) maxN = p.nll; });

      charts.innerHTML =
        '<div class="d-pane"><div class="d-ph"><span class="t">ECE vs temperature</span></div>' +
        '<div class="d-pb"><div class="d-chart">' + L.lineChart({
          w: 380, h: 150, xd: [0.3, 3], yd: [0, maxE * 1.15], xTicks: 3, yTicks: 3,
          xLabel: 'T', yLabel: 'ECE',
          xFmt: function (v) { return v.toFixed(1); },
          yFmt: function (v) { return v.toFixed(2); },
          series: [{ pts: ecePts, cls: 'c-line' }],
          marker: S.T, markerLabel: 'you'
        }) + '</div></div></div>' +
        '<div class="d-pane"><div class="d-ph"><span class="t">log loss vs temperature</span></div>' +
        '<div class="d-pb"><div class="d-chart">' + L.lineChart({
          w: 380, h: 150, xd: [0.3, 3], yd: [Math.max(0, Math.min.apply(null, nllPts.map(function (p) { return p[1]; })) * 0.8), maxN * 1.1],
          xTicks: 3, yTicks: 3,
          xLabel: 'T', yLabel: 'nats',
          xFmt: function (v) { return v.toFixed(1); },
          yFmt: function (v) { return v.toFixed(2); },
          series: [{ pts: nllPts, cls: 'c-line' }],
          marker: S.T, markerLabel: 'you'
        }) + '</div></div></div>';

      var t = D.temperatures[S.head];
      var at = S.head === 'router' ? D.evaluate(D.DEMO, D.OPTIONS, t) : D.evaluateHead('refund', D.REFUND_CASES, t);
      var r1 = S.head === 'refund' ? D.evaluateHead('refund', D.REFUND_CASES, 1) : null;
      var topBin = r1 ? r1.reliability[r1.reliability.length - 1] : null;
      tail.innerHTML = note(S.head === 'router'
        ? 'The router needs the correction: one scalar T = ' + t.toFixed(2) +
          ' takes ECE from ' + D.evaluate(D.DEMO, D.OPTIONS, 1).ece.toFixed(3) + ' to ' +
          at.ece.toFixed(3) + ', and accuracy is ' + L.pct(e.accuracy, 1) + ' at every temperature. ' +
          'Fitting a temperature cannot make a model better; it can only make its number mean what it says.'
        : 'The refund head needs nothing. Its fit returns T = ' + t.toFixed(2) + ' and ECE moves ' +
          D.evaluateHead('refund', D.REFUND_CASES, 1).ece.toFixed(3) + ' → ' + at.ece.toFixed(3) + '. ' +
          'Its most confident bin claims ' + topBin.conf.toFixed(3) + ' and delivers ' + topBin.acc.toFixed(3) + ' ' +
          'over ' + topBin.n + ' cases. Same code, same page, opposite ' +
          'conclusion from the router — which is the reason you fit instead of assuming a direction. ' +
          'Note also what a temperature cannot do: repair a rubric whose options overlap. No scalar ' +
          'sharpens one end of a scale while softening the other.');
    }

    draw();
    return function () {};
  };

  // ------------------------------------------- 07 what a probability buys you

  X.seven = function (host) {
    var wrap = L.h('<div class="d-lab"></div>');
    host.appendChild(wrap);

    var S = { T: 1 };

    var ctl = L.h('<div class="d-ctl-row"></div>');
    var table = L.h('<div class="d-tbl-host"></div>');
    var worst = L.h('<div class="d-two"></div>');
    var tail = L.h('<div></div>');
    wrap.appendChild(ctl);
    wrap.appendChild(table);
    wrap.appendChild(worst);
    wrap.appendChild(tail);

    var slider = L.slider(ctl, {
      key: 'buy-t', label: 'temperature', min: 0.3, max: 3, step: 0.01, value: 1,
      format: function (v) { return v.toFixed(2); },
      onInput: function (v) { S.T = v; draw(); }
    });

    function casesAt(T) {
      return D.DEMO.map(function (ex) {
        var r = D.predict(ex.text, D.OPTIONS, T);
        return {
          text: ex.text, label: ex.label, choice: r.choice,
          p: r.probabilities[ex.label],
          ok: r.index === ex.label,
          loss: -Math.log(Math.max(1e-12, r.probabilities[ex.label]))
        };
      });
    }

    function draw() {
      var rows = [0.3, 0.53, 1, 1.5, 2, 3].map(function (T) {
        var e = D.evaluate(D.DEMO, D.OPTIONS, T);
        var cur = Math.abs(T - S.T) < 0.03;
        return { T: T, e: e, cur: cur };
      });
      table.innerHTML =
        '<table class="d-table"><thead><tr>' +
          '<th>T</th><th>accuracy</th><th>Brier</th><th>log loss</th><th>ECE</th>' +
        '</tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr' + (r.cur ? ' class="on"' : '') + '><td>' + r.T.toFixed(2) + '</td>' +
            '<td>' + L.pct(r.e.accuracy, 1) + '</td>' +
            '<td>' + r.e.brier.toFixed(4) + '</td>' +
            '<td>' + r.e.nll.toFixed(3) + '</td>' +
            '<td>' + r.e.ece.toFixed(3) + '</td></tr>';
        }).join('') +
        '</tbody></table>';

      var cs = casesAt(S.T);
      var byLoss = cs.slice().sort(function (a, b) { return b.loss - a.loss; });
      var top = byLoss[0];
      var good = cs.slice().sort(function (a, b) { return a.loss - b.loss; })[0];

      worst.innerHTML =
        '<div class="d-pane"><div class="d-ph"><span class="t">most expensive case</span><span class="n">T = ' + S.T.toFixed(2) + '</span></div>' +
        '<div class="d-pb">' +
          '<div class="d-big">' + top.loss.toFixed(2) + '<span>nats</span></div>' +
          '<p class="d-quote">“' + L.esc(top.text.slice(0, 96)) + '…”</p>' +
          kv([['true class', L.esc(D.OPTIONS[top.label].name)], ['model said', L.esc(top.choice), true],
              ['p(true class)', top.p.toFixed(4)]]) +
        '</div></div>' +
        '<div class="d-pane"><div class="d-ph"><span class="t">cheapest case</span><span class="n">same model</span></div>' +
        '<div class="d-pb">' +
          '<div class="d-big">' + good.loss.toFixed(3) + '<span>nats</span></div>' +
          '<p class="d-quote">“' + L.esc(good.text.slice(0, 96)) + '…”</p>' +
          kv([['true class', L.esc(D.OPTIONS[good.label].name)], ['model said', L.esc(good.choice), true],
              ['p(true class)', good.p.toFixed(4)]]) +
        '</div></div>';

      var e1 = D.evaluate(D.DEMO, D.OPTIONS, 1);
      tail.innerHTML = note(
        'Accuracy is <b>' + L.pct(e1.accuracy, 1) + '</b> in every row of that table, at every temperature, ' +
        'for every scoring rule. Temperature cannot change which class wins. What it changes is how much ' +
        'you are punished for being confident and wrong: at T = ' + S.T.toFixed(2) + ' the worst single case ' +
        'costs <b>' + top.loss.toFixed(2) + ' nats</b>, and log loss averages exactly that over the 40 cases. ' +
        'If you only ever report accuracy, these rows are indistinguishable — which is why "we are 90% accurate" ' +
        'is not a statement about risk.'
      );
    }

    draw();
    return function () {};
  };

  // ------------------------------------------ 08 thresholds and expected cost

  X.eight = function (host) {
    var wrap = L.h('<div class="d-lab"></div>');
    host.appendChild(wrap);

    var S = { cFP: 1, cFN: 20 };

    var ctl = L.h('<div class="d-ctl-row"></div>');
    var grid = L.h('<div class="d-grid"></div>');
    var chart = L.h('<div class="d-chart"></div>');
    var stripHost = L.h('<div class="d-strip-host"></div>');
    var tail = L.h('<div></div>');
    wrap.appendChild(ctl);
    wrap.appendChild(grid);
    wrap.appendChild(chart);
    wrap.appendChild(stripHost);
    wrap.appendChild(tail);

    L.slider(ctl, {
      key: 'cfp', label: 'cost of a false positive', min: 0.1, max: 10, step: 0.1, value: 1,
      format: function (v) { return v.toFixed(1); },
      onInput: function (v) { S.cFP = v; draw(); }
    });
    L.slider(ctl, {
      key: 'cfn', label: 'cost of a false negative', min: 1, max: 60, step: 1, value: 20,
      format: function (v) { return v.toFixed(0); },
      onInput: function (v) { S.cFN = v; draw(); }
    });

    function draw() {
      var preds = D.binaryPreds(1);
      var pts = D.sweep(S.cFP, S.cFN, 1);
      var best = D.bestThreshold(S.cFP, S.cFN, 1);
      var at50 = pts.reduce(function (a, b) { return Math.abs(b.t - 0.5) < Math.abs(a.t - 0.5) ? b : a; });
      var maxCost = 0;
      pts.forEach(function (p) { if (p.cost > maxCost) maxCost = p.cost; });

      grid.innerHTML = [
        ['analytic p*', best.analytic.toFixed(3), true],
        ['empirical argmin', 'T = ' + best.t.toFixed(2)],
        ['cost at 0.50', at50.cost.toFixed(3)],
        ['cost at argmin', best.cost.toFixed(3), true],
        ['saved per 1k', ((at50.cost - best.cost) * 1000).toFixed(0)],
        ['missed promises @0.5', String(at50.fn)],
        ['missed promises @opt', String(best.fn)],
        ['needless reviews @opt', String(best.fp)],
        ['cases', String(preds.length)]
      ].map(function (c) {
        return '<div class="d-cell"><span class="k">' + c[0] + '</span><span class="v' + (c[2] ? ' acc' : '') + '">' + c[1] + '</span></div>';
      }).join('');

      chart.innerHTML = L.lineChart({
        w: 620, h: 200, xd: [0, 1], yd: [0, maxCost * 1.08], xTicks: 5, yTicks: 4,
        xLabel: 'threshold on P(promises a refund)', yLabel: 'expected cost / case',
        xFmt: function (v) { return v.toFixed(1); },
        yFmt: function (v) { return v.toFixed(2); },
        series: [{ pts: pts.map(function (p) { return [p.t, p.cost]; }), cls: 'c-line', area: true }],
        marker: best.t, markerLabel: 'argmin ' + best.t.toFixed(2)
      });

      stripHost.innerHTML = strip(preds, best.t);

      var ratio = (S.cFN / S.cFP).toFixed(0);
      tail.innerHTML = note(
        'A missing promise costs ' + ratio + '× an unnecessary review, so the gate should be trigger-happy: ' +
        'the analytic optimum is <b>c<sub>FP</sub>/(c<sub>FP</sub>+c<sub>FN</sub>) = ' + best.analytic.toFixed(3) +
        '</b>, nowhere near 0.5. The empirical argmin lands at ' + best.t.toFixed(2) + ' instead, because the model ' +
        'is not perfectly calibrated and 44 cases is a small sample — the gap between the two is your calibration ' +
        'error, made visible. Costs are in arbitrary units; only ratios matter.'
      );
    }

    draw();
    return function () {};
  };

  // ----------------------------------------------- 09 escalation and cascades

  X.nine = function (host) {
    var wrap = L.h('<div class="d-lab"></div>');
    host.appendChild(wrap);

    var S = { th: 0.4, routerCost: 12 };

    var ctl = L.h('<div class="d-ctl-row"></div>');
    var two = L.h('<div class="d-two"></div>');
    var quad = pane('where the two models disagree', '40 cases');
    var outP = pane('the cascade', 'accuracy bought with escalation');
    two.appendChild(quad);
    two.appendChild(outP);
    var tail = L.h('<div></div>');
    wrap.appendChild(ctl);
    wrap.appendChild(two);
    wrap.appendChild(tail);

    L.slider(ctl, {
      key: 'esc', label: 'escalate below confidence', min: 0, max: 1, step: 0.01, value: 0.4,
      format: function (v) { return v.toFixed(2); },
      onInput: function (v) { S.th = v; draw(); }
    });
    L.slider(ctl, {
      key: 'rcost', label: 'router cost (cheap = 1)', min: 2, max: 40, step: 1, value: 12,
      format: function (v) { return v.toFixed(0) + '×'; },
      onInput: function (v) { S.routerCost = v; draw(); }
    });

    function draw() {
      var c = D.cascade(D.DEMO, S.th, 1);

      var cells = [
        ['both right', Math.round(c.bothRight * 40), true],
        ['cheap only', c.cheapOnly],
        ['router only', c.routerOnly],
        ['both wrong', Math.round(c.bothWrong * 40)],
        ['complementarity', L.pct(c.complementarity, 1)],
        ['agreement', L.pct(c.agreement, 1)]
      ];
      quad.body.innerHTML = '<div class="d-grid d-grid-3">' + cells.map(function (x) {
        return '<div class="d-cell"><span class="k">' + x[0] + '</span><span class="v' + (x[2] ? ' acc' : '') + '">' + x[1] + '</span></div>';
      }).join('') + '</div>' +
        note('The two models are wrong on <b>different</b> cases. That is the only reason a cascade can work.');

      // Cost index: cheap = 1 unit, router = routerCost units, per escalated case.
      var cost = 1 + c.escalateRate * S.routerCost;
      outP.body.innerHTML = kv([
        ['cheap alone', L.pct(c.cheapAccuracy, 1)],
        ['router alone', L.pct(c.routerAccuracy, 1)],
        ['cascade', L.pct(c.finalAccuracy, 1), true],
        ['escalated', L.pct(c.escalateRate, 1)],
        ['kept: accuracy', L.pct(c.keptAccuracy, 1)],
        ['escalated: accuracy', L.pct(c.escalatedAccuracy, 1)],
        ['cost index', cost.toFixed(2) + '×'],
        ['cost at 100% escalation', (1 + S.routerCost).toFixed(0) + '×']
      ]);

      // Find the threshold that hits the router's accuracy at the lowest cost,
      // so the lesson can name the operating point rather than the curve.
      var best = null;
      for (var th = 0; th <= 1.0001; th += 0.02) {
        var r = D.cascade(D.DEMO, th, 1);
        var cst = 1 + r.escalateRate * S.routerCost;
        if (r.finalAccuracy >= c.routerAccuracy - 1e-9 && (!best || cst < best.cost)) best = { th: th, cost: cst, acc: r.finalAccuracy, esc: r.escalateRate };
      }

      tail.innerHTML = note(
        c.finalAccuracy > c.routerAccuracy
          ? 'At this threshold the cascade is <b>' + L.pct(c.finalAccuracy, 1) + '</b> — better than either model ' +
            'alone — for a cost index of ' + cost.toFixed(1) + '× against ' + (1 + S.routerCost).toFixed(0) +
            '× for routing everything. The gain is not from a better model; it is from two models that fail differently.'
          : 'At this threshold you are paying for the router and getting the cheap model\'s accuracy back, or you are ' +
            'escalating so little that the router never sees the hard cases. ' +
            (best ? 'The router\'s ' + L.pct(c.routerAccuracy, 1) + ' is reachable at ' + L.pct(best.esc, 1) +
              ' escalation (' + best.cost.toFixed(1) + '× cost).' : '')
      ) + note(
        'Set escalation to 1.0 and you have bought the router and paid for all of it. Set it to 0 and you have ' +
        'the keyword table. <b>Every point in between is a price you chose.</b> Note also what this lab does ' +
        'not show: on a workload where both models miss the same cases, the middle of this range is worthless. ' +
        'Complementarity is a property of your traffic, not of the vendors.'
      );
    }

    draw();
    return function () {};
  };

  // ---------------------------------------- 10 per-workload calibration

  X.ten = function (host) {
    var wrap = L.h('<div class="d-lab"></div>');
    host.appendChild(wrap);

    var S = { mix: 1, temp: 1 };

    var ctl = L.h('<div class="d-ctl-row"></div>');
    var table = L.h('<div class="d-tbl-host"></div>');
    var grid = L.h('<div class="d-grid"></div>');
    var tail = L.h('<div></div>');
    wrap.appendChild(ctl);
    wrap.appendChild(table);
    wrap.appendChild(grid);
    wrap.appendChild(tail);

    L.slider(ctl, {
      key: 'mix', label: 'technical share of traffic', min: 1, max: 6, step: 1, value: 1,
      format: function (v) { return v + '×'; },
      onInput: function (v) { S.mix = v; draw(); }
    });
    L.slider(ctl, {
      key: 'ptemp', label: 'temperature', min: 0.3, max: 3, step: 0.01, value: 1,
      format: function (v) { return v.toFixed(2); },
      onInput: function (v) { S.temp = v; draw(); }
    });

    function draw() {
      var cls = D.byClass('router', null, S.temp);

      table.innerHTML =
        '<table class="d-table"><thead><tr><th>queue</th><th>n</th><th>accuracy</th><th>mean p</th><th>gap</th></tr></thead><tbody>' +
        cls.map(function (b) {
          var sign = b.gap >= 0 ? '+' : '−';
          var cls2 = Math.abs(b.gap) > 0.1 ? ' class="warn"' : '';
          return '<tr' + cls2 + '><td>' + L.esc(b.name) + '</td><td>' + b.n + '</td>' +
            '<td>' + L.pct(b.accuracy, 1) + '</td><td>' + b.meanP.toFixed(3) + '</td>' +
            '<td>' + sign + Math.abs(b.gap).toFixed(3) + '</td></tr>';
        }).join('') + '</tbody></table>';

      // Pooled metrics under a reweighted traffic mix: repeat the technical
      // cases so they carry more of the workload. ECE is an average over
      // samples, so changing the mix changes the pooled number with the model
      // held completely fixed.
      var weighted = [];
      D.DEMO.forEach(function (ex) {
        var copies = ex.label === 1 ? S.mix : 1;
        for (var i = 0; i < copies; i++) weighted.push(ex);
      });
      var pooled = D.evaluate(weighted, D.OPTIONS, S.temp);
      var worstClass = cls.reduce(function (a, b) { return Math.abs(b.gap) > Math.abs(a.gap) ? b : a; });

      grid.innerHTML = [
        ['pooled ECE', pooled.ece.toFixed(3), true],
        ['pooled accuracy', L.pct(pooled.accuracy, 1)],
        ['worst class gap', (worstClass.gap >= 0 ? '+' : '−') + Math.abs(worstClass.gap).toFixed(3)],
        ['worst class', worstClass.name],
        ['cases in mix', String(weighted.length)],
        ['model changed?', 'no']
      ].map(function (c) {
        return '<div class="d-cell"><span class="k">' + c[0] + '</span><span class="v' + (c[2] ? ' acc' : '') + '">' + c[1] + '</span></div>';
      }).join('');

      tail.innerHTML = note(
        'The pooled number here is ' + pooled.ece.toFixed(3) + ', against ' +
        D.evaluate(D.DEMO, D.OPTIONS, S.temp).ece.toFixed(3) + ' over an unweighted sample. ' +
        'Drag the mix and the model stays exactly as it was — same weights, same accuracy on ' +
        'every queue, same per-queue gaps — while the pooled figure moves. ' +
        'A pooled calibration number is an average over the traffic you happened to send it. ' +
        '<b>' + L.esc(worstClass.name) + '</b> carries a gap of ' + (worstClass.gap >= 0 ? '+' : '−') +
        Math.abs(worstClass.gap).toFixed(3) + ' (' + (worstClass.gap >= 0 ? 'over' : 'under') + '-confident) ' +
        'at every mix, and the pooled number can hide it entirely — or exaggerate it, depending on the week.'
      ) + note(
        'This is why "its ECE is 0.03" is not a portable claim. Ask which slice, at what mix, and whether the ' +
        'slice you care about is the one that is calibrated.'
      );
    }

    draw();
    return function () {};
  };
})();
