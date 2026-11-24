/* Decision-model engine.
 *
 * A real, small, per-option scorer — the documented readout geometry of open
 * decision models (Laya, Open-Jev): score every declared option against the
 * state, softmax over the options. Because the option NAME is part of the
 * scored text, renaming an option changes the answer with its definition held
 * fixed. That is the failure mode the course teaches, reproduced rather than
 * asserted.
 *
 * Everything here is deterministic. Same inputs, same numbers, every load.
 */
(function () {
  'use strict';

  var DIMS = 8192;

  // ---------------------------------------------------------------- utilities

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fnv(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0) % DIMS;
  }

  function stem(w) {
    if (w.length > 4 && /ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (w.length > 5 && /ing$/.test(w)) w = w.slice(0, -3);
    else if (w.length > 4 && /ed$/.test(w)) w = w.slice(0, -2);
    else if (w.length > 5 && /es$/.test(w)) w = w.slice(0, -2);
    else if (w.length > 3 && /s$/.test(w) && !/ss$/.test(w)) w = w.slice(0, -1);
    if (w.length > 3 && /e$/.test(w)) w = w.slice(0, -1);
    return w;
  }

  function tokens(s) {
    return String(s)
      .toLowerCase()
      .replace(/[^a-z0-9%$.@]+/g, ' ')
      .split(' ')
      .filter(function (t) { return t && t.length > 1; })
      .map(stem);
  }

  function softmax(x, T) {
    var m = -Infinity, i;
    for (i = 0; i < x.length; i++) if (x[i] > m) m = x[i];
    var e = new Array(x.length), s = 0;
    for (i = 0; i < x.length; i++) { e[i] = Math.exp((x[i] - m) / T); s += e[i]; }
    for (i = 0; i < x.length; i++) e[i] /= s;
    return e;
  }

  // ------------------------------------------------------------ feature space

  function stateIndex(state) {
    var toks = tokens(state);
    var uni = Object.create(null), bi = Object.create(null), i;
    for (i = 0; i < toks.length; i++) {
      uni[toks[i]] = (uni[toks[i]] || 0) + 1;
      if (i + 1 < toks.length) {
        var b = toks[i] + ' ' + toks[i + 1];
        bi[b] = (bi[b] || 0) + 1;
      }
    }
    return { toks: toks, uni: uni, bi: bi };
  }

  // Features that can actually discriminate between options. State-only
  // unigrams are constant across options for a given state, so they cancel in
  // the softmax and carry no gradient — emitting them would be pure cost.
  function featurize(sidx, optText, salt) {
    var toks = tokens(optText);
    var oUni = Object.create(null), oBi = Object.create(null), i;
    for (i = 0; i < toks.length; i++) {
      oUni[toks[i]] = (oUni[toks[i]] || 0) + 1;
      if (i + 1 < toks.length) {
        var b = toks[i] + ' ' + toks[i + 1];
        oBi[b] = (oBi[b] || 0) + 1;
      }
    }
    var idx = [], val = [], pre = salt || '';
    function add(name, v) { idx.push(fnv(pre + name)); val.push(v); }

    for (var t in oUni) {
      var c = oUni[t];
      add('o:' + t, 0.6 * (1 + Math.log(c)));
      if (sidx.uni[t]) {
        var k = Math.min(c, sidx.uni[t]);
        add('x:' + t, 1 + Math.log(k));
      }
    }
    for (var g in oBi) {
      if (sidx.bi[g]) add('xb:' + g, 1.5);
    }
    add('bias', 1);
    add('len', Math.log(1 + toks.length) * 0.3);
    return { idx: idx, val: val };
  }

  // ------------------------------------------------------------------- model

  function Model() {
    this.w = new Float64Array(DIMS);
    this.T = 1;
    this.salt = '';
  }

  Model.prototype.score = function (sidx, optText) {
    var f = featurize(sidx, optText, this.salt), s = 0;
    for (var i = 0; i < f.idx.length; i++) s += this.w[f.idx[i]] * f.val[i];
    return s;
  };

  Model.prototype.scores = function (state, options) {
    var sidx = stateIndex(state);
    var out = [];
    for (var i = 0; i < options.length; i++) {
      var o = options[i];
      out.push(this.score(sidx, o.name + ' ' + o.definition));
    }
    return out;
  };

  Model.prototype.predict = function (state, options, T) {
    T = T === undefined ? this.T : T;
    var sc = this.scores(state, options);
    var p = softmax(sc, T);
    return readChoice(p, options);
  };

  // --------------------------------------------------------- read the answer

  function entropy(p) {
    var h = 0;
    for (var i = 0; i < p.length; i++) if (p[i] > 0) h -= p[i] * Math.log(p[i]);
    return h;
  }

  function readChoice(p, options) {
    var n = p.length, best = 0, i;
    for (i = 1; i < n; i++) if (p[i] > p[best]) best = i;
    var sorted = p.slice().sort(function (a, b) { return b - a; });
    var pmax = sorted[0];
    var conf = n > 1 ? Math.max(0, (pmax - 1 / n) / (1 - 1 / n)) : 1;
    return {
      probabilities: p,
      option: options ? options[best] : null,
      index: best,
      choice: options ? options[best].name : best,
      pmax: pmax,
      margin: sorted[0] - (sorted[1] || 0),
      entropy: entropy(p),
      // vendor formula, reproduced: (p_max - 1/n) / (1 - 1/n)
      confidence: conf,
      // the honest alternative: normalised entropy, 1 = one option, 0 = flat
      normEntropy: 1 - entropy(p) / Math.log(n)
    };
  }

  // Ordered rubric. `score` is the probability-weighted mean of the level
  // indexes, exactly as the vendor documents it — so it can land between
  // levels, which is a feature until someone reads it as a label.
  function readScore(p) {
    var n = p.length, mean = 0, i, mode = 0;
    for (i = 0; i < n; i++) {
      mean += i * p[i];
      if (p[i] > p[mode]) mode = i;
    }
    var mad = 0;
    for (i = 0; i < n; i++) mad += p[i] * Math.abs(i - mode);
    var madUnif = 0;
    for (i = 0; i < n; i++) madUnif += Math.abs(i - mode) / n;
    var c = readChoice(p);
    return {
      probabilities: p,
      score: mean,
      mode: mode,
      confidence: Math.max(0, 1 - mad / madUnif),
      pmax: c.pmax,
      entropy: c.entropy
    };
  }

  // --------------------------------------------------------------- training

  function train(examples, options, opts, key) {
    opts = opts || {};
    key = key || 'label';
    var salt = opts.salt || '';
    var epochs = opts.epochs || 220;
    var lr = opts.lr || 0.08;
    var l2 = opts.l2 === undefined ? 2e-6 : opts.l2;
    var w = new Float64Array(DIMS);
    var m = new Float64Array(DIMS), v = new Float64Array(DIMS);
    var b1 = 0.9, b2 = 0.999, eps = 1e-8;
    var rnd = mulberry32(opts.seed || 7);

    // Precompute features per (example, option).
    var cache = examples.map(function (ex) {
      var sidx = stateIndex(ex.text);
      return {
        y: ex[key],
        f: options.map(function (o) { return featurize(sidx, o.name + ' ' + o.definition, salt); })
      };
    });

    var n = cache.length, K = options.length;
    var t = 0;
    for (var ep = 0; ep < epochs; ep++) {
      // shuffle (deterministic)
      var order = [];
      for (var i = 0; i < n; i++) order.push(i);
      for (i = n - 1; i > 0; i--) {
        var j = Math.floor(rnd() * (i + 1));
        var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
      }

      var g = new Float64Array(DIMS);
      for (var oi = 0; oi < order.length; oi++) {
        var ex = cache[order[oi]];
        var sc = new Array(K);
        for (var k = 0; k < K; k++) {
          var s = 0, fk = ex.f[k];
          for (var q = 0; q < fk.idx.length; q++) s += w[fk.idx[q]] * fk.val[q];
          sc[k] = s;
        }
        var p = softmax(sc, 1);
        for (k = 0; k < K; k++) {
          var d = p[k] - (ex.y === k ? 1 : 0);
          if (d === 0) continue;
          var f = ex.f[k];
          for (q = 0; q < f.idx.length; q++) g[f.idx[q]] += d * f.val[q];
        }
      }

      t++;
      var seen = Object.create(null);
      for (i = 0; i < DIMS; i++) {
        if (g[i] === 0) continue;
        m[i] = b1 * m[i] + (1 - b1) * g[i];
        v[i] = b2 * v[i] + (1 - b2) * g[i] * g[i];
        var mh = m[i] / (1 - Math.pow(b1, t));
        var vh = v[i] / (1 - Math.pow(b2, t));
        w[i] -= lr * (mh / (Math.sqrt(vh) + eps) + l2 * w[i]);
      }
    }
    var mod = new Model();
    mod.w = w;
    mod.T = 1;
    mod.salt = salt;
    return mod;
  }

  // Temperature scaling: the one post-hoc calibration step everybody skips.
  // Fit on a held-out split by minimising negative log-likelihood.
  function fitTemperature(model, examples, options, key) {
    key = key || 'label';
    var best = 1, bestL = Infinity;
    for (var T = 0.30; T <= 3.501; T += 0.01) {
      var L = 0;
      for (var i = 0; i < examples.length; i++) {
        var p = model.predict(examples[i].text, options, T).probabilities;
        L -= Math.log(Math.max(1e-12, p[examples[i][key]]));
      }
      if (L < bestL) { bestL = L; best = T; }
    }
    return best;
  }

  // ------------------------------------------------------------------ metrics

  function evaluate(model, examples, options, T, key) {
    T = T === undefined ? model.T : T;
    key = key || 'label';
    var n = examples.length, K = options.length;
    var correct = 0, nll = 0, brier = 0, conf = [], hit = [], confusion = [];
    var i, j;
    for (i = 0; i < K; i++) {
      confusion.push([]);
      for (j = 0; j < K; j++) confusion[i].push(0);
    }
    for (i = 0; i < n; i++) {
      var r = model.predict(examples[i].text, options, T);
      var y = examples[i][key];
      if (r.index === y) correct++;
      nll -= Math.log(Math.max(1e-12, r.probabilities[y]));
      var b = 0;
      for (j = 0; j < K; j++) b += Math.pow(r.probabilities[j] - (j === y ? 1 : 0), 2);
      brier += b;
      conf.push(r.pmax);
      hit.push(r.index === y ? 1 : 0);
      confusion[y][r.index]++;
    }
    return {
      n: n,
      accuracy: correct / n,
      nll: nll / n,
      brier: brier / n,
      ece: ece(conf, hit, 10),
      reliability: reliability(conf, hit, 10),
      confusion: confusion
    };
  }

  function reliability(conf, hit, bins) {
    var out = [];
    for (var b = 0; b < bins; b++) out.push({ lo: b / bins, hi: (b + 1) / bins, n: 0, conf: 0, acc: 0 });
    for (var i = 0; i < conf.length; i++) {
      var k = Math.min(bins - 1, Math.floor(conf[i] * bins));
      out[k].n++;
      out[k].conf += conf[i];
      out[k].acc += hit[i];
    }
    out.forEach(function (r) {
      if (r.n) { r.conf /= r.n; r.acc /= r.n; }
    });
    return out.filter(function (r) { return r.n > 0; });
  }

  function ece(conf, hit, bins) {
    var rs = reliability(conf, hit, bins), e = 0;
    for (var i = 0; i < rs.length; i++) e += (rs[i].n / conf.length) * Math.abs(rs[i].acc - rs[i].conf);
    return e;
  }

  // ------------------------------------------------------------------- corpus

  // Five routes. The definitions deliberately share stems with the tickets —
  // that is what a real option set looks like, and it keeps the model honest.
  var OPTIONS = [
    { name: 'billing', definition: 'Charges, invoices, duplicate payments, refunds, or the subscription price.' },
    { name: 'technical', definition: 'Errors, crashes, failing integrations, API errors, or timeouts.' },
    { name: 'account', definition: 'Sign-in, password reset, two-factor codes, locked or inaccessible account.' },
    { name: 'shipping', definition: 'Delivery, tracking, parcels, address changes, or a lost package.' },
    { name: 'cancellation', definition: 'Cancel a subscription, close the account, or stop future billing.' }
  ];

  // A score scale whose levels describe what to look for. Contrast with a bare
  // ["Low","Medium","High"] — which, for a model that reads words, is empty.
  var SEVERITY = [
    'Cosmetic — nothing is broken and no customer is affected.',
    'Minor — one customer is affected and a workaround exists.',
    'Major — many customers are blocked and the service is degraded.',
    'Critical — all customers are down and the service is completely unavailable.'
  ];

  var REFUND_TRUE = 'It commits to returning money: the reply says a refund is done or will happen.';
  var REFUND_FALSE = 'It makes no promise about money: the reply only explains, apologises, or asks for information.';

  // Base tickets. Eight per route. `sev` is the severity level, `rf` marks the
  // ones that ask for money back. Both are hand-assigned per template.
  var BASE = {
    billing: {
      sev: [1, 1, 2, 1, 2, 1, 1, 1],
      rf: [1, 0, 1, 1, 1, 0, 1, 0],
      t: [
        'I was charged twice for the same order and I need one of the charges refunded.',
        'The invoice for {month} shows an amount I do not recognise.',
        'My card was billed {amount} but the order total was different.',
        'I requested a refund {day} days ago and it has not arrived.',
        'There is a duplicate payment of {amount} on my account.',
        'The subscription price went up without any notice.',
        'I was charged for a plan I cancelled last month.',
        'The invoice is addressed to the wrong company and the amount is wrong.'
      ]
    },
    technical: {
      sev: [3, 3, 3, 2, 3, 3, 3, 3],
      rf: [0, 0, 0, 0, 0, 0, 0, 0],
      t: [
        'The app crashes every time I open the {feature} screen.',
        'The API returns a 500 error on every call since this morning.',
        'The integration keeps timing out when it syncs orders.',
        'I get an error when I upload a file larger than {n} MB.',
        'The webhook fails silently and no events arrive.',
        'The checkout page throws an exception at the payment step.',
        'Sync stops after a few minutes and the logs show a timeout.',
        'The desktop client crashes on launch after the update.'
      ]
    },
    account: {
      sev: [2, 3, 2, 2, 2, 3, 2, 2],
      rf: [0, 0, 0, 0, 0, 0, 0, 0],
      t: [
        'I cannot sign in after resetting my password.',
        'The two-factor code never arrives so I am locked out of my account.',
        'My account is locked and the reset email is not arriving.',
        'I changed my email and now I cannot sign in.',
        'The password reset link says it has expired every time.',
        'I am locked out because the authenticator app was on my old phone.',
        'Sign-in fails with invalid credentials even with the right password.',
        'I need access to an account whose email I no longer use.'
      ]
    },
    shipping: {
      sev: [1, 2, 1, 2, 1, 2, 1, 1],
      rf: [0, 0, 0, 0, 0, 0, 0, 0],
      t: [
        'My parcel has not arrived and tracking has not moved in {day} days.',
        'The tracking page says delivered but nothing was left at my address.',
        'I need to change the delivery address before the parcel ships.',
        'The package arrived damaged and the box was open.',
        'Tracking shows the parcel is stuck at the depot.',
        'The courier left the parcel at the wrong address.',
        'I want the delivery redirected to a pickup point.',
        'The order shipped to my old address after I updated it.'
      ]
    },
    cancellation: {
      sev: [0, 1, 0, 0, 0, 1, 0, 0],
      rf: [0, 0, 0, 0, 0, 1, 0, 0],
      t: [
        'I want to cancel my subscription at the end of this billing period.',
        'Please close my account and stop charging me.',
        'I need to cancel the plan before the next invoice.',
        'Stop the subscription renewal, I no longer use the product.',
        'I want to close the account and delete my data.',
        'Cancel my plan and refund the last invoice.',
        'I am cancelling because the price is too high.',
        'Please end my subscription today, I do not want another charge.'
      ]
    }
  };

  var SLOTS = {
    month: ['January', 'March', 'June', 'September', 'November'],
    amount: ['$19', '$48', '$120', '$240', '$1,300'],
    day: ['3', '5', '9', '12', '21'],
    feature: ['reports', 'settings', 'billing', 'dashboard', 'exports'],
    n: ['5', '10', '25', '50', '100']
  };

  var LABELS = ['billing', 'technical', 'account', 'shipping', 'cancellation'];

  function fill(tpl, v) {
    return tpl.replace(/\{(\w+)\}/g, function (m, key) {
      var arr = SLOTS[key];
      return arr ? arr[v % arr.length] : m;
    });
  }

  function build(variant) {
    var out = [];
    LABELS.forEach(function (lab, li) {
      var def = BASE[lab];
      def.t.forEach(function (tpl, ti) {
        out.push({
          text: fill(tpl, variant === 0 ? 0 : variant + ti),
          label: li,
          severity: def.sev[ti],
          refund: def.rf[ti]
        });
      });
    });
    return out;
  }

  // The fixed demo set: exactly the 40 base tickets, never trained on. Every
  // lesson that reports "over 40 examples" uses this set, so the numbers are
  // comparable across steps — and no lesson reports train-set accuracy.
  var DEMO = build(0);

  // Training corpus: six deterministic variants of each ticket. The base form
  // is held out entirely, which is why the model is good and not perfect.
  var REST = [];
  for (var vv = 1; vv <= 6; vv++) REST = REST.concat(build(vv));

  // Deterministic split: every 5th variant is held out for temperature fitting.
  var TRAIN = [], HOLD = [];
  REST.forEach(function (ex, i) {
    if (i % 5 === 0) HOLD.push(ex); else TRAIN.push(ex);
  });

  // Answers, for the "what a generator must emit instead" comparison.
  var ANSWERS = [
    'This ticket should be routed to the billing team.',
    'This ticket should be routed to the technical team.',
    'This ticket should be routed to the account team.',
    'This ticket should be routed to the shipping team.',
    'This ticket should be routed to the cancellation team.'
  ];

  // --------------------------------------------------------- three task heads

  // A real decision model is trained across many question types, not one. The
  // page runs three small heads for that reason: a routing model asked "how
  // angry is this customer?" has no idea, and pretending otherwise would teach
  // the wrong thing. Same trainer, different data — that is the whole point.
  var RF_OPTIONS = [
    { name: 'false', definition: REFUND_FALSE },
    { name: 'true', definition: REFUND_TRUE }
  ];

  // Intensity levels that name what to look for. Compare with ["Calm","Mild",
  // "Frustrated","Furious"], which tells a word-reading model almost nothing.
  var TONE_LEVELS = [
    'Calm — a question, a small request, or an update. No frustration and no urgency.',
    'Mild — a follow-up, a late order, or mild disappointment. Still polite.',
    'Frustrated — repeated contact, wasted time, an unacceptable delay, or a problem nobody fixed.',
    'Furious — anger, a demand to escalate, a threat to cancel or dispute the charge.'
  ];

  var TONE_BASE = [
    ['Just checking whether there is an update on my order. No rush.',
     'I have a quick question about the invoice, whenever you get a chance.',
     'Could you confirm the delivery window? It is not urgent.',
     'Hello, I would like to update my address for next month.',
     'Wondering if the plan includes exports. Thanks in advance.',
     'Small request: please change the billing contact.',
     'No urgency at all, but could you confirm the renewal date?',
     'I am just curious whether there is a student discount.'],
    ['I still have not received a reply to my last message.',
     'This is the second time I have asked about the same invoice.',
     'The order is a few days late and I would like an update.',
     'I am a little disappointed that the delivery date changed.',
     'Could someone look at this? It has been open for a week.',
     'I would appreciate a reply today if possible.',
     'The parcel is running late again and I would like to know why.',
     'Not a big problem, but the invoice amount looks a little off.'],
    ['I have contacted support three times and nobody has fixed this.',
     'This is unacceptable. The parcel is two weeks late and tracking is dead.',
     'I am frustrated that I was charged again after cancelling.',
     'Why does this keep happening? I have explained the problem twice.',
     'I need this resolved today, I have wasted hours on it.',
     'Your last reply did not answer my question at all.',
     'I have wasted an entire afternoon on a problem you created.',
     'This is the third unacceptable delay and nobody has replied.'],
    ['This is the fourth time I am writing and I am absolutely furious.',
     'I am done. Cancel everything immediately and refund me now.',
     'Completely unacceptable. I will be disputing the charge with my bank.',
     'I have never dealt with a worse service. Escalate this to a manager now.',
     'You have taken my money twice and ignored every message. Fix this today.',
     'I am cancelling and telling everyone I know to avoid you.',
     'I am furious. Escalate this immediately or I am disputing the charge.',
     'Absolutely unacceptable. Cancel my account and refund me now.']
  ];

  var TONE = [];
  TONE_BASE.forEach(function (bucket, lvl) {
    bucket.forEach(function (t) { TONE.push({ text: t, level: lvl }); });
  });
  var TONE_TRAIN = [], TONE_HOLD = [];
  TONE.forEach(function (ex, i) { if (i % 5 === 0) TONE_HOLD.push(ex); else TONE_TRAIN.push(ex); });

  // A purpose-built noul task: support replies, half of which promise money
  // back. This is the example every vendor documentation page uses, because
  // "did this reply commit us to a refund?" is the canonical gate.
  // 44 support replies, 22 of which commit the company to returning money. The
  // word "refund" appears on both sides ("I have refunded" vs "I am unable to
  // issue a refund"), so this is not a keyword lookup — which is the point of
  // using it for the threshold and cost lab.
  var REFUND_CASES = [
    ['I have refunded the full amount to your card, it should appear in three days.', 1],
    ['Your refund has been processed and you will see the money back within five business days.', 1],
    ['We are returning the duplicate charge; the refund is already on its way.', 1],
    ['I have issued a refund for the order and you do not need to do anything else.', 1],
    ['The money has been refunded to the original payment method.', 1],
    ['We will refund the difference to your account today.', 1],
    ['I have approved the refund and the credit is on your statement.', 1],
    ['Your money is being returned, please allow three days for the refund to clear.', 1],
    ['We refunded the second charge this morning.', 1],
    ['Consider the charge removed, the refund is complete.', 1],
    ['The refund was issued yesterday and should land by Friday.', 1],
    ['I have processed a full refund, including the shipping cost.', 1],
    ['Your card has been credited; the refund will post in three to five days.', 1],
    ['We have reversed the charge and the money is on its way back.', 1],
    ['A refund for the duplicate payment has already been sent to your bank.', 1],
    ['You will be refunded in full, no further action needed on your side.', 1],
    ['The overcharge has been credited back to your account.', 1],
    ['I am refunding the entire invoice now, you should see it shortly.', 1],
    ['The purchase has been refunded and the balance restored.', 1],
    ['We sent the money back to your card earlier today.', 1],
    ['Your refund is approved and the payment provider is releasing it.', 1],
    ['I have returned the funds to the account you paid from.', 1],

    ['Thanks for reaching out. Could you send the order number so we can look into it?', 0],
    ['I understand your frustration and I have escalated this to the billing team.', 0],
    ['Unfortunately this charge is correct under the terms of the plan.', 0],
    ['Could you confirm the last four digits of the card on file?', 0],
    ['I am sorry for the delay, our team is investigating the issue.', 0],
    ['The invoice was generated automatically at the start of the period.', 0],
    ['We appreciate your patience while we review the account.', 0],
    ['This order is outside the return window, but I can offer a credit next month.', 0],
    ['I have updated the billing contact as requested.', 0],
    ['Please let us know if you would like to change the plan.', 0],
    ['Our billing team will review your case and reply within two days.', 0],
    ['The charge matches the plan you selected at checkout.', 0],
    ['I can see the payment on our side, but I need to check with finance.', 0],
    ['Refunds are handled by a separate department; I have forwarded your message.', 0],
    ['Your subscription renews automatically unless you cancel it.', 0],
    ['We can look into this once we verify the account owner.', 0],
    ['The price you see includes tax and processing fees.', 0],
    ['I am unable to issue a refund outside the thirty day policy.', 0],
    ['Please reply with the invoice number so we can investigate.', 0],
    ['The duplicate you mention may be a pending authorisation, not a charge.', 0],
    ['Our records show a single payment for this period.', 0],
    ['I have logged your complaint and someone will follow up.', 0]
  ].map(function (r) { return { text: r[0], refund: r[1] }; });

  // --------------------------------------------------------------- heads

  function head(name, corpus, options, key, opts) {
    var m = train(corpus.train, options, opts, key);
    m.T = fitTemperature(m, corpus.hold, options, key);
    m.options = options;
    m.key = key;
    m.name = name;
    return m;
  }

  var HOLD_ALL = { train: TRAIN, hold: HOLD };

  var ROUTER = head('router', HOLD_ALL, OPTIONS, 'label',
    { epochs: 110, lr: 0.06, l2: 1e-3, seed: 7 });
  var REFUND_MODEL = head('refund', { train: REFUND_CASES, hold: REFUND_CASES }, RF_OPTIONS, 'refund',
    { epochs: 200, lr: 0.08, l2: 2e-4, seed: 13 });
  var TONE_MODEL = head('tone', { train: TONE_TRAIN, hold: TONE_HOLD },
    TONE_LEVELS.map(function (d, i) { return { name: 'L' + i, definition: d }; }), 'level',
    { epochs: 140, lr: 0.07, l2: 1e-3, seed: 17 });

  // ---------------------------------------------------------- cheap baseline
  // What a team writes before reaching for a model: keyword counts per queue.
  // It is deterministic, ~2 µs, and — this is the point — it makes *different*
  // mistakes from the learned router. The cascade lab measures both.

  var KEYWORDS = {
    billing: ['charge', 'charged', 'invoice', 'refund', 'refunded', 'payment', 'billed',
      'bill', 'price', 'duplicate', 'amount', 'card', 'cost', 'overcharge'],
    technical: ['error', 'crash', 'crashes', 'crashing', 'timeout', 'timing', 'api', '500',
      'exception', 'integration', 'webhook', 'bug', 'fails', 'failing', 'sync', 'logs'],
    account: ['sign', 'signin', 'password', 'login', 'locked', 'factor', 'code', 'authenticator',
      'credentials', 'email', 'access', 'reset'],
    shipping: ['parcel', 'delivery', 'tracking', 'package', 'courier', 'address', 'shipped',
      'depot', 'arrived', 'box', 'pickup'],
    cancellation: ['cancel', 'cancelling', 'cancellation', 'close', 'renewal', 'stop', 'end']
  };

  function heuristic(state) {
    var toks = tokens(state), seen = Object.create(null), i;
    for (i = 0; i < toks.length; i++) seen[toks[i]] = true;
    var scores = LABELS.map(function (lab) {
      var s = 0;
      KEYWORDS[lab].forEach(function (k) { if (seen[k]) s += 1; });
      return s;
    });
    // Absence of any hit is not evidence for any queue: fall back to a flat
    // distribution, which is exactly what a keyword table cannot resolve.
    var any = scores.some(function (s) { return s > 0; });
    if (!any) return { probabilities: LABELS.map(function () { return 1 / LABELS.length; }), index: 0, confidence: 0, hits: scores };
    var p = softmax(scores, 0.55);
    var r = readChoice(p, OPTIONS);
    r.hits = scores;
    return r;
  }

  // --------------------------------------------------------------- statistics
  // Everything Act II plots is computed here, from the held-out sets the
  // lessons already use. No synthetic curves.

  // Per-class accuracy and mean confidence. `gap` is signed: positive means the
  // model claims more than it delivers on that class.
  function byClass(model, examples, options, T, key) {
    key = key || 'label';
    var out = [];
    for (var c = 0; c < options.length; c++) {
      out.push({ index: c, name: options[c].name, n: 0, correct: 0, sumP: 0, conf: [], hit: [] });
    }
    examples.forEach(function (ex) {
      var r = model.predict(ex.text, options, T);
      var b = out[ex[key]];
      if (!b) return;
      var ok = r.index === ex[key] ? 1 : 0;
      b.n++;
      b.correct += ok;
      b.sumP += r.pmax;
      b.conf.push(r.pmax);
      b.hit.push(ok);
    });
    out.forEach(function (b) {
      b.accuracy = b.n ? b.correct / b.n : 0;
      b.meanP = b.n ? b.sumP / b.n : 0;
      b.gap = b.meanP - b.accuracy;
      b.ece = b.n > 2 ? ece(b.conf, b.hit, 4) : 0;
    });
    return out;
  }

  // One probability + one label per case, for the binary threshold lab.
  function binaryPreds(model, examples, T) {
    return examples.map(function (ex) {
      var r = model.predict(ex.text, RF_OPTIONS, T);
      return { p: r.probabilities[1], y: ex.refund ? 1 : 0 };
    });
  }

  function brierOf(preds) {
    var s = 0;
    preds.forEach(function (o) { s += Math.pow(o.p - o.y, 2); });
    return preds.length ? s / preds.length : 0;
  }

  function logLossOf(preds) {
    var s = 0;
    preds.forEach(function (o) {
      s -= o.y ? Math.log(Math.max(1e-12, o.p)) : Math.log(Math.max(1e-12, 1 - o.p));
    });
    return preds.length ? s / preds.length : 0;
  }

  function accuracyOf(preds) {
    var ok = 0;
    preds.forEach(function (o) { if ((o.p >= 0.5 ? 1 : 0) === o.y) ok++; });
    return preds.length ? ok / preds.length : 0;
  }

  // Threshold sweep for a gate. cost/case = (FP·cFP + FN·cFN)/n, so the units
  // are "cost units per case" and the absolute scale is the user's business.
  function sweep(preds, cFP, cFN) {
    var out = [];
    for (var t = 0.01; t <= 0.99; t += 0.01) {
      var tp = 0, fp = 0, tn = 0, fn = 0;
      preds.forEach(function (o) {
        var say = o.p >= t;
        if (say && o.y) tp++;
        else if (say && !o.y) fp++;
        else if (!say && o.y) fn++;
        else tn++;
      });
      var n = preds.length || 1;
      out.push({
        t: t, tp: tp, fp: fp, tn: tn, fn: fn,
        cost: (fp * cFP + fn * cFN) / n,
        accuracy: (tp + tn) / n,
        rate: (tp + fp) / n
      });
    }
    return out;
  }

  function bestThreshold(preds, cFP, cFN) {
    var pts = sweep(preds, cFP, cFN), best = pts[0];
    for (var i = 1; i < pts.length; i++) if (pts[i].cost < best.cost) best = pts[i];
    // The analytic optimum for a calibrated model is cFP/(cFP+cFN). Report it
    // alongside the empirical argmin so the lesson can compare theory with data.
    best.analytic = cFP + cFN > 0 ? cFP / (cFP + cFN) : 0.5;
    return best;
  }

  // ECE / NLL / Brier across temperatures, for the calibration plot.
  function tempCurve(model, examples, options, key, T) {
    var out = [];
    for (var t = 0.30; t <= 3.001; t += 0.05) {
      var e = evaluate(model, examples, options, t, key);
      out.push({ T: t, ece: e.ece, nll: e.nll, brier: e.brier, accuracy: e.accuracy });
    }
    if (T !== undefined) {
      // make sure the fitted point is on the curve
      var f = evaluate(model, examples, options, T, key);
      out.push({ T: T, ece: f.ece, nll: f.nll, brier: f.brier, accuracy: f.accuracy, mark: true });
    }
    out.sort(function (a, b) { return a.T - b.T; });
    return out;
  }

  // --------------------------------------------------------------- public API

  var API = {
    DIMS: DIMS,
    OPTIONS: OPTIONS,
    SEVERITY: TONE_LEVELS,
    TONE_LEVELS: TONE_LEVELS,
    REFUND_TRUE: REFUND_TRUE,
    REFUND_FALSE: REFUND_FALSE,
    LABELS: LABELS,
    DEMO: DEMO,
    TRAIN: TRAIN,
    HOLD: HOLD,
    ANSWERS: ANSWERS,
    REFUND_CASES: REFUND_CASES,
    TONE_HOLD: TONE_HOLD,
    RF_OPTIONS: RF_OPTIONS,
    models: { router: ROUTER, refund: REFUND_MODEL, tone: TONE_MODEL },
    // fitted temperature per head
    temperature: ROUTER.T,
    temperatures: { router: ROUTER.T, refund: REFUND_MODEL.T, tone: TONE_MODEL.T },

    // Raw output is the default: T = 1 is what the model emits, and the
    // calibration step is what changes it. Lessons that want the deployed
    // answer pass DEC.temperature explicitly.
    predict: function (state, options, temp) {
      return ROUTER.predict(state, options || OPTIONS, temp === undefined ? 1 : temp);
    },
    predictScore: function (state, levels, temp) {
      var opts = (levels || TONE_LEVELS).map(function (d, i) { return { name: 'L' + i, definition: d }; });
      var p = TONE_MODEL.predict(state, opts, temp === undefined ? 1 : temp).probabilities;
      return readScore(p);
    },
    predictNoul: function (state, temp) {
      var r = REFUND_MODEL.predict(state, RF_OPTIONS, temp === undefined ? 1 : temp);
      // A noul answer is one probability. It carries no confidence field —
      // the probability already is the answer.
      return { p: r.probabilities[1], probabilities: r.probabilities };
    },
    scores: function (state, options) { return ROUTER.scores(state, options || OPTIONS); },
    evaluate: function (examples, options, temp) {
      return evaluate(ROUTER, examples || DEMO, options || OPTIONS, temp === undefined ? 1 : temp);
    },
    // name: 'router' | 'refund' | 'tone'
    evaluateHead: function (name, examples, temp) {
      var m = API.models[name];
      var ex = examples || (name === 'router' ? DEMO : name === 'refund' ? DEMO : TONE_HOLD);
      return evaluate(m, ex, m.options, temp === undefined ? 1 : temp, m.key);
    },
    softmax: softmax,
    readChoice: readChoice,
    readScore: readScore,
    entropy: entropy,
    ece: ece,
    reliability: reliability,

    // ---------------------------------------------------- Act II statistics

    // per-class accuracy, mean confidence and signed gap (positive = overconfident)
    byClass: function (name, examples, temp) {
      var m = API.models[name];
      var ex = examples || (name === 'router' ? DEMO : name === 'tone' ? TONE_HOLD : REFUND_CASES);
      return byClass(m, ex, m.options, temp === undefined ? 1 : temp, m.key);
    },

    // one (p, y) per case; y=1 is "the reply promises a refund"
    binaryPreds: function (temp, examples) {
      return binaryPreds(REFUND_MODEL, examples || REFUND_CASES, temp === undefined ? 1 : temp);
    },

    sweep: function (cFP, cFN, temp) {
      return sweep(API.binaryPreds(temp), cFP, cFN);
    },
    bestThreshold: function (cFP, cFN, temp) {
      return bestThreshold(API.binaryPreds(temp), cFP, cFN);
    },
    brier: brierOf,
    logLoss: logLossOf,
    binaryAccuracy: accuracyOf,

    tempCurve: function (name, temp) {
      var m = API.models[name];
      var ex = name === 'tone' ? TONE_HOLD : name === 'refund' ? REFUND_CASES : DEMO;
      return tempCurve(m, ex, m.options, m.key, temp === undefined ? m.T : temp);
    },

    // The escalation lab: cheap keyword table + learned router, measured on the
    // same cases. `threshold` is on the CHEAP model's confidence: below it, the
    // case is escalated. This is the real cascade arithmetic, not a formula.
    cascade: function (examples, threshold, temp) {
      var ex = examples || DEMO, t = temp === undefined ? 1 : temp;
      var n = 0, esc = 0, cheapRight = 0, routerRight = 0, finalRight = 0;
      var bothRight = 0, bothWrong = 0, cheapOnly = 0, routerOnly = 0;
      var keptN = 0, keptRight = 0, escN = 0, escRight = 0;
      ex.forEach(function (e) {
        var h = heuristic(e.text);
        var r = ROUTER.predict(e.text, OPTIONS, t);
        var cOk = h.index === e.label, rOk = r.index === e.label;
        n++;
        if (cOk) cheapRight++;
        if (rOk) routerRight++;
        if (cOk && rOk) bothRight++;
        if (!cOk && !rOk) bothWrong++;
        if (cOk && !rOk) cheapOnly++;
        if (!cOk && rOk) routerOnly++;

        var useRouter = h.confidence < threshold;
        if (useRouter) { esc++; escN++; if (rOk) escRight++; }
        else { keptN++; if (cOk) keptRight++; }
        if (useRouter ? rOk : cOk) finalRight++;
      });
      return {
        n: n,
        cheapAccuracy: cheapRight / n,
        routerAccuracy: routerRight / n,
        finalAccuracy: finalRight / n,
        escalateRate: esc / n,
        keptAccuracy: keptN ? keptRight / keptN : 1,
        escalatedAccuracy: escN ? escRight / escN : 0,
        bothRight: bothRight / n,
        bothWrong: bothWrong / n,
        cheapOnly: cheapOnly,
        routerOnly: routerOnly,
        // the single number that decides whether a cascade can help at all
        complementarity: (cheapOnly + routerOnly) / n,
        // how often the two agree, right or wrong
        agreement: (bothRight + bothWrong) / n
      };
    },
    heuristic: heuristic,

    utils: { tokens: tokens, stem: stem, fnv: fnv, mulberry32: mulberry32, stateIndex: stateIndex }
  };

  window.DEC = API;
})();
