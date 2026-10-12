// Word stress and sentence melody from the phone alignment plus pitch/energy frames.
import { FRAME_SEC } from './scoring.js';
import { pitchContour } from './audio.js';

const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const z = a => { const m = mean(a), s = Math.sqrt(mean(a.map(v => (v - m) ** 2))) || 1; return a.map(v => (v - m) / s); };

// For each multi-syllable word: which vowel was most prominent vs. which should be.
export function wordStress(res, clip) {
  if (!res || !res.ok) return [];
  const all = res.phones, frames = clip.frames, pc = pitchContour(frames);
  const stAt = (a, b) => { const p = pc.pts.filter(q => q.t >= a && q.t <= b); return p.length ? Math.max(...p.map(q => q.st)) : null; };
  const out = [];
  res.words.forEach((w, wi) => {
    const vs = w.phones.filter(p => p.vowel && p.tok !== 'əl' && p.tok !== 'n̩');
    const expected = vs.findIndex(p => p.stress === 1);
    if (vs.length < 2 || expected < 0) return;
    const feats = vs.map(p => {
      const prev = all[p.k - 1], next = all[p.k + 1];
      const a = (prev ? (prev.end + p.start) / 2 : p.start - 3) * FRAME_SEC;
      const b = (next ? (p.end + next.start) / 2 : p.end + 4) * FRAME_SEC + FRAME_SEC;
      const fr = frames.filter(f => f.t >= a && f.t <= b);
      return { db: fr.length ? Math.max(...fr.map(f => f.db)) : -80, st: stAt(a, b), dur: b - a };
    });
    const haveSt = feats.every(f => f.st != null);
    const zd = z(feats.map(f => f.db)), zl = z(feats.map(f => f.dur)), zs = haveSt ? z(feats.map(f => f.st)) : feats.map(() => 0);
    const prom = feats.map((_, i) => 0.4 * zd[i] + (haveSt ? 0.35 : 0) * zs[i] + 0.25 * zl[i]);
    let actual = 0; prom.forEach((v, i) => { if (v > prom[actual]) actual = i; });
    const margin = prom[actual] - Math.max(...prom.filter((_, i) => i !== actual));
    out.push({ word: wi, text: w.text, expected, actual, ok: actual === expected, confident: margin > 0.35, vowels: vs.map(p => p.show) });
  });
  return out;
}

// Sentence melody: pitch range, final direction, and the most prominent word.
export function melody(res, clip) {
  const pc = pitchContour(clip.frames);
  if (pc.pts.length < 8) return { ok: false, pc };
  let finalDir = 'level';
  if (res && res.ok && res.words.length) {
    const last = res.words[res.words.length - 1];
    const lastStressed = [...res.words].reverse().find(w => w.phones.some(p => p.stress === 1)) || last;
    const t0 = lastStressed.start, t1 = last.end + 0.15;
    const seg = pc.pts.filter(p => p.t >= t0 && p.t <= t1);
    if (seg.length >= 6) {
      const k = Math.max(2, Math.floor(seg.length * 0.35));
      const head = mean(seg.slice(0, k).map(p => p.st)), tail = mean(seg.slice(-k).map(p => p.st));
      const peak = Math.max(...seg.map(p => p.st));
      const d = tail - Math.max(head, peak - 1.5);
      finalDir = tail - head > 1.5 ? 'rise' : (peak - tail > 2 || d < -1.5) ? 'fall' : 'level';
    }
  }
  let peakWord = -1;
  if (res && res.ok) {
    let best = -Infinity;
    res.words.forEach((w, i) => { const p = pc.pts.filter(q => q.t >= w.start && q.t <= w.end); if (p.length) { const m = Math.max(...p.map(q => q.st)); if (m > best) { best = m; peakWord = i; } } });
  }
  return { ok: true, pc, range: +pc.range.toFixed(1), finalDir, peakWord };
}

// Expected melody for a sentence: 'rise' for yes/no questions, otherwise 'fall'.
const AUX = new Set('do does did is are was were can could will would should have has had may might am shall is isnt arent dont doesnt didnt wont cant couldnt wouldnt shouldnt'.split(' '));
export function expectedTune(text) {
  const t = text.trim();
  if (!/\?\s*$/.test(t)) return 'fall';
  const first = t.toLowerCase().replace(/[^a-z' ]/g, '').replace(/'/g, '').split(/\s+/)[0] || '';
  if (/\bor\b/i.test(t)) return 'fall';
  return AUX.has(first) ? 'rise' : 'fall';
}
