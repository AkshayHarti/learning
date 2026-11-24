/* Labs 01–06. Each lab builds real DOM inside the host and returns a cleanup fn. */
(function () {
  'use strict';
  var L = window.LABS = window.LABS || {};
  var TOY = window.TOY;

  // ------------------------------------------------------------------ helpers

  function h(html) {
    var t = document.createElement('template');
    t.innerHTML = String(html).trim();
    return t.content.firstElementChild;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmt(x, n) {
    if (n === undefined) n = 2;
    if (!isFinite(x)) return '—';
    var a = Math.abs(x);
    if (a !== 0 && (a < 0.001 || a >= 1e5)) return x.toExponential(1);
    return x.toFixed(n);
  }
  function pct(x, d) { return (x * 100).toFixed(d === undefined ? 1 : d) + '%'; }

  function frame(title, note) {
    var el = h(
      '<div class="c-lab">' +
        '<div class="c-lab-head"><span class="t">' + title + '</span>' +
        '<span class="c-readout">' + (note || '') + '</span></div>' +
        '<div class="c-lab-body"></div>' +
      '</div>'
    );
    el.body = el.querySelector('.c-lab-body');
    return el;
  }

  function slider(host, o) {
    var id = 'sl-' + o.key + '-' + Math.floor(Math.random() * 1e6);
    var val = o.value;
    var wrap = h(
      '<div class="ctl"><label class="lbl" for="' + id + '">' + o.label + '</label>' +
      '<input id="' + id + '" type="range" min="' + o.min + '" max="' + o.max + '" step="' +
      (o.step || 1) + '" value="' + val + '" aria-label="' + esc(o.label) + '">' +
      '<output for="' + id + '">' + o.format(val) + '</output></div>'
    );
    host.appendChild(wrap);
    var inp = wrap.querySelector('input'), out = wrap.querySelector('output');
    var api = {
      el: wrap, input: inp,
      get value() { return Number(inp.value); },
      set: function (v) { inp.value = v; out.textContent = o.format(Number(v)); }
    };
    inp.addEventListener('input', function () {
      out.textContent = o.format(Number(inp.value));
      if (o.onInput) o.onInput(Number(inp.value));
    });
    return api;
  }

  function toggle(host, o) {
    var id = 'tg-' + o.key + '-' + Math.floor(Math.random() * 1e6);
    var wrap = h(
      '<div class="ctl"><label class="lbl" for="' + id + '">' + o.label + '</label>' +
      '<span><input id="' + id + '" type="checkbox"' + (o.value ? ' checked' : '') + '></span>' +
      '<output for="' + id + '">' + (o.value ? 'on' : 'off') + '</output></div>'
    );
    host.appendChild(wrap);
    var inp = wrap.querySelector('input'), out = wrap.querySelector('output');
    var api = { el: wrap, input: inp, get checked() { return inp.checked; } };
    inp.addEventListener('change', function () {
      out.textContent = inp.checked ? 'on' : 'off';
      if (o.onChange) o.onChange(inp.checked);
    });
    return api;
  }

  function readout(pairs) {
    return pairs.map(function (p) {
      return '<span>' + p[0] + ' <b' + (p[2] ? ' class="acc"' : '') + '>' + p[1] + '</b></span>';
    }).join('');
  }

  function chips(list, opts) {
    opts = opts || {};
    var box = h('<div class="c-chips"></div>');
    list.forEach(function (t) {
      var c = h('<span class="c-chip' + (opts.mono === false ? '' : '') + '">' + esc(t) + '</span>');
      box.appendChild(c);
    });
    return box;
  }

  function bars(host, items, opts) {
    opts = opts || {};
    var maxP = 0;
    items.forEach(function (it) { if (it.p > maxP) maxP = it.p; });
    maxP = maxP || 1;
    var html = '<div class="bars">';
    items.forEach(function (it) {
      var w = Math.max(0.5, (it.p / maxP) * 100);
      html += '<div class="bar-row' + (it.dropped ? ' dropped' : '') + '">' +
        '<div class="bar-tok">' + esc(it.label) + '</div>' +
        '<div class="bar-track"><i style="width:' + w + '%"></i>' +
        (it.ghost !== undefined ? '<span class="c-ghost" style="left:' + (it.ghost / maxP * 100) + '%"></span>' : '') +
        '</div>' +
        '<div class="bar-val">' + (it.note !== undefined ? it.note : pct(it.p, 1)) + '</div>' +
        '</div>';
    });
    html += '</div>';
    host.innerHTML = html;
    return host.querySelector('.bars');
  }

  function heatGrid(o) {
    var g = h('<div class="c-heat" style="grid-template-columns:26px repeat(' + o.cols + ',minmax(0,1fr))' +
      (o.maxW ? ';max-width:' + o.maxW + 'px' : '') + '"></div>');
    g.appendChild(h('<div class="c-cl"></div>'));
    for (var j = 0; j < o.cols; j++) {
      g.appendChild(h('<div class="c-cl">' + (o.colLabels ? esc(o.colLabels[j]) : j) + '</div>'));
    }
    for (var i = 0; i < o.rows; i++) {
      g.appendChild(h('<div class="c-rl">' + (o.rowLabels ? esc(o.rowLabels[i]) : i) + '</div>'));
      for (var k = 0; k < o.cols; k++) {
        var v = o.value(i, k);
        var cell = h('<div class="hc">' + (o.cell ? o.cell(i, k, v) : '') + '</div>');
        if (o.masked && o.masked(i, k)) {
          cell.className = 'hc mask';
        } else if (v !== null && v !== undefined) {
          cell.style.background = o.color(v);
        }
        if (o.cellColor) cell.style.color = o.cellColor(v);
        if (o.onCell) {
          (function (ii, jj) {
            cell.addEventListener('click', function () { o.onCell(ii, jj); });
          })(i, k);
        }
        g.appendChild(cell);
      }
    }
    if (o.highlight !== undefined) {
      var cells = g.querySelectorAll('.hc');
      for (var c = 0; c < o.cols; c++) {
        var target = cells[o.highlight * o.cols + c];
        if (target) target.style.outline = '1px solid var(--accent)';
      }
    }
    return g;
  }

  function lineChart(o) {
    var w = o.w || 620, hgt = o.h || 190;
    var pl = o.pl === undefined ? 46 : o.pl, pr = 14, pt = 14, pb = 30;
    var iw = w - pl - pr, ih = hgt - pt - pb;
    var xd = o.xd, yd = o.yd;
    var log = !!o.yLog;

    function X(v) { return pl + (v - xd[0]) / (xd[1] - xd[0] || 1) * iw; }
    function Y(v) {
      if (log) {
        var a = Math.log10(Math.max(yd[0], 1e-12)), b = Math.log10(Math.max(yd[1], 1e-12));
        var f = (Math.log10(Math.max(v, 1e-12)) - a) / ((b - a) || 1);
        return pt + ih - Math.max(0, Math.min(1, f)) * ih;
      }
      var g = (v - yd[0]) / ((yd[1] - yd[0]) || 1);
      return pt + ih - Math.max(0, Math.min(1, g)) * ih;
    }

    var out = '<svg class="c-chart" viewBox="0 0 ' + w + ' ' + hgt + '" role="img" aria-label="' +
      esc(o.label || 'chart') + '">';

    // grid + y ticks. Log axes get evenly spaced ticks in log space, which is
    // the only sane way to read a norm that spans three orders of magnitude.
    var gridN = o.yTicks || 4;
    for (var t = 0; t <= gridN; t++) {
      var frac = t / gridN;
      var y = pt + ih - ih * frac;
      var lab;
      if (log) {
        var l0 = Math.log10(Math.max(yd[0], 1e-12)), l1 = Math.log10(Math.max(yd[1], 1e-12));
        lab = Math.pow(10, l0 + (l1 - l0) * frac);
      } else {
        lab = yd[0] + (yd[1] - yd[0]) * frac;
      }
      out += '<line class="c-gl" x1="' + pl + '" y1="' + y.toFixed(1) + '" x2="' + (pl + iw) + '" y2="' + y.toFixed(1) + '"/>';
      out += '<text class="c-axis" x="' + (pl - 7) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end">' +
        (o.yFmt ? o.yFmt(lab) : fmt(lab, 2)) + '</text>';
    }

    // x ticks
    var xt = o.xTicks || 4;
    for (var s = 0; s <= xt; s++) {
      var xv = xd[0] + (xd[1] - xd[0]) * s / xt;
      out += '<text class="c-axis" x="' + X(xv).toFixed(1) + '" y="' + (pt + ih + 15) + '" text-anchor="middle">' +
        (o.xFmt ? o.xFmt(xv) : fmt(xv, 2)) + '</text>';
    }

    if (o.xLabel) out += '<text class="c-axis" x="' + (pl + iw) + '" y="' + (hgt - 2) + '" text-anchor="end">' + esc(o.xLabel) + '</text>';
    if (o.yLabel) out += '<text class="c-axis" x="' + pl + '" y="' + (pt - 3) + '">' + esc(o.yLabel) + '</text>';

    (o.series || []).forEach(function (se) {
      var pts = se.pts.filter(function (p) { return isFinite(p[1]) && p[0] >= xd[0] && p[0] <= xd[1]; });
      if (!pts.length) return;
      if (se.area) {
        out += '<path class="c-area" d="M' + X(pts[0][0]) + ' ' + (pt + ih) + ' ' +
          pts.map(function (p) { return 'L' + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join(' ') +
          ' L' + X(pts[pts.length - 1][0]) + ' ' + (pt + ih) + ' Z"/>';
      }
      out += '<path class="' + (se.cls || 'c-line') + '" d="' +
        pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1); }).join(' ') + '"/>';
      if (se.dots) {
        pts.forEach(function (p) {
          out += '<circle class="c-dot" cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="2.2"/>';
        });
      }
    });

    if (o.marker !== undefined) {
      out += '<line class="c-mark" x1="' + X(o.marker).toFixed(1) + '" y1="' + pt + '" x2="' + X(o.marker).toFixed(1) + '" y2="' + (pt + ih) + '"/>';
      if (o.markerLabel) {
        out += '<text class="c-axis" x="' + (X(o.marker) + 5).toFixed(1) + '" y="' + (pt + 10) + '" fill="#7dd3a0">' + esc(o.markerLabel) + '</text>';
      }
    }
    out += '</svg>';
    return out;
  }

  function colorAccent(t) {
    var f = Math.pow(Math.max(0, Math.min(1, t)), 0.62);
    var r = Math.round(15 + (125 - 15) * f);
    var g = Math.round(19 + (211 - 19) * f);
    var b = Math.round(24 + (160 - 24) * f);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  L.util = { h: h, esc: esc, fmt: fmt, pct: pct, frame: frame, slider: slider, toggle: toggle,
    readout: readout, chips: chips, bars: bars, heatGrid: heatGrid, lineChart: lineChart,
    colorAccent: colorAccent };

  // ================================================================== 01 predict

  L.predict = function (host) {
    var f = frame('LIVE · a distribution over the next token');
    host.appendChild(f);
    var b = f.body;

    var head = h(
      '<div class="c-flow" style="margin-bottom:14px">' +
      '<span class="st">context</span><span class="ar">→</span><span class="st" id="px-ctx">—</span>' +
      '<span class="ar">→</span><span class="st">p(next token)</span></div>'
    );
    b.appendChild(head);

    var input = h('<input class="input" type="text" id="predict-prompt" name="prompt" aria-label="Prompt" value="the model reads a" style="margin-bottom:12px">');
    b.appendChild(input);

    var presetWrap = h('<div class="c-chips" style="margin-bottom:16px"></div>');
    ['the model reads a', 'the cat sat on the', 'attention is the only place where', 'the loss is the surprise of'].forEach(function (t) {
      var btn = h('<button class="c-chip">' + esc(t) + '</button>');
      btn.addEventListener('click', function () { input.value = t; step(true); });
      presetWrap.appendChild(btn);
    });
    b.appendChild(presetWrap);

    var seq = h('<div class="c-chips" style="margin-bottom:6px"></div>');
    var barHost = h('<div></div>');
    var ro = h('<div class="c-readout" style="margin-top:16px"></div>');
    b.appendChild(seq); b.appendChild(barHost); b.appendChild(ro);

    var ctxWords = [];

    function idsFor(words) {
      var ids = [];
      words.forEach(function (w) {
        var id = TOY.lm.idOf.get(w);
        if (id !== undefined) ids.push(id);
      });
      return ids;
    }

    function step(reset) {
      if (reset) {
        ctxWords = TOY.words(input.value).slice(-10);
        if (!ctxWords.length) ctxWords = ['the'];
      }
      var p = TOY.lm.probs(idsFor(ctxWords));
      seq.innerHTML = ctxWords.map(function (w) {
        return '<span class="c-chip on">' + esc(w) + '</span>';
      }).join('') + '<span class="c-chip mut">?</span>';

      var ranked = [];
      for (var i = 1; i < p.length; i++) ranked.push([i, p[i]]);
      ranked.sort(function (a, b) { return b[1] - a[1]; });
      var top = ranked.slice(0, 9);

      var ent = 0;
      for (var j = 1; j < p.length; j++) if (p[j] > 0) ent -= p[j] * Math.log2(p[j]);
      var above = ranked.filter(function (r) { return r[1] > 0.01; }).length;

      barHost.innerHTML = '';
      var barBox = bars(barHost, top.map(function (r) {
        return { label: TOY.lm.vocab[r[0]], p: r[1] };
      }));
      Array.prototype.forEach.call(barBox.children, function (row, idx) {
        row.style.cursor = 'pointer';
        row.title = 'append “' + TOY.lm.vocab[top[idx][0]] + '”';
        row.addEventListener('click', function () {
          ctxWords.push(TOY.lm.vocab[top[idx][0]]);
          if (ctxWords.length > 12) ctxWords.shift();
          step(false);
        });
      });

      ro.innerHTML = readout([
        ['entropy', ent.toFixed(2) + ' bits'],
        ['options > 1%', above],
        ['vocabulary', TOY.lm.V],
        ['corpus', TOY.lm.ids.length + ' tokens']
      ]);
      head.querySelector('#px-ctx').textContent = ctxWords.slice(-2).join(' ') || '∅';
    }

    input.addEventListener('input', function () { step(true); });
    step(true);

    return function () {};
  };

  // =================================================================== 02 tokens

  L.tokens = function (host) {
    var f = frame('LIVE · byte-pair encoding, trained on the corpus in this page');
    host.appendChild(f);
    var b = f.body;

    var ta = h('<textarea class="input" id="tok-text" name="text" rows="2" aria-label="Text to tokenize">the model predicts the next token, and the tokenizer decides what a token is.</textarea>');
    b.appendChild(ta);

    var out = h('<div class="c-chips" style="margin-top:14px;min-height:34px"></div>');
    b.appendChild(out);

    var ro = h('<div class="c-readout" style="margin-top:14px"></div>');
    b.appendChild(ro);

    var mergeHost = h('<div style="margin-top:18px"></div>');
    b.appendChild(mergeHost);

    var sl = slider(b, {
      key: 'merges', label: 'learned merges', min: 0, max: TOY.bpe.merges.length, step: 1, value: 60,
      format: function (v) { return v + ' / ' + TOY.bpe.merges.length; },
      onInput: render
    });

    function render() {
      var k = sl.value;
      var toks = TOY.bpe.tokenize(ta.value, k);
      out.innerHTML = toks.map(function (t, i) {
        var display = t.replace('</w>', '·');
        return '<span class="c-chip" style="border-color:' +
          (i % 2 ? '#232830' : '#2c333d') + '">' + esc(display) + '</span>';
      }).join('');

      var chars = ta.value.length;
      var words = TOY.words(ta.value).length;
      ro.innerHTML = readout([
        ['characters', chars],
        ['words', words],
        ['tokens', '<b class="acc">' + toks.length + '</b>'],
        ['chars / token', (chars / (toks.length || 1)).toFixed(2)],
        ['vocabulary', TOY.bpe.vocabSize(k)]
      ]);

      var rows = ['<div class="lbl" style="margin-bottom:8px">merge rank order (the order is the algorithm)</div>',
        '<div class="table-wrap" style="max-height:150px"><table><thead><tr><th>rank</th><th>pair</th><th>→</th><th>count</th></tr></thead><tbody>'];
      TOY.bpe.merges.slice(0, Math.max(1, k)).slice(-8).forEach(function (m, i) {
        var rank = Math.max(0, k - 8) + i + 1;
        rows.push('<tr><td class="n">' + rank + '</td><td>' + esc(m[0].replace('</w>', '·')) + ' + ' +
          esc(m[1].replace('</w>', '·')) + '</td><td class="n">' + esc((m[0] + m[1]).replace('</w>', '·')) +
          '</td><td>' + m[2] + '</td></tr>');
      });
      rows.push('</tbody></table></div>');
      mergeHost.innerHTML = rows.join('');
    }

    ta.addEventListener('input', render);
    render();
    return function () {};
  };

  // =============================================================== 03 embeddings

  var EMB = null;
  L.embed = function (host) {
    var f = frame('LIVE · PPMI co-occurrence vectors, projected to two dimensions');
    host.appendChild(f);
    var b = f.body;
    var em = EMB || (EMB = TOY.getEmbeddings());

    var freq = new Float64Array(TOY.lm.V);
    TOY.lm.ids.forEach(function (id) { freq[id] += 1; });

    var base = TOY.lm.idOf.get('cat') || 1;
    var sel = base;

    // The map is the point, so it gets the full column and the neighbours sit under it.
    var wrap = h('<div></div>');
    var scatter = h('<div></div>');
    var side = h('<div style="margin-top:20px"></div>');
    wrap.appendChild(scatter); wrap.appendChild(side);
    b.appendChild(wrap);

    var svgW = 620, svgH = 430, pad = 18;
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    em.coords.forEach(function (p, i) {
      if (i === 0) return;
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    });
    function sx(x) { return pad + (x - minX) / ((maxX - minX) || 1) * (svgW - pad * 2); }
    function sy(y) { return svgH - pad - (y - minY) / ((maxY - minY) || 1) * (svgH - pad * 2); }

    function draw() {
      var out = '<svg class="c-chart" viewBox="0 0 ' + svgW + ' ' + svgH + '" role="img" aria-label="Two dimensional map of word vectors">';
      out += '<line class="c-gl" x1="0" y1="' + (svgH / 2) + '" x2="' + svgW + '" y2="' + (svgH / 2) + '"/>';
      out += '<line class="c-gl" x1="' + (svgW / 2) + '" y1="0" x2="' + (svgW / 2) + '" y2="' + svgH + '"/>';
      em.coords.forEach(function (p, i) {
        if (i === 0) return;
        var on = i === sel;
        out += '<circle cx="' + sx(p[0]).toFixed(1) + '" cy="' + sy(p[1]).toFixed(1) + '" r="' +
          (on ? 4.2 : 2.1) + '" fill="' + (on ? '#7dd3a0' : (freq[i] > 3 ? '#4a525d' : '#2c333d')) + '"/>';
      });
      // label the frequent words so the map is readable
      var labelled = [];
      for (var i = 1; i < TOY.lm.V; i++) if (freq[i] >= 5) labelled.push(i);
      labelled.sort(function (a, c) { return freq[c] - freq[a]; });
      labelled.slice(0, 34).forEach(function (i) {
        var p = em.coords[i];
        out += '<text x="' + (sx(p[0]) + 5).toFixed(1) + '" y="' + (sy(p[1]) + 3.5).toFixed(1) +
          '" font-family="ui-monospace,Menlo,monospace" font-size="10" fill="' +
          (i === sel ? '#7dd3a0' : '#8b929e') + '">' + esc(TOY.lm.vocab[i]) + '</text>';
      });
      if (labelled.indexOf(sel) === -1) {
        out += '<text x="' + (sx(em.coords[sel][0]) + 6).toFixed(1) + '" y="' + (sy(em.coords[sel][1]) + 4).toFixed(1) +
          '" font-family="ui-monospace,Menlo,monospace" font-size="10" fill="#7dd3a0">' + esc(TOY.lm.vocab[sel]) + '</text>';
      }
      out += '<circle cx="' + sx(em.coords[sel][0]).toFixed(1) + '" cy="' + sy(em.coords[sel][1]).toFixed(1) +
        '" r="9" fill="none" stroke="#7dd3a0" stroke-width="1" opacity=".5"/>';
      out += '</svg>';
      scatter.innerHTML = out;
      scatter.querySelector('svg').addEventListener('click', function (e) {
        var box = e.currentTarget.getBoundingClientRect();
        var mx = (e.clientX - box.left) / box.width * svgW;
        var my = (e.clientY - box.top) / box.height * svgH;
        var best = -1, bd = 1e9;
        for (var i = 1; i < TOY.lm.V; i++) {
          var dx = sx(em.coords[i][0]) - mx, dy = sy(em.coords[i][1]) - my;
          var dd = dx * dx + dy * dy;
          if (dd < bd) { bd = dd; best = i; }
        }
        if (best > 0) { sel = best; redraw(); }
      });
    }

    var ro = h('<div class="c-readout" style="margin-top:14px"></div>');

    function sideRender() {
      var nb = em.neighbors(sel, 7);
      var html = '<div class="lbl" style="margin-bottom:6px">nearest neighbours of “' + esc(TOY.lm.vocab[sel]) + '”</div>';
      html += '<div class="bars">';
      nb.forEach(function (pair) {
        var t = Math.max(0, pair[1]);
        html += '<div class="bar-row" style="grid-template-columns:84px 1fr 58px">' +
          '<div class="bar-tok">' + esc(TOY.lm.vocab[pair[0]]) + '</div>' +
          '<div class="bar-track"><i style="width:' + (t * 100).toFixed(1) + '%"></i></div>' +
          '<div class="bar-val">' + pair[1].toFixed(2) + '</div></div>';
      });
      html += '</div>';
      html += '<div class="c-note" style="margin-top:18px">cosine similarity is the dot product of two ' +
        'normalised vectors. ' + esc(TOY.lm.vocab[sel]) + ' · cat = ' +
        em.cosine(sel, TOY.lm.idOf.get('cat') || 1).toFixed(2) + ', ' +
        esc(TOY.lm.vocab[sel]) + ' · dog = ' + em.cosine(sel, TOY.lm.idOf.get('dog') || 2).toFixed(2) + '.</div>';
      side.innerHTML = html;
      ro.innerHTML = readout([['vocabulary', TOY.lm.V], ['dimensions', TOY.lm.V + ' → 2 (PCA)'], ['window', em.window + ' tokens']]);
    }

    function redraw() { draw(); sideRender(); }
    redraw();
    b.appendChild(ro);

    var note = h('<p class="c-note">The geometry is real: vectors are positive pointwise mutual information over a ' +
      '±' + em.window + '-token window, then the two leading singular directions. Click any point.</p>');
    b.appendChild(note);

    return function () {};
  };

  // =============================================================== 04 positions

  L.position = function (host) {
    var f = frame('LIVE · sinusoidal position vectors, dimension 16');
    host.appendChild(f);
    var b = f.body;

    var DIM = 16, POS = 24;
    var state = { pos: 3 };

    var ro = h('<div class="c-readout" style="margin-bottom:12px"></div>');
    b.appendChild(ro);

    var gridHost = h('<div></div>');
    b.appendChild(gridHost);

    var stripHost = h('<div style="margin-top:16px"></div>');
    b.appendChild(stripHost);

    var chartHost = h('<div style="margin-top:22px"></div>');
    b.appendChild(chartHost);

    var sl = slider(b, {
      key: 'pos', label: 'position', min: 0, max: POS - 1, step: 1, value: state.pos,
      format: function (v) { return 'p' + v; },
      onInput: function (v) { state.pos = v; render(); }
    });

    function cos(a, c) {
      var d = 0, na = 0, nb = 0;
      for (var i = 0; i < a.length; i++) { d += a[i] * c[i]; na += a[i] * a[i]; nb += c[i] * c[i]; }
      return d / (Math.sqrt(na * nb) || 1);
    }

    function render() {
      var rows = [];
      var vecs = [];
      for (var p = 0; p < POS; p++) vecs.push(TOY.sinusoid(p, DIM));

      var g = h('<div class="c-heat" style="max-width:none;grid-template-columns:24px repeat(' + POS + ',minmax(0,1fr));gap:1px"></div>');
      g.appendChild(h('<div class="c-cl"></div>'));
      for (var j = 0; j < POS; j++) g.appendChild(h('<div class="c-cl">' + (j % 4 === 0 ? j : '') + '</div>'));
      for (var d = 0; d < DIM; d++) {
        g.appendChild(h('<div class="c-rl">d' + d + '</div>'));
        for (var p2 = 0; p2 < POS; p2++) {
          var v = vecs[p2][d];
          var a = Math.pow(Math.abs(v), 0.75) * 0.9;
          var color = v >= 0 ? 'rgba(125,211,160,' + a.toFixed(2) + ')' : 'rgba(139,146,158,' + a.toFixed(2) + ')';
          var cell = h('<div class="hc"></div>');
          cell.style.background = color;
          if (p2 === state.pos) cell.style.outline = '1px solid #e8e6e1';
          g.appendChild(cell);
        }
      }
      gridHost.innerHTML = '';
      gridHost.appendChild(g);

      var vec = vecs[state.pos];
      var strip = '<div class="lbl" style="margin-bottom:8px">the vector added at position ' + state.pos + '</div><div class="c-chips">';
      for (var i = 0; i < DIM; i++) {
        strip += '<span class="c-chip" style="color:' + (vec[i] >= 0 ? '#7dd3a0' : '#8b929e') + '">' + vec[i].toFixed(2) + '</span>';
      }
      strip += '</div>';
      stripHost.innerHTML = strip;

      var pts = [];
      for (var q = 0; q < POS; q++) pts.push([q, cos(vecs[state.pos], vecs[q])]);
      chartHost.innerHTML = '<div class="lbl" style="margin-bottom:6px">cosine similarity to position ' + state.pos + '</div>' +
        lineChart({
          w: 620, h: 170, xd: [0, POS - 1], yd: [-1, 1], xTicks: 6,
          xLabel: 'position', yLabel: 'cos', marker: state.pos,
          series: [{ pts: pts, dots: false }]
        });

      ro.innerHTML = readout([
        ['position', state.pos],
        ['dimensions', DIM],
        ['cos(p' + state.pos + ', p0)', cos(vecs[state.pos], vecs[0]).toFixed(2)],
        ['cos(p' + state.pos + ', p' + Math.min(POS - 1, state.pos + 1) + ')',
          cos(vecs[state.pos], vecs[Math.min(POS - 1, state.pos + 1)]).toFixed(2)]
      ]);
    }

    render();
    return function () {};
  };

  // =============================================================== 05 attention

  L.attention = function (host) {
    var f = frame('LIVE · edit Q, K and V and watch the head recompute');
    host.appendChild(f);
    var b = f.body;

    var TOKENS = ['the', 'cat', 'sat', 'down'];
    var D = 2;
    var Q = [[0.5, 0.5], [1, 0], [0, 1], [1, 1]];
    var K = [[1, 0], [0, 1], [1, 1], [0, 0]];
    var V = [[1, 0], [0, 1], [1, 1], [0.5, 0.5]];

    var base = JSON.stringify({ Q: Q, K: K, V: V });
    var state = { temp: 1, mask: true, scale: true, row: 1 };

    var wrap = h('<div class="c-row" style="grid-template-columns:0.95fr 1.15fr;gap:30px"></div>');
    var left = h('<div></div>'), right = h('<div></div>');
    wrap.appendChild(left); wrap.appendChild(right);
    b.appendChild(wrap);

    var mats = { Q: Q, K: K, V: V };
    var labels = { Q: 'query — what this token is looking for', K: 'key — what this token offers', V: 'value — what it passes on' };

    ['Q', 'K', 'V'].forEach(function (name) {
      var box = h('<div><div class="lbl" style="margin:14px 0 2px">' + labels[name] + '</div></div>');
      var g = h('<div class="c-grid-input" style="grid-template-columns:42px repeat(' + D + ',58px);align-items:center"></div>');
      for (var i = 0; i < TOKENS.length; i++) {
        g.appendChild(h('<div style="font:10px var(--mono);color:var(--mut);text-align:right;padding-right:2px">' + TOKENS[i] + '</div>'));
        for (var j = 0; j < D; j++) {
          var inp = h('<input class="c-cell" type="number" step="0.5" min="-4" max="4" value="' + mats[name][i][j] +
            '" id="att-' + name + '-' + i + '-' + j + '" name="att-' + name + '-' + i + '-' + j +
            '" aria-label="' + name + ' token ' + TOKENS[i] + ' dimension ' + j + '">');
          inp.dataset.m = name; inp.dataset.i = i; inp.dataset.j = j;
          g.appendChild(inp);
        }
      }
      box.appendChild(g);
      left.appendChild(box);
    });

    var presets = h('<div class="c-chips" style="margin-top:16px"></div>');
    [
      ['reset', 'reset'],
      ['focus “the”', 'focus'],
      ['attend to self', 'self'],
      ['attend to content', 'content'],
      ['uniform', 'uniform']
    ].forEach(function (p) {
      var btn = h('<button class="c-chip">' + p[0] + '</button>');
      btn.addEventListener('click', function () { applyPreset(p[1]); });
      presets.appendChild(btn);
    });
    left.appendChild(presets);

    slider(left, {
      key: 'att-temp', label: 'softmax temperature', min: 0.2, max: 3, step: 0.05, value: 1,
      format: function (v) { return v.toFixed(2); },
      onInput: function (v) { state.temp = v; render(); }
    });
    toggle(left, {
      key: 'att-mask', label: 'causal mask', value: true, onChange: function (v) { state.mask = v; render(); }
    });
    toggle(left, {
      key: 'att-scale', label: 'divide by √d', value: true, onChange: function (v) { state.scale = v; render(); }
    });

    var scoreHost = h('<div><div class="lbl" style="margin:0 0 4px">scores · QKᵀ</div></div>');
    var weightHost = h('<div style="margin-top:16px"><div class="lbl" style="margin:0 0 4px">weights · softmax(scores / T)</div></div>');
    var outHost = h('<div style="margin-top:16px"><div class="lbl" style="margin:0 0 4px">output · weights × V</div></div>');
    right.appendChild(scoreHost); right.appendChild(weightHost); right.appendChild(outHost);

    var ro = h('<div class="c-readout" style="margin-top:18px"></div>');
    b.appendChild(ro);

    var formula = h('<div class="c-flow" style="margin-top:14px">' +
      '<span class="st">QKᵀ</span><span class="ar">→</span>' +
      '<span class="st">÷√d</span><span class="ar">→</span>' +
      '<span class="st">mask</span><span class="ar">→</span>' +
      '<span class="st">softmax</span><span class="ar">→</span>' +
      '<span class="st">× V</span><span class="ar">→</span>' +
      '<span class="st"><b>out</b></span></div>');
    b.appendChild(formula);

    function applyPreset(kind) {
      if (kind === 'reset') {
        var s = JSON.parse(base);
        Q = s.Q.map(function (r) { return r.slice(); });
        K = s.K.map(function (r) { return r.slice(); });
        V = s.V.map(function (r) { return r.slice(); });
      } else if (kind === 'focus') {
        K = [[2, 0], [0, 0], [0, 0], [0, 0]];
        Q = [[1, 0], [1, 0], [1, 0], [1, 0]];
      } else if (kind === 'self') {
        K = [[1, 0], [0, 1], [1, 1], [1, 1]];
        Q = [[1, 0], [0, 1], [1, 1], [1, 1]];
      } else if (kind === 'content') {
        Q = [[0, 1], [0, 1], [0, 1], [0, 1]];
        K = [[0, 0], [1, 0], [1, 0], [0, 1]];
      } else {
        Q = [[1, 0], [1, 0], [1, 0], [1, 0]];
        K = [[0, 1], [0, 1], [0, 1], [0, 1]];
      }
      // The preset replaces the arrays, so the input map has to follow them.
      mats.Q = Q; mats.K = K; mats.V = V;
      left.querySelectorAll('.c-cell').forEach(function (inp) {
        inp.value = mats[inp.dataset.m][Number(inp.dataset.i)][Number(inp.dataset.j)];
      });
      render();
    }

    function softmaxRow(logits) {
      var mx = -Infinity;
      logits.forEach(function (l) { if (l !== null && l > mx) mx = l; });
      var ex = logits.map(function (l) { return l === null ? 0 : Math.exp((l - mx) / state.temp); });
      var s = ex.reduce(function (a, c) { return a + c; }, 0) || 1;
      return ex.map(function (e) { return e / s; });
    }

    function compute() {
      var scores = [], weights = [];
      for (var i = 0; i < 4; i++) {
        var row = [], logits = [];
        for (var j = 0; j < 4; j++) {
          if (state.mask && j > i) { row.push(null); logits.push(null); continue; }
          var dot = 0;
          for (var d = 0; d < D; d++) dot += Q[i][d] * K[j][d];
          var sc = state.scale ? dot / Math.sqrt(D) : dot;
          row.push(sc); logits.push(sc);
        }
        scores.push(row);
        weights.push(softmaxRow(logits));
      }
      var out = [];
      for (var i2 = 0; i2 < 4; i2++) {
        var o = [0, 0];
        for (var j2 = 0; j2 < 4; j2++) {
          for (var d2 = 0; d2 < D; d2++) o[d2] += weights[i2][j2] * V[j2][d2];
        }
        out.push(o);
      }
      return { scores: scores, weights: weights, out: out };
    }

    function render() {
      var r = compute();
      var maxAbs = 0.001;
      r.scores.forEach(function (row) { row.forEach(function (v) { if (v !== null) maxAbs = Math.max(maxAbs, Math.abs(v)); }); });

      scoreHost.innerHTML = '';
      scoreHost.appendChild(h('<div class="lbl" style="margin:0 0 4px">scores · QKᵀ' + (state.scale ? ' / √d' : '') + '</div>'));
      scoreHost.appendChild(heatGrid({
        rows: 4, cols: 4, rowLabels: TOKENS, colLabels: TOKENS,
        value: function (i, j) { return r.scores[i][j]; },
        masked: function (i, j) { return r.scores[i][j] === null; },
        cell: function (i, j, v) { return v === null ? '' : v.toFixed(2); },
        color: function (v) {
          var t = Math.abs(v) / maxAbs;
          return v >= 0 ? 'rgba(125,211,160,' + (0.12 + 0.7 * t).toFixed(2) + ')'
            : 'rgba(139,146,158,' + (0.12 + 0.5 * t).toFixed(2) + ')';
        },
        cellColor: function (v) { return v !== null && Math.abs(v) / maxAbs > 0.55 ? '#0b0d10' : '#8b929e'; },
        onCell: function (i) { state.row = i; render(); }
      }));

      weightHost.innerHTML = '';
      weightHost.appendChild(h('<div class="lbl" style="margin:0 0 4px">weights · each row sums to 1</div>'));
      weightHost.appendChild(heatGrid({
        rows: 4, cols: 4, rowLabels: TOKENS, colLabels: TOKENS,
        value: function (i, j) { return r.weights[i][j]; },
        cell: function (i, j, v) { return v < 0.005 ? '·' : v.toFixed(2).replace(/^0/, ''); },
        color: colorAccent,
        cellColor: function (v) { return v > 0.55 ? '#08110c' : '#8b929e'; },
        highlight: state.row,
        onCell: function (i) { state.row = i; render(); }
      }));

      outHost.innerHTML = '';
      outHost.appendChild(h('<div class="lbl" style="margin:0 0 4px">output · one 2-D vector per token</div>'));
      outHost.appendChild(heatGrid({
        rows: 4, cols: 2, maxW: 150, rowLabels: TOKENS, colLabels: ['d0', 'd1'],
        value: function (i, j) { return r.out[i][j]; },
        cell: function (i, j, v) { return v.toFixed(2); },
        color: function (v) {
          var t = Math.min(1, Math.abs(v) / 2);
          return v >= 0 ? 'rgba(125,211,160,' + (0.1 + 0.6 * t).toFixed(2) + ')'
            : 'rgba(139,146,158,' + (0.1 + 0.45 * t).toFixed(2) + ')';
        },
        cellColor: function (v) { return Math.abs(v) / 2 > 0.55 ? '#0b0d10' : '#8b929e'; }
      }));

      var row = r.weights[state.row];
      var best = 0;
      for (var j = 0; j < 4; j++) if (row[j] > row[best]) best = j;
      var ent = 0;
      row.forEach(function (p) { if (p > 0) ent -= p * Math.log2(p); });
      ro.innerHTML = readout([
        ['query', TOKENS[state.row]],
        ['reads most from', TOKENS[best] + ' (' + pct(row[best], 0) + ')'],
        ['row entropy', ent.toFixed(2) + ' bits'],
        ['masked keys', state.mask ? (3 - state.row) + ' of 4' : '0'],
        ['values mixed', row.filter(function (p) { return p > 0.01; }).length]
      ]);
    }

    b.addEventListener('input', function (e) {
      var t = e.target;
      if (!t.classList.contains('c-cell')) return;
      mats[t.dataset.m][Number(t.dataset.i)][Number(t.dataset.j)] = Number(t.value);
      render();
    });

    render();
    return function () {};
  };

  // ================================================================== 06 block

  L.block = function (host) {
    var f = frame('LIVE · the residual stream over depth, with and without LayerNorm');
    host.appendChild(f);
    var b = f.body;

    var state = { layers: 12, residual: true, ln: true };

    var chartHost = h('<div></div>');
    b.appendChild(chartHost);

    var ro = h('<div class="c-readout" style="margin-top:6px"></div>');
    b.appendChild(ro);

    var statusHost = h('<div class="c-note" style="margin-top:10px"></div>');
    b.appendChild(statusHost);

    var ctl = h('<div style="margin-top:10px"></div>');
    b.appendChild(ctl);

    slider(ctl, {
      key: 'layers', label: 'layers', min: 1, max: 24, step: 1, value: 12,
      format: function (v) { return v + ' blocks'; },
      onInput: function (v) { state.layers = v; render(); }
    });
    toggle(ctl, { key: 'res', label: 'residual connection', value: true, onChange: function (v) { state.residual = v; render(); } });
    toggle(ctl, { key: 'ln', label: 'layer norm', value: true, onChange: function (v) { state.ln = v; render(); } });

    function render() {
      var r = TOY.blockRun(state);
      var pts = r.norms.map(function (n, i) { return [i, n]; });
      var maxN = Math.max.apply(null, r.norms);

      chartHost.innerHTML = '<div class="lbl" style="margin-bottom:6px">‖ residual stream ‖ at each depth (log scale)</div>' +
        lineChart({
          w: 620, h: 200, xd: [0, state.layers], yd: [0.01, Math.max(100, maxN * 1.4)],
          yLog: true, xTicks: Math.min(6, state.layers), xLabel: 'block',
          yLabel: '‖x‖', xFmt: function (v) { return Math.round(v); },
          yFmt: function (v) { return v >= 1 ? v.toFixed(0) : v.toFixed(2); },
          series: [{ pts: pts, dots: state.layers <= 12, area: true }]
        });

      var verdict, tone;
      if (!state.ln && state.residual && r.finalNorm > 20) {
        verdict = 'The norm is running away. Without LayerNorm every block multiplies the stream, the logits grow with it, and the softmax becomes a step function: one token gets probability 1 and the gradient through it is zero. This is why nobody ships a transformer without normalisation.';
        tone = 'grow';
      } else if (!state.residual) {
        verdict = 'With no residual, each block overwrites the stream instead of editing it. Depth stops being refinement and starts being a telephone game — whatever block 0 computed is gone by block 3. The residual connection is the single cheapest thing that makes depth trainable.';
        tone = 'collapse';
      } else if (!state.ln) {
        verdict = 'Residuals accumulate, so the stream grows with depth. Watch the logit span: at some point the softmax saturates and learning stops.';
        tone = 'grow';
      } else {
        verdict = 'Stable. LayerNorm rescales the stream after every block, so 24 blocks behave like 24 blocks and not like a bomb. The stream keeps a roughly constant norm while its direction carries the work.';
        tone = 'ok';
      }

      ro.innerHTML = readout([
        ['final norm', r.finalNorm.toFixed(2)],
        ['logit span', r.logitRange.toFixed(1)],
        ['max softmax', r.sharpness.toFixed(3)],
        ['state', tone]
      ]);
      statusHost.textContent = verdict;
      statusHost.style.borderLeftColor = tone === 'ok' ? '#2c333d' : '#7dd3a0';
    }

    render();
    return function () {};
  };
})();
