// Pronunciation scoring from CTC phone posteriors.
// 1) Viterbi forced alignment of the expected phones.
// 2) For each phone, a local likelihood-ratio test (goodness of pronunciation): the expected phone and its
//    accepted variants vs every plausible substitute and deletion, scored with the CTC forward algorithm
//    over a short window of frames. The winning substitute tells the learner what they actually said.
// 3) Extra-vowel (epenthesis) tests at consonant clusters and word edges.
import { V, BLANK, ID, VOCAB, candidates, isVowel, show, UNIT, HEARD_NAME } from './phones.js';

export const FRAME_SEC = 0.02;
const NEG = -1e30;
const lse = (a, b) => (a === NEG ? b : b === NEG ? a : a > b ? a + Math.log1p(Math.exp(b - a)) : b + Math.log1p(Math.exp(a - b)));

export function logSoftmax(logits, T, Vn = V) {
  const out = new Float32Array(T * Vn);
  for (let t = 0; t < T; t++) {
    const o = t * Vn;
    let m = -Infinity;
    for (let v = 0; v < Vn; v++) if (logits[o + v] > m) m = logits[o + v];
    let s = 0;
    for (let v = 0; v < Vn; v++) s += Math.exp(logits[o + v] - m);
    const z = m + Math.log(s);
    for (let v = 0; v < Vn; v++) out[o + v] = logits[o + v] - z;
  }
  return out;
}

// Greedy CTC decode → spikes with frame spans.
export function greedy(logp, T) {
  const out = [];
  let prev = BLANK;
  for (let t = 0; t < T; t++) {
    const o = t * V;
    let best = 0, bv = -Infinity;
    for (let v = 0; v < V; v++) if (logp[o + v] > bv) { bv = logp[o + v]; best = v; }
    if (best !== BLANK && best !== prev) out.push({ id: best, start: t, end: t });
    else if (best !== BLANK && best === prev && out.length) out[out.length - 1].end = t;
    prev = best;
  }
  return out;
}
function bestPathScore(logp, T) {
  let s = 0;
  for (let t = 0; t < T; t++) { const o = t * V; let m = -Infinity; for (let v = 0; v < V; v++) if (logp[o + v] > m) m = logp[o + v]; s += m; }
  return s;
}

// CTC forward log-likelihood of `seq` over frames [f0, f1).
export function ctcLL(logp, seq, f0, f1) {
  const n = f1 - f0;
  if (n <= 0) return NEG;
  const L = 2 * seq.length + 1;
  if (L === 1) { let s = 0; for (let t = f0; t < f1; t++) s += logp[t * V + BLANK]; return s; }
  const ext = new Int32Array(L);
  for (let k = 0; k < seq.length; k++) ext[2 * k + 1] = seq[k];
  let a = new Float64Array(L).fill(NEG), b = new Float64Array(L);
  a[0] = logp[f0 * V + BLANK];
  a[1] = logp[f0 * V + ext[1]];
  for (let t = f0 + 1; t < f1; t++) {
    const o = t * V;
    const lo = Math.max(0, L - 2 * (f1 - t));
    for (let s = 0; s < L; s++) {
      if (s < lo) { b[s] = NEG; continue; }
      let v = a[s];
      if (s >= 1) v = lse(v, a[s - 1]);
      if (s >= 2 && ext[s] !== BLANK && ext[s] !== ext[s - 2]) v = lse(v, a[s - 2]);
      b[s] = v === NEG ? NEG : v + logp[o + ext[s]];
    }
    const tmp = a; a = b; b = tmp;
  }
  return lse(a[L - 1], a[L - 2]);
}

// Viterbi forced alignment: emission frames for each token.
export function forcedAlign(logp, T, seq) {
  const N = seq.length, L = 2 * N + 1;
  let need = N;
  for (let k = 1; k < N; k++) if (seq[k] === seq[k - 1]) need++;
  if (!N || T < need) return null;
  const ext = new Int32Array(L);
  for (let k = 0; k < N; k++) ext[2 * k + 1] = seq[k];
  const bp = new Uint8Array(T * L);
  let a = new Float64Array(L).fill(NEG), b = new Float64Array(L);
  a[0] = logp[BLANK]; a[1] = logp[ext[1]];
  for (let t = 1; t < T; t++) {
    const o = t * V;
    for (let s = 0; s < L; s++) {
      let v = a[s], k = 0;
      if (s >= 1 && a[s - 1] > v) { v = a[s - 1]; k = 1; }
      if (s >= 2 && ext[s] !== BLANK && ext[s] !== ext[s - 2] && a[s - 2] > v) { v = a[s - 2]; k = 2; }
      b[s] = v === NEG ? NEG : v + logp[o + ext[s]];
      bp[t * L + s] = k;
    }
    const tmp = a; a = b; b = tmp;
  }
  let s = a[L - 1] >= a[L - 2] ? L - 1 : L - 2;
  const score = a[s];
  const spans = Array.from({ length: N }, () => ({ start: -1, end: -1 }));
  for (let t = T - 1; t >= 0; t--) {
    if (s & 1) { const k = (s - 1) >> 1; spans[k].start = t; if (spans[k].end < 0) spans[k].end = t; }
    s -= bp[t * L + s];
  }
  return { spans, score };
}

