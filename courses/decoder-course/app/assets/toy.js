/* ToyLM — the engine behind the course page.
 *
 * Everything here is real arithmetic that runs in your browser, no server:
 *   - a 3-gram language model with backoff (stands in for a transformer's output layer)
 *   - a byte-pair encoder trained on the corpus at load time
 *   - PPMI co-occurrence vectors reduced to 2-D with power iteration
 *   - a 1-hidden-layer neural language model trained live with Adam
 *   - the residual/LayerNorm norm experiment, sinusoidal positions, scaling laws
 *
 * The toy model is small on purpose. Its *interface* — a probability for every
 * token, given a context — is identical to GPT's. Its depth is not, and the
 * course says so.
 */
(function (root) {
  'use strict';

  var TEXT = [
    'a language model does one thing it reads a sequence of tokens and it guesses the next token',
    'the guess is a probability for every token in the vocabulary',
    'the model does not know what a word means it only knows how often it follows another word',
    'the model reads the text one token at a time and it writes the next token',
    'a token is a small piece of text',
    'a token can be a whole word or a piece of a word',
    'the model turns a token into a vector',
    'a vector is a list of numbers',
    'the numbers in the vector carry the meaning of the token',
    'two tokens with a similar meaning have vectors that point in a similar direction',
    'the angle between two vectors is a measure of meaning',
    'the model learns the vectors from the data',
    'the model learns everything from the data',
    'the data is a large amount of text',
    'the text is only text',
    'the model finds a pattern in the text',
    'a pattern is a habit of the language',
    'the sentence is a sequence of tokens',
    'the order of the tokens is part of the meaning',
    'the cat sat on the mat',
    'the mat sat on the cat',
    'the same words in a different order are a different sentence',
    'the model needs to know the position of the token',
    'the position is a vector that is added to the token vector',
    'the model mixes the tokens with attention',
    'attention is the only place where tokens exchange information',
    'each token asks a question and each token offers a key',
    'the question is called the query',
    'the offer is called the key',
    'the information is called the value',
    'the query of one token is compared with the key of every other token',
    'the comparison is a dot product',
    'a large dot product means the query and the key agree',
    'the scores become a probability with a softmax',
    'the softmax turns a list of scores into a probability distribution',
    'the output is a weighted average of the values',
    'a head is one way of mixing the tokens',
    'a layer has many heads',
    'each head learns a different pattern',
    'one head follows the subject and another head follows the verb',
    'the layers are stacked in a block',
    'a block is attention and a small network and two residual connections',
    'the residual connection carries the token vector around the block',
    'the residual connection is a highway for information',
    'the vector that flows through the blocks is the residual stream',
    'each block reads the stream and writes back to the stream',
    'the model refines the stream one block at a time',
    'the layer norm keeps the numbers in a healthy range',
    'without the layer norm the numbers grow without limit',
    'the numbers grow and the softmax saturates',
    'a saturated softmax has no gradient',
    'a model without a gradient cannot learn',
    'after the last block the model produces a score for every token',
    'the score is called a logit',
    'the logits become a probability with a softmax',
    'the probability is the prediction of the model',
    'a temperature divides the logits before the softmax',
    'a low temperature makes the model confident',
    'a high temperature makes the model random',
    'top k keeps the k most likely tokens',
    'top p keeps the smallest set of tokens whose probability is above p',
    'the model samples one token from the distribution',
    'the sampled token is added to the sequence',
    'the model runs again on the longer sequence',
    'the loop is the whole of generation',
    'the model is trained to make the next token likely',
    'the loss is the surprise of the model at the true token',
    'the surprise is a number of bits',
    'a good model is not surprised by the text',
    'the gradient tells every parameter which way to move',
    'the gradient is computed by backpropagation',
    'the optimiser takes a small step down the loss',
    'the step size is the learning rate',
    'a large learning rate overshoots and the loss explodes',
    'a small learning rate crawls and the training is slow',
    'the model sees a batch of examples at every step',
    'the training data is split into a train set and a validation set',
    'the validation set tells you if the model memorised the data',
    'a model that memorises the train set and fails the validation set is overfitting',
    'a larger model has more parameters',
    'more parameters and more data give a lower loss',
    'the loss falls as a power law',
    'the power law is stable across many orders of magnitude',
    'a bigger model is not always a better model for a small job',
    'the context window is the number of tokens the model can read',
    'the cost of attention grows with the square of the context',
    'the key value cache stores the keys and values of the past tokens',
    'the cache makes generation fast and it costs memory',
    'the model is pretrained on text and then tuned on examples',
    'the tuning teaches the model to answer a question',
    'a reward model scores two answers and the model learns the better one',
    'the alignment step changes the style of the model more than its knowledge',
    'a hallucination is a fluent token that is not true',
    'the model has no table of facts it only has a distribution over tokens',
    'the distribution is a map of the language and not a map of the world',
    'a prompt is a context that steers the distribution',
    'a good prompt makes the right token likely',
    'the model is a prediction machine and nothing more',
    'the prediction is the whole trick',
    'the rest is engineering at a large scale',
    'the cat sat on the warm mat in the morning light',
    'the dog sat on the warm street in the morning light',
    'the cat and the dog are both animals',
    'the city is loud in the morning',
    'the rain falls on the city and the street is wet',
    'the river runs past the city and into the sea',
    'the bread is warm and the morning is cold',
    'the engine is loud and the street is quiet',
    'the letter is on the table and the light is on',
    'the number is on the table and the table is in the room',
    'the window is open and the sound of the rain is loud',
    'a small model can learn a small pattern',
    'a large model can learn a large pattern',
    'the pattern is in the data and the data is in the text'
  ].join('\n');

  var START = '<s>';
  var WORD_RE = /[a-z]+/g;

  function words(text) {
    return String(text).toLowerCase().match(WORD_RE) || [];
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function gauss(rng) {
    var u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function softmax(logits) {
    var n = logits.length, out = new Float64Array(n), mx = -Infinity, i;
    for (i = 0; i < n; i++) if (logits[i] > mx) mx = logits[i];
    var sum = 0;
    for (i = 0; i < n; i++) { out[i] = Math.exp(logits[i] - mx); sum += out[i]; }
    for (i = 0; i < n; i++) out[i] /= sum;
    return out;
  }

  // ---------------------------------------------------------------- n-gram LM

  function buildLM() {
    var toks = words(TEXT);
    var vocab = [START];
    var idOf = new Map();
    idOf.set(START, 0);
    for (var i = 0; i < toks.length; i++) {
      if (!idOf.has(toks[i])) { idOf.set(toks[i], vocab.length); vocab.push(toks[i]); }
    }
    var ids = toks.map(function (t) { return idOf.get(t); });
    var V = vocab.length;

    var uni = new Float64Array(V);
    var bi = new Map();
    var tri = new Map();
    var padded = [0, 0].concat(ids);

    for (var k = 2; k < padded.length; k++) {
      var a = padded[k - 2], b = padded[k - 1], c = padded[k];
      uni[c] += 1;
      var bk = a === 0 ? '0' : String(a);
      var bm = bi.get(b);
      if (!bm) { bm = new Float64Array(V); bi.set(b, bm); }
      bm[c] += 1;
      var tk = a + ',' + b;
      var tm = tri.get(tk);
      if (!tm) { tm = new Float64Array(V); tri.set(tk, tm); }
      tm[c] += 1;
    }

    var total = ids.length;
    var L3 = 0.72, L2 = 0.22, L1 = 0.05, FLOOR = 0.01;

    function rowSum(m) {
      if (!m) return 0;
      var s = 0;
      for (var i = 0; i < m.length; i++) s += m[i];
      return s;
    }

    function probs(ctx) {
      var c1 = ctx.length > 0 ? ctx[ctx.length - 1] : 0;
      var c2 = ctx.length > 1 ? ctx[ctx.length - 2] : 0;
      var tm = tri.get(c2 + ',' + c1);
      var ts = rowSum(tm);
      var bm = bi.get(c1);
      var bs = rowSum(bm);
      var out = new Float64Array(V);
      var sum = 0;
      for (var t = 1; t < V; t++) {
        var p3 = ts > 0 ? tm[t] / ts : 0;
        var p2 = bs > 0 ? bm[t] / bs : 0;
        var p1 = uni[t] / total;
        var p = L3 * p3 + L2 * p2 + L1 * p1 + FLOOR / V;
        out[t] = p;
        sum += p;
      }
      for (var j = 1; j < V; j++) out[j] /= sum;
      out[0] = 0;
      return out;
    }

    // Shannon-style surprise, in bits, of the true next token.
    function surprisal(ctx, id) {
      var p = probs(ctx)[id];
      return p > 0 ? -Math.log2(p) : Infinity;
    }

    return {
      vocab: vocab, idOf: idOf, ids: ids, V: V,
      task: '3-gram with backoff, ' + V + ' tokens of vocabulary, ' + total + ' tokens of corpus',
      probs: probs,
      surprisal: surprisal
    };
  }

  // ---------------------------------------------------------------------- BPE

  function buildBPE(maxMerges) {
    var freq = new Map();
    var order = [];
    TEXT.split(/\s+/).forEach(function (w) {
      var clean = w.replace(/[^a-z]/g, '');
      if (!clean) return;
      if (!freq.has(clean)) { freq.set(clean, 0); order.push(clean); }
      freq.set(clean, freq.get(clean) + 1);
    });

    var wordsList = order.map(function (w) {
      var syms = w.split('');
      syms.push('</w>');
      return { syms: syms, n: freq.get(w) };
    });

    // Counting must be weighted by how often each word appears, otherwise the
    // merges reflect the size of the dictionary instead of the size of the corpus.
    function pairCounts(list) {
      var counts = new Map();
      for (var i = 0; i < list.length; i++) {
        var s = list[i].syms, w = list[i].n;
        for (var j = 0; j < s.length - 1; j++) {
          var key = s[j] + '\u0000' + s[j + 1];
          counts.set(key, (counts.get(key) || 0) + w);
        }
      }
      return counts;
    }

    var current = wordsList.map(function (o) { return { syms: o.syms.slice(), n: o.n }; });
    var merges = [];
    for (var m = 0; m < maxMerges; m++) {
      var counts = pairCounts(current);
      var best = null, bestN = 1;
      counts.forEach(function (n, key) {
        if (n > bestN) { bestN = n; best = key; }
      });
      if (!best) break;
      var parts = best.split('\u0000');
      merges.push([parts[0], parts[1], bestN]);
      current = current.map(function (o) { return { syms: mergeWord(o.syms, parts[0], parts[1]), n: o.n }; });
    }

    function mergeWord(syms, a, b) {
      var out = [];
      for (var i = 0; i < syms.length; i++) {
        if (i < syms.length - 1 && syms[i] === a && syms[i + 1] === b) {
          out.push(a + b);
          i++;
        } else out.push(syms[i]);
      }
      return out;
    }

    // Apply merges 0..k in learned rank order — the ordering is the algorithm.
    function tokenize(text, k) {
      var base = words(text);
      var limit = Math.max(0, Math.min(k, merges.length));
      var out = [];
      base.forEach(function (w) {
        var syms = w.split('');
        syms.push('</w>');
        for (var i = 0; i < limit; i++) {
          syms = mergeWord(syms, merges[i][0], merges[i][1]);
        }
        out = out.concat(syms);
      });
      return out;
    }

    function vocabSize(k) {
      var limit = Math.max(0, Math.min(k, merges.length));
      var set = new Set();
      for (var i = 0; i < order.length; i++) {
        var syms = order[i].split('');
        syms.push('</w>');
        for (var j = 0; j < limit; j++) syms = mergeWord(syms, merges[j][0], merges[j][1]);
        syms.forEach(function (s) { set.add(s); });
      }
      return set.size;
    }

    return { merges: merges, tokenize: tokenize, vocabSize: vocabSize, words: order.length };
  }

  // ----------------------------------------------------------------- PPMI + PCA

  function buildEmbeddings(lm) {
    var V = lm.V, ids = lm.ids, W = 3;
    var M = new Float64Array(V * V);
    var row = new Float64Array(V), col = new Float64Array(V), total = 0;

    for (var i = 0; i < ids.length; i++) {
      for (var d = 1; d <= W; d++) {
        var j = i + d;
        if (j >= ids.length) break;
        var a = ids[i], b = ids[j];
        if (a === 0 || b === 0) continue;
        M[a * V + b] += 1;
        M[b * V + a] += 1;
        row[a] += 1; row[b] += 1;
        col[a] += 1; col[b] += 1;
        total += 2;
      }
    }

    // Positive pointwise mutual information: counts -> a rough geometry of context.
    var P = new Float64Array(V * V);
    for (var x = 0; x < V; x++) {
      for (var y = 0; y < V; y++) {
        var c = M[x * V + y];
        if (!c) continue;
        var pmi = Math.log((c * total) / (row[x] * col[y]) + 1e-12);
        if (pmi > 0) P[x * V + y] = pmi;
      }
    }

    // Two leading singular vectors by power iteration, with deflation.
    var comps = [];
    var work = P.slice();
    for (var comp = 0; comp < 2; comp++) {
      var v = new Float64Array(V);
      var rng = mulberry32(11 + comp);
      for (var q = 0; q < V; q++) v[q] = rng() - 0.5;
      var t = new Float64Array(V);
      for (var it = 0; it < 60; it++) {
        // t = A v ; then v = A^T t  (eigenvector of A^T A)
        for (var r = 0; r < V; r++) {
          var acc = 0;
          for (var s = 0; s < V; s++) acc += work[r * V + s] * v[s];
          t[r] = acc;
        }
        for (var c2 = 0; c2 < V; c2++) {
          var acc2 = 0;
          for (var r2 = 0; r2 < V; r2++) acc2 += work[r2 * V + c2] * t[r2];
          v[c2] = acc2;
        }
        var norm = 0;
        for (var z = 0; z < V; z++) norm += v[z] * v[z];
        norm = Math.sqrt(norm) || 1;
        for (var z2 = 0; z2 < V; z2++) v[z2] /= norm;
      }
      // u = A v / |A v|
      var u = new Float64Array(V), sigma = 0;
      for (var r3 = 0; r3 < V; r3++) {
        var acc3 = 0;
        for (var s3 = 0; s3 < V; s3++) acc3 += work[r3 * V + s3] * v[s3];
        u[r3] = acc3;
        sigma += acc3 * acc3;
      }
      sigma = Math.sqrt(sigma) || 1;
      for (var r4 = 0; r4 < V; r4++) u[r4] /= sigma;
      comps.push({ u: u, v: v, sigma: sigma });
      for (var a2 = 0; a2 < V; a2++) {
        for (var b2 = 0; b2 < V; b2++) {
          work[a2 * V + b2] -= sigma * u[a2] * v[b2];
        }
      }
    }

    // Project the original matrix onto the two directions.
    var coords = [];
    var maxAbs = 0;
    for (var w = 0; w < V; w++) {
      var cx = 0, cy = 0;
      for (var k = 0; k < V; k++) {
        cx += P[w * V + k] * comps[0].v[k];
        cy += P[w * V + k] * comps[1].v[k];
      }
      coords.push([cx, cy]);
      maxAbs = Math.max(maxAbs, Math.abs(cx), Math.abs(cy));
    }
    maxAbs = maxAbs || 1;
    coords = coords.map(function (p) { return [p[0] / maxAbs, p[1] / maxAbs]; });

    function vector(id) {
      var out = new Float64Array(V);
      for (var k = 0; k < V; k++) out[k] = P[id * V + k];
      return out;
    }

    function cosine(a, b) {
      var va = vector(a), vb = vector(b), dot = 0, na = 0, nb = 0;
      for (var k = 0; k < V; k++) { dot += va[k] * vb[k]; na += va[k] * va[k]; nb += vb[k] * vb[k]; }
      return dot / (Math.sqrt(na * nb) || 1);
    }

    function neighbors(id, n) {
      var base = vector(id), ranked = [];
      for (var k = 1; k < V; k++) {
        if (k === id) continue;
        var v = vector(k), dot = 0, na = 0, nb = 0;
        for (var q = 0; q < V; q++) { dot += base[q] * v[q]; na += base[q] * base[q]; nb += v[q] * v[q]; }
        if (na === 0 || nb === 0) continue;
        ranked.push([k, dot / Math.sqrt(na * nb)]);
      }
      ranked.sort(function (a, b) { return b[1] - a[1]; });
      return ranked.slice(0, n);
    }

    return { coords: coords, vector: vector, cosine: cosine, neighbors: neighbors, window: W };
  }

  // ------------------------------------------------------ live-trained neural LM

  function createTrainer(opts) {
    opts = opts || {};
    var hidden = opts.hidden || 32;
    var ctx = opts.ctx || 2;
    var lr = opts.lr || 0.01;
    var batch = opts.batch || 24;
    var lm = opts.lm;
    var V = lm.V, D = 6, X = ctx * D;
    var rng = mulberry32(opts.seed || 7);

    var E = new Float64Array(V * D);
    var W1 = new Float64Array(X * hidden);
    var b1 = new Float64Array(hidden);
    var W2 = new Float64Array(hidden * V);
    var b2 = new Float64Array(V);

    for (var i = 0; i < E.length; i++) E[i] = gauss(rng) * 0.08;
    for (var j = 0; j < W1.length; j++) W1[j] = gauss(rng) / Math.sqrt(X);
    for (var k = 0; k < W2.length; k++) W2[k] = gauss(rng) / Math.sqrt(hidden);

    var params = [E, W1, b1, W2, b2];
    var m = params.map(function (p) { return new Float64Array(p.length); });
    var v = params.map(function (p) { return new Float64Array(p.length); });
    var tAdam = 0;
    var beta1 = 0.9, beta2 = 0.999, eps = 1e-8;

    var pad = [0, 0].concat(lm.ids);
    var positions = [];
    for (var p = ctx; p < pad.length; p++) positions.push(p);
    var split = Math.floor(positions.length * 0.9);
    var trainPos = positions.slice(0, split);
    var valPos = positions.slice(split);

    var history = [];
    var stepCount = 0;

    function forward(cids, y, grads, needGrad) {
      var xv = new Float64Array(X);
      for (var c = 0; c < ctx; c++) {
        var id = cids[c];
        for (var d = 0; d < D; d++) xv[c * D + d] = E[id * D + d];
      }
      var z = new Float64Array(hidden);
      var h = new Float64Array(hidden);
      for (var u = 0; u < hidden; u++) {
        var acc = b1[u];
        for (var q = 0; q < X; q++) acc += W1[u * X + q] * xv[q];
        z[u] = acc;
        h[u] = Math.tanh(acc);
      }
      var logits = new Float64Array(V);
      for (var c2 = 0; c2 < V; c2++) {
        var acc2 = b2[c2];
        for (var u2 = 0; u2 < hidden; u2++) acc2 += W2[c2 * hidden + u2] * h[u2];
        logits[c2] = acc2;
      }
      var probs = softmax(logits);
      var loss = -Math.log(Math.max(probs[y], 1e-12));
      if (!needGrad) return { loss: loss, probs: probs, h: h, x: xv, logits: logits };

      var dlogits = new Float64Array(probs);
      dlogits[y] -= 1;

      var gW2 = grads.W2, gb2 = grads.b2, gW1 = grads.W1, gb1 = grads.b1, gE = grads.E;
      var dh = new Float64Array(hidden);
      for (var o = 0; o < V; o++) {
        var g = dlogits[o];
        if (g === 0) continue;
        gb2[o] += g;
        for (var u3 = 0; u3 < hidden; u3++) {
          gW2[o * hidden + u3] += g * h[u3];
          dh[u3] += W2[o * hidden + u3] * g;
        }
      }
      var dz = new Float64Array(hidden);
      for (var u4 = 0; u4 < hidden; u4++) dz[u4] = dh[u4] * (1 - h[u4] * h[u4]);
      var dx = new Float64Array(X);
      for (var u5 = 0; u5 < hidden; u5++) {
        var gg = dz[u5];
        if (gg === 0) continue;
        gb1[u5] += gg;
        for (var q2 = 0; q2 < X; q2++) {
          gW1[u5 * X + q2] += gg * xv[q2];
          dx[q2] += W1[u5 * X + q2] * gg;
        }
      }
      for (var c3 = 0; c3 < ctx; c3++) {
        var id2 = cids[c3];
        for (var d2 = 0; d2 < D; d2++) gE[id2 * D + d2] += dx[c3 * D + d2];
      }
      return { loss: loss, probs: probs, h: h, x: xv, logits: logits };
    }

    function contextAt(pos) {
      var c = [];
      for (var i = 0; i < ctx; i++) c.push(pad[pos - ctx + i]);
      return c;
    }

    function step() {
      var grads = {
        E: new Float64Array(E.length),
        W1: new Float64Array(W1.length),
        b1: new Float64Array(b1.length),
        W2: new Float64Array(W2.length),
        b2: new Float64Array(b2.length)
      };
      var sum = 0;
      for (var n = 0; n < batch; n++) {
        var pos = trainPos[Math.floor(rng() * trainPos.length)];
        var r = forward(contextAt(pos), pad[pos], grads, true);
        sum += r.loss;
      }
      var gs = [grads.E, grads.W1, grads.b1, grads.W2, grads.b2];
      tAdam++;
      var corr1 = 1 - Math.pow(beta1, tAdam);
      var corr2 = 1 - Math.pow(beta2, tAdam);
      for (var pi = 0; pi < params.length; pi++) {
        var P = params[pi], G = gs[pi], M = m[pi], Vv = v[pi];
        for (var idx = 0; idx < P.length; idx++) {
          var gval = G[idx] / batch;
          M[idx] = beta1 * M[idx] + (1 - beta1) * gval;
          Vv[idx] = beta2 * Vv[idx] + (1 - beta2) * gval * gval;
          P[idx] -= lr * (M[idx] / corr1) / (Math.sqrt(Vv[idx] / corr2) + eps);
        }
      }
      var mean = sum / batch;
      stepCount++;
      history.push([stepCount, mean]);
      return mean;
    }

    function valLoss() {
      var sum = 0, n = Math.min(160, valPos.length);
      for (var i = 0; i < n; i++) {
        var pos = valPos[Math.floor(rng() * valPos.length)];
        sum += forward(contextAt(pos), pad[pos], null, false).loss;
      }
      return sum / n;
    }

    function probsFor(cids) {
      return forward(cids, 0, null, false).probs;
    }

    function sample(n, temperature, seedText) {
      temperature = temperature || 0.9;
      var ctxIds = [];
      if (seedText) {
        var sw = words(seedText);
        for (var si = 0; si < sw.length; si++) {
          var sid = lm.idOf.get(sw[si]);
          if (sid !== undefined) ctxIds.push(sid);
        }
      }
      while (ctxIds.length < ctx) ctxIds.unshift(0);
      if (ctxIds.length > ctx) ctxIds = ctxIds.slice(-ctx);
      var out = [];
      for (var i = 0; i < n; i++) {
        var p = probsFor(ctxIds);
        var adj = new Float64Array(V);
        for (var k = 1; k < V; k++) adj[k] = Math.pow(Math.max(p[k], 1e-12), 1 / temperature);
        var q = softmax(adj);
        var r = rng(), acc = 0, pick = 1;
        for (var j = 1; j < V; j++) { acc += q[j]; if (r <= acc) { pick = j; break; } pick = j; }
        out.push(lm.vocab[pick]);
        ctxIds.push(pick);
        if (ctxIds.length > ctx) ctxIds.shift();
      }
      return out.join(' ');
    }

    return {
      step: step, valLoss: valLoss, history: history, sample: sample, probsFor: probsFor,
      get steps() { return stepCount; },
      config: { hidden: hidden, ctx: ctx, lr: lr, batch: batch, D: D }
    };
  }

  // --------------------------------------------------- residual stream experiment

  function blockRun(opts) {
    var layers = opts.layers, residual = opts.residual, ln = opts.ln;
    var d = 16;
    var rng = mulberry32(3);
    var x = new Float64Array(d);
    for (var i = 0; i < d; i++) x[i] = gauss(rng);
    var x0 = x.slice();

    function norm(vec) {
      var s = 0;
      for (var k = 0; k < vec.length; k++) s += vec[k] * vec[k];
      return Math.sqrt(s);
    }

    function layernorm(vec) {
      var mean = 0, i2;
      for (i2 = 0; i2 < vec.length; i2++) mean += vec[i2];
      mean /= vec.length;
      var varr = 0;
      for (i2 = 0; i2 < vec.length; i2++) varr += (vec[i2] - mean) * (vec[i2] - mean);
      varr /= vec.length;
      var out = new Float64Array(vec.length);
      for (i2 = 0; i2 < vec.length; i2++) out[i2] = (vec[i2] - mean) / Math.sqrt(varr + 1e-5);
      return out;
    }

    var W1s = [], W2s = [], Wr = new Float64Array(8 * d);
    for (var l = 0; l < layers; l++) {
      var A = new Float64Array(d * d), B = new Float64Array(d * d);
      for (var a = 0; a < d * d; a++) {
        A[a] = gauss(rng) / Math.sqrt(d) * 2.1;
        B[a] = gauss(rng) / Math.sqrt(d) * 2.1;
      }
      W1s.push(A); W2s.push(B);
    }
    for (var r = 0; r < 8 * d; r++) Wr[r] = gauss(rng) / Math.sqrt(d) * 2.2;

    var norms = [norm(x)];
    for (var li = 0; li < layers; li++) {
      var mid = new Float64Array(d), pre = new Float64Array(d), post = new Float64Array(d);
      for (var o = 0; o < d; o++) {
        var acc = 0;
        for (var q = 0; q < d; q++) acc += W1s[li][o * d + q] * x[q];
        mid[o] = Math.tanh(acc);
      }
      for (var o2 = 0; o2 < d; o2++) {
        var acc2 = 0;
        for (var q2 = 0; q2 < d; q2++) acc2 += W2s[li][o2 * d + q2] * mid[q2];
        pre[o2] = acc2; // the block's write
      }
      for (var o3 = 0; o3 < d; o3++) post[o3] = residual ? x[o3] + 0.9 * pre[o3] : 0.9 * pre[o3];
      x = ln ? layernorm(post) : post;
      norms.push(norm(x));
    }

    var logits = new Float64Array(8);
    for (var c = 0; c < 8; c++) {
      var s2 = 0;
      for (var q3 = 0; q3 < d; q3++) s2 += Wr[c * d + q3] * x[q3];
      logits[c] = s2;
    }
    var p2 = softmax(logits);
    var maxp = 0;
    for (var m2 = 0; m2 < p2.length; m2++) if (p2[m2] > maxp) maxp = p2[m2];
    var lo = Infinity, hi = -Infinity;
    for (var g = 0; g < 8; g++) { if (logits[g] < lo) lo = logits[g]; if (logits[g] > hi) hi = logits[g]; }

    // How much of the original token vector survived the stack.
    var dot = 0, na = 0, nb = 0;
    for (var q4 = 0; q4 < d; q4++) { dot += x[q4] * x0[q4]; na += x[q4] * x[q4]; nb += x0[q4] * x0[q4]; }
    var retention = dot / (Math.sqrt(na * nb) || 1);

    return { norms: norms, sharpness: maxp, finalNorm: norm(x), logitRange: hi - lo, retention: retention, d: d };
  }

  // ------------------------------------------------------------ position vectors

  function sinusoid(pos, dim) {
    var out = new Float64Array(dim);
    for (var i = 0; i < dim; i += 2) {
      var div = Math.pow(10000, i / dim);
      out[i] = Math.sin(pos / div);
      if (i + 1 < dim) out[i + 1] = Math.cos(pos / div);
    }
    return out;
  }

  // ------------------------------------------------------------------- scaling

  function scalingLoss(N, D) {
    // Chinchilla-style fit: irreducible entropy plus two reducible terms.
    return 1.69 + 406.4 / Math.pow(N, 0.34) + 410.7 / Math.pow(D, 0.28);
  }

  // ------------------------------------------------------------------- decoding
  // The four knobs everyone argues about, applied in the order a sampler applies
  // them: repetition penalty -> temperature -> top-k -> top-p -> renormalise.
  function decode(probs, o) {
    o = o || {};
    var V = probs.length;
    var logits = new Float64Array(V);
    var i;
    for (i = 0; i < V; i++) logits[i] = Math.log(Math.max(probs[i], 1e-12));

    var rep = o.rep || 1;
    var recent = o.recent || [];
    if (rep > 1.0001) {
      for (var r = 0; r < recent.length; r++) {
        var id = recent[r];
        if (id >= 0 && id < V) logits[id] = logits[id] > 0 ? logits[id] / rep : logits[id] * rep;
      }
    }

    var temp = o.temperature === undefined ? 1 : o.temperature;
    var adj;
    if (temp <= 0.05) {
      adj = new Float64Array(V);
      var best = 1, bv = -Infinity;
      for (i = 1; i < V; i++) if (logits[i] > bv) { bv = logits[i]; best = i; }
      adj[best] = 1;
      return { probs: adj, kept: adj.map(function (p) { return p > 0; }), greedy: true };
    }
    for (i = 0; i < V; i++) logits[i] /= temp;
    adj = softmax(logits);

    var order = [];
    for (i = 1; i < V; i++) order.push(i);
    order.sort(function (a, b) { return adj[b] - adj[a]; });

    var keep = new Uint8Array(V);
    var k = o.topK || 0;
    var limit = k > 0 ? Math.min(k, order.length) : order.length;
    for (i = 0; i < limit; i++) keep[order[i]] = 1;

    var topP = o.topP === undefined ? 1 : o.topP;
    if (topP < 0.999) {
      var cum = 0, cut = limit;
      for (i = 0; i < limit; i++) {
        cum += adj[order[i]];
        if (cum >= topP) { cut = i + 1; break; }
      }
      for (i = 0; i < V; i++) keep[i] = 0;
      for (i = 0; i < cut; i++) keep[order[i]] = 1;
    }

    var sum = 0;
    for (i = 0; i < V; i++) { if (!keep[i]) adj[i] = 0; sum += adj[i]; }
    if (sum <= 0) { adj[order[0]] = 1; sum = 1; }
    for (i = 0; i < V; i++) adj[i] /= sum;

    return { probs: adj, kept: keep, order: order, greedy: false };
  }

  function pick(probs, rng) {
    var r = rng(), acc = 0, last = 1;
    for (var i = 1; i < probs.length; i++) {
      if (probs[i] <= 0) continue;
      acc += probs[i];
      last = i;
      if (r <= acc) return i;
    }
    return last;
  }

  // ----------------------------------------------------------------- exporting

  var lm = buildLM();
  var API = {
    TEXT: TEXT,
    start: START,
    words: words,
    rng: mulberry32,
    softmax: softmax,
    lm: lm,
    bpe: buildBPE(240),
    embeddings: null,
    getEmbeddings: function () {
      if (!API.embeddings) API.embeddings = buildEmbeddings(lm);
      return API.embeddings;
    },
    createTrainer: createTrainer,
    decode: decode,
    pick: pick,
    blockRun: blockRun,
    sinusoid: sinusoid,
    scalingLoss: scalingLoss
  };

  root.TOY = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
