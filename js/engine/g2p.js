// Text → expected American English phones (espeak-ng en-us), segmented into model tokens.
import { EN_SEG, SPLIT_BEFORE_VOWEL, VOWEL_START, ID } from './phones.js';

let _phonemize = null;
async function engine() {
  if (!_phonemize) _phonemize = import(new URL('../../vendor/phonemizer.js', import.meta.url).href).then(m => m.phonemize);
  return _phonemize;
}
const SORTED = [...EN_SEG].sort((a, b) => b.length - a.length);

// Split an espeak IPA word (stress marks kept) into tokens with stress levels.
export function segment(ipa) {
  const toks = [], stress = [];
  let pending = 0, i = 0;
  const s = ipa.replace(/[ˑ‿]/g, '');
  while (i < s.length) {
    const c = s[i];
    if (c === 'ˈ') { pending = 1; i++; continue; }
    if (c === 'ˌ') { pending = Math.max(pending, 0) || 2; i++; continue; }
    if (c === ' ' || c === '-' ) { i++; continue; }
    let m = null;
    for (const t of SORTED) if (s.startsWith(t, i)) { m = t; break; }
    if (!m) { i++; continue; }            // unknown symbol: skip it
    const after = s.slice(i + m.length).replace(/^[ˈˌ]/, '');
    if (SPLIT_BEFORE_VOWEL[m] && after && (VOWEL_START.has(after[0]) || after[0] === 'ɹ')) {
      const [a, b] = SPLIT_BEFORE_VOWEL[m];
      toks.push(a); stress.push(pending); pending = 0;
      i += a.length; continue;             // b is re-read on the next pass
    }
    toks.push(m);
    stress.push(/[aeiouɪɛæɑɔʊʌəɚɜᵻɐɒ]/.test(m[0]) || m === 'n̩' ? pending : 0);
    if (stress[stress.length - 1]) pending = 0;
    i += m.length;
  }
  return { toks, stress };
}

const cache = new Map();
const clean = w => w.replace(/[“”"()\[\]{}!?.,;:…]+/g, '').replace(/[’]/g, "'").trim();

// Split display text into words (keeps punctuation for display).
export function splitWords(text) {
  return String(text).trim().split(/\s+/).filter(Boolean).filter(w => clean(w).length);
}

const ed = (a, b) => {
  const n = a.length, m = b.length; if (!n) return m; if (!m) return n;
  let prev = Array.from({ length: m + 1 }, (_, j) => j), cur = new Array(m + 1);
  for (let i = 1; i <= n; i++) { cur[0] = i; for (let j = 1; j <= m; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); [prev, cur] = [cur, prev]; }
  return prev[m];
};
const citeCache = new Map();
async function citation(phonemize, w) {
  if (!citeCache.has(w)) { let ipa = ''; try { ipa = (await phonemize(w, 'en-us')).join('').replace(/\s+/g, ''); } catch (e) {} citeCache.set(w, ipa); }
  return citeCache.get(w);
}
// espeak sometimes merges words ("of the" → ʌvðə) or splits them ("30%"). Map its sentence output back
// onto the input words with a small alignment, so weak forms and sentence stress survive.
function mapGroups(O, C) {
  const n = C.length, m = O.length, INF = 1e9;
  const f = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF)), bk = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(null));
  f[0][0] = 0;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
    if (f[i][j] >= INF) continue;
    for (let a = 1; a <= 3 && i + a <= n; a++) for (let b = 1; b <= 3 && j + b <= m; b++) {
      if (a > 1 && b > 1) continue;
      const cc = C.slice(i, i + a).flatMap(x => x.toks), oo = O.slice(j, j + b).flatMap(x => x.toks);
      const cost = f[i][j] + ed(cc, oo) + (a + b - 2) * 0.5;
      if (cost < f[i + a][j + b]) { f[i + a][j + b] = cost; bk[i + a][j + b] = [a, b]; }
    }
  }
  if (f[n][m] >= INF) return null;
  const groups = []; let i = n, j = m;
  while (i > 0) { const [a, b] = bk[i][j]; groups.unshift({ i: i - a, a, j: j - b, b }); i -= a; j -= b; }
  const res = new Array(n);
  for (const g of groups) {
    const toks = O.slice(g.j, g.j + g.b).flatMap(x => x.toks), stress = O.slice(g.j, g.j + g.b).flatMap(x => x.stress);
    if (g.a === 1) { res[g.i] = { toks, stress }; continue; }
    // Split one espeak word across several input words at the cut points that best match citation forms.
    const parts = C.slice(g.i, g.i + g.a);
    let best = null;
    const rec = (k, from, cuts, cost) => {
      if (k === parts.length - 1) { const c = cost + ed(toks.slice(from), parts[k].toks); if (!best || c < best.c) best = { c, cuts: [...cuts, toks.length] }; return; }
      for (let e = from + 1; e <= toks.length - (parts.length - 1 - k); e++) rec(k + 1, e, [...cuts, e], cost + ed(toks.slice(from, e), parts[k].toks));
    };
    rec(0, 0, [], 0);
    let from = 0;
    best.cuts.forEach((e, k) => { res[g.i + k] = { toks: toks.slice(from, e), stress: stress.slice(from, e) }; from = e; });
  }
  return res;
}

// Returns [{text, phones:[tok], ids:[id], stress:[0|1|2]}], keeping weak forms and sentence stress.
export async function toPhones(text) {
  const key = text.trim();
  if (cache.has(key)) return cache.get(key);
  const phonemize = await engine();
  const words = splitWords(text);
  const norm = words.map(clean);
  let segs = null;
  try {
    const out = (await phonemize(norm.join(' '), 'en-us')).join(' ').trim().split(/\s+/).filter(Boolean);
    const O = out.map(segment);
    if (O.length === words.length) segs = O;
    else {
      const C = [];
      for (const w of norm) C.push(segment(await citation(phonemize, w)));
      segs = mapGroups(O, C) || C;
    }
  } catch (e) { segs = null; }
  if (!segs) { segs = []; for (const w of norm) segs.push(segment(await citation(phonemize, w))); }
  const res = words.map((w, i) => {
    const { toks, stress } = segs[i] || { toks: [], stress: [] };
    return { text: w, phones: toks, ids: toks.map(t => ID[t]), stress };
  }).filter(w => w.phones.length);
  cache.set(key, res);
  return res;
}