// How sure the model must be before calling a sound wrong (log-likelihood margin). Higher = more lenient.
let MARGIN = 0.75;
export function setStrictness(level) { MARGIN = { lenient: 2, standard: 0.75, strict: 0 }[level] ?? 0.75; }

const INSERT_VOWELS = ['ə', 'ɪ', 'ɛ', 'e', 'u', 'ʊ', 'ɨ', 'i', 'a', 'o'].map(t => ID[t]);
const sig = x => 1 / (1 + Math.exp(-x));

// words: [{text, phones:[tok], ids:[id], stress:[...] }]
export function scoreUtterance(logp, T, words) {
  const seq = [], tokOf = [], wordOf = [], posOf = [];
  words.forEach((w, wi) => w.ids.forEach((id, pi) => { seq.push(id); tokOf.push(w.phones[pi]); wordOf.push(wi); posOf.push(pi); }));
  const N = seq.length;
  const spikes = greedy(logp, T);
  if (spikes.length < 2) return { ok: false, reason: 'nospeech' };
  const fa = forcedAlign(logp, T, seq);
  if (!fa) return { ok: false, reason: 'short' };
  const al = fa.spans;
  const fit = (bestPathScore(logp, T) - fa.score) / T;

  const windowFor = (i0, i1) => {
    let f0 = i0 - 1 >= 0 ? al[i0 - 1].end + 1 : 0;
    let f1 = i1 + 1 < N ? al[i1 + 1].start : T;
    f0 = Math.max(f0, al[i0].start - 12);
    f1 = Math.min(f1, al[i1].end + 13);
    return [f0, Math.max(f1, f0 + 1)];
  };

  // Goodness of pronunciation for phone k. `ctx` gives the token to use for each neighbor
  // (canonical in pass 1, the pass-1 winner in pass 2) and vowels inserted next to k.
  const gopAt = (k, ctx, insBefore, insAfter) => {
    const i0 = Math.max(0, k - 1), i1 = Math.min(N - 1, k + 1);
    const [f0, f1] = windowFor(i0, i1);
    const left = [], right = [];
    if (i0 < k && ctx[i0] != null) left.push(ctx[i0]);
    if (insBefore != null) left.push(insBefore);
    if (insAfter != null) right.push(insAfter);
    if (i1 > k && ctx[i1] != null) right.push(ctx[i1]);
    const ll = id => ctcLL(logp, left.concat([id], right), f0, f1);
    const c = candidates(tokOf[k]);
    let okLL = NEG; for (const id of c.ok) okLL = lse(okLL, ll(id));
    let nearLL = NEG, nearId = -1;
    for (const id of c.near) { const v = ll(id); if (v > nearLL) { nearLL = v; nearId = id; } }
    let errLL = NEG, errId = -1;
    for (const id of c.err) { const v = ll(id); if (v > errLL) { errLL = v; errId = id; } }
    const delLL = ctcLL(logp, left.concat(right), f0, f1);
    if (delLL > errLL) { errLL = delLL; errId = -2; }
    const gErr = okLL - errLL + MARGIN, gNear = okLL - nearLL + MARGIN;
    let status = 'ok', heardId = null;
    if (gErr < 0 && errLL >= nearLL) { status = 'err'; heardId = errId; }
    else if (gNear < 0) { status = 'near'; heardId = nearId; }
    let score = 100 * sig(Math.min(gErr, gNear + 2.5) / 2.5);
    if (status === 'near') score = Math.max(42, Math.min(score, 68));
    return { status, heardId, score, gErr };
  };

  // Pass 1: canonical neighbors.
  const canon = seq.slice();
  const p1 = seq.map((_, k) => gopAt(k, canon, null, null));

  // Extra vowels: inside clusters, before initial s-clusters, after final consonants.
  const inserts = [];
  const isC = k => k >= 0 && k < N && !isVowel(tokOf[k]);
  for (let k = 0; k <= N; k++) {
    const left = k - 1, right = k;
    const sameWord = left >= 0 && right < N && wordOf[left] === wordOf[right];
    const wordStart = right < N && posOf[right] === 0;
    const wordEnd = left >= 0 && (right >= N || wordOf[right] !== wordOf[left]);
    let test = false;
    if (sameWord && isC(left) && isC(right)) test = true;
    else if (wordStart && tokOf[right] === 's' && isC(right + 1) && wordOf[right + 1] === wordOf[right]) test = true;
    else if (wordEnd && isC(left) && (right >= N || isC(right))) test = true;
    if (!test) continue;
    const i0 = Math.max(0, left), i1 = Math.min(N - 1, Math.max(right, 0));
    const [f0, f1] = windowFor(i0, i1);
    const base = seq.slice(i0, i1 + 1);
    const at = k - i0;
    const canon = ctcLL(logp, base, f0, f1);
    let best = NEG, bestId = -1;
    for (const v of INSERT_VOWELS) {
      const s = base.slice(0, at).concat([v], base.slice(at));
      const x = ctcLL(logp, s, f0, f1);
      if (x > best) { best = x; bestId = v; }
    }
    if (best - canon > 2 + MARGIN) inserts.push({ before: right < N ? right : null, after: left >= 0 ? left : null, word: wordOf[left >= 0 && !wordStart ? left : right], tok: VOCAB[bestId], show: show(VOCAB[bestId]), margin: +(best - canon).toFixed(2) });
  }


  // Pass 2: re-score each phone with neighbors as the learner actually said them,
  // so one mispronounced sound does not drag down the sounds next to it.
  const said = p1.map((r, k) => r.status === 'ok' ? seq[k] : r.heardId === -2 ? null : r.heardId);
  const insAt = new Map();
  for (const x of inserts) { if (x.before != null) insAt.set('b' + x.before, ID[x.tok]); if (x.after != null) insAt.set('a' + x.after, ID[x.tok]); }
  const phones = [];
  for (let k = 0; k < N; k++) {
    const r = gopAt(k, said, insAt.get('b' + k) ?? null, insAt.get('a' + k) ?? null);
    const heard = r.heardId == null ? null : r.heardId === -2 ? '∅' : VOCAB[r.heardId];
    phones.push({
      k, tok: tokOf[k], show: show(tokOf[k]), unit: UNIT[tokOf[k]] || null, vowel: isVowel(tokOf[k]),
      word: wordOf[k], pos: posOf[k], stress: words[wordOf[k]].stress[posOf[k]] || 0,
      start: al[k].start, end: al[k].end, score: Math.round(r.score), status: r.status, heard,
      heardShow: heard === '∅' ? '∅' : heard ? show(heard) : null, gop: +r.gErr.toFixed(2)
    });
  }

  // Word results.
  const wres = words.map((w, wi) => {
    const ph = phones.filter(p => p.word === wi);
    const ins = inserts.filter(x => x.word === wi);
    const s0 = ph[0].start, s1 = ph[ph.length - 1].end;
    const heardToks = spikes.filter(sp => sp.start >= s0 - 2 && sp.start <= s1 + 2).map(sp => VOCAB[sp.id]);
    let score = ph.reduce((a, p) => a + p.score, 0) / ph.length;
    score = Math.max(0, score - 12 * ins.length);
    return {
      text: w.text, phones: ph, inserts: ins, score: Math.round(score),
      start: Math.max(0, s0 * FRAME_SEC - 0.04), end: (s1 + 1) * FRAME_SEC + 0.06,
      heard: heardToks.map(show).join(''), expected: w.phones.map(show).join('')
    };
  });

  // Fluency: pauses between words, articulation rate.
  const pauses = [];
  for (let i = 1; i < wres.length; i++) {
    const gap = wres[i].phones[0].start - wres[i - 1].phones[wres[i - 1].phones.length - 1].end;
    if (gap * FRAME_SEC > 0.32) pauses.push({ after: i - 1, sec: +(gap * FRAME_SEC).toFixed(2) });
  }
  const speechSec = (al[N - 1].end - al[0].start + 1) * FRAME_SEC;
  const pauseSec = pauses.reduce((a, p) => a + p.sec, 0);
  const sylls = phones.filter(p => p.vowel).length;
  const score = Math.round(wres.reduce((a, w) => a + w.score, 0) / wres.length);
  return {
    ok: true, score, words: wres, phones, inserts, pauses, fit: +fit.toFixed(3),
    poorFit: fit > 1.6, speechSec: +speechSec.toFixed(2),
    syllPerSec: +(sylls / Math.max(0.3, speechSec - pauseSec)).toFixed(2),
    heardAll: spikes.map(s => show(VOCAB[s.id])).join(' ')
  };
}

// What to tell the learner about one phone result.
export function describePhone(p) {
  if (p.status === 'ok') return null;
  if (p.heard === '∅') return `/${p.show}/ was dropped`;
  const name = HEARD_NAME[p.heard];
  return name ? `/${p.show}/ sounded like ${name}` : `/${p.show}/ sounded like /${p.heardShow}/`;
}

// Test helper and demo mode: posteriors for a spoken token sequence (with optional substitutions).
export function synthPosteriors(tokens, { framesPer = 4, lead = 6, tail = 6, sharp = 0.97, seed = 7 } = {}) {
  let r = seed;
  const rnd = () => ((r = (r * 1103515245 + 12345) >>> 0) / 4294967296);
  const T = lead + tokens.length * framesPer + tail;
  const logits = new Float32Array(T * V).fill(-6);
  for (let t = 0; t < T; t++) {
    for (let v = 0; v < V; v++) logits[t * V + v] = -6 - 3 * rnd();
    logits[t * V + BLANK] = 4;
  }
  tokens.forEach((tok, i) => {
    const id = typeof tok === 'number' ? tok : ID[tok];
    const t = lead + i * framesPer + 1;
    logits[t * V + id] = 8; logits[t * V + BLANK] = 8 - 8 * sharp;
  });
  return { logp: logSoftmax(logits, T), T };
}
