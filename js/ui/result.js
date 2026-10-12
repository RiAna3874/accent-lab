// Feedback for one recorded attempt: overall score, every word and sound, melody, stress, pace, playback, coach.
import { h, icon, svgBox, esc, clamp, grade, toast } from './dom.js';
import { UMAP } from '../data/sounds.js';
import { describePhone, FRAME_SEC } from '../engine/scoring.js';
import { HEARD_NAME, UNIT } from '../engine/phones.js';
import { playClip, stopPlayback, pitchContour } from '../engine/audio.js';
import { tts, speakAsync } from '../engine/speech.js';
import { store } from '../store.js';
import { coachReady, explainAttempt } from '../coach.js';

const narrow = () => window.innerWidth < 620;
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const cleanWord = w => w.replace(/^[^\w’']+|[^\w’']+$/g, '');

// Target melody aligned to the speaker's real vowel timings.
function targetPoints(res, tune) {
  const vs = res.phones.filter(p => p.vowel);
  if (vs.length < 2) return null;
  const t0 = vs[0].start, t1 = vs[vs.length - 1].end || t0 + 1, span = Math.max(1, t1 - t0);
  let nucleus = -1; vs.forEach((p, i) => { if (p.stress === 1) nucleus = i; });
  let firstStress = true;
  const pts = vs.map((p, i) => {
    const u = ((p.start + p.end) / 2 - t0) / span;
    let v = 1.4 - 2.8 * u;
    if (p.stress === 1) { v += firstStress ? 3.2 : 2.4; firstStress = false; } else if (p.stress === 2) v += 1; else if (['ə', 'ɐ', 'ᵻ', 'ɚ'].includes(p.tok)) v -= 0.8;
    if (i === nucleus) v = tune === 'rise' ? v - 2.4 : v + 1.4;
    if (nucleus >= 0 && i > nucleus) { const k = (u - ((vs[nucleus].start + vs[nucleus].end) / 2 - t0) / span) / Math.max(0.05, 1 - ((vs[nucleus].start + vs[nucleus].end) / 2 - t0) / span); v = tune === 'rise' ? -1 + 6 * k : 2 - 6.5 * k; }
    return { t: ((p.start + p.end) / 2) * FRAME_SEC, v };
  });
  const last = pts[pts.length - 1];
  pts.push({ t: (vs[vs.length - 1].end + 6) * FRAME_SEC, v: tune === 'rise' ? Math.max(last.v + 2, 5) : Math.min(last.v - 1.5, -4) });
  const m = avg(pts.map(p => p.v));
  return pts.map(p => ({ t: p.t, v: p.v - m }));
}
const interp = (pts, t) => { if (t <= pts[0].t) return pts[0].v; for (let i = 0; i < pts.length - 1; i++) if (t <= pts[i + 1].t) { const k = (t - pts[i].t) / ((pts[i + 1].t - pts[i].t) || 1); return pts[i].v + (pts[i + 1].v - pts[i].v) * k; } return pts[pts.length - 1].v; };
function melodyScore(a) {
  const m = a.melody; if (!m || !m.ok) return null;
  const tgt = a.kind === 'phones' ? targetPoints(a.res, a.tune) : null;
  let r = null;
  if (tgt && m.pc.pts.length > 8) {
    const u = m.pc.pts.filter(p => p.t >= tgt[0].t - 0.1 && p.t <= tgt[tgt.length - 1].t + 0.1);
    if (u.length > 8) {
      const mu = avg(u.map(p => p.st));
      const xs = u.map(p => p.st - mu), ys = u.map(p => interp(tgt, p.t));
      const mx = avg(xs), my = avg(ys); let sxy = 0, sxx = 0, syy = 0;
      xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; });
      r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
    }
  }
  const tuneOk = m.finalDir === a.tune || (a.tune === 'fall' && m.finalDir === 'fall');
  const score = Math.round(100 * ((r == null ? 0.35 : 0.6 * clamp((r + 0.1) / 0.8, 0, 1)) + 0.25 * clamp(m.range / 6, 0, 1) + 0.15 * (tuneOk ? 1 : 0) + (r == null ? 0.25 : 0)));
  return { score: clamp(score, 0, 100), r, tuneOk, tgt };
}

function pitchChart(a, ms) {
  const m = a.melody; const W = narrow() ? 380 : 660, H = 210, L = 34, R = 10, T = 12, B = 44;
  const pts = m.pc.pts; if (!pts.length) return null;
  const words = a.kind === 'phones' ? a.res.words : [];
  const t0 = Math.min(pts[0].t, words[0] ? words[0].start : Infinity) - 0.05;
  const t1 = Math.max(pts[pts.length - 1].t, words.length ? words[words.length - 1].end : 0) + 0.05;
  const X = t => L + (t - t0) / ((t1 - t0) || 1) * (W - L - R), Y = s => T + (8 - clamp(s, -8, 8)) / 16 * (H - T - B);
  let g = '';
  words.forEach((w, i) => { if (i % 2 === 0) g += `<rect class="wspan" x="${X(w.start).toFixed(1)}" y="${T}" width="${Math.max(1, X(w.end) - X(w.start)).toFixed(1)}" height="${H - T - B}"/>`; });
  for (const s of [-8, -4, 0, 4, 8]) g += `<line class="grid${s === 0 ? ' zero' : ''}" x1="${L}" x2="${W - R}" y1="${Y(s).toFixed(1)}" y2="${Y(s).toFixed(1)}"/><text class="axis" x="${L - 6}" y="${(Y(s) + 3.5).toFixed(1)}" text-anchor="end">${s > 0 ? '+' : ''}${s}</text>`;
  if (ms && ms.tgt) {
    const tg = ms.tgt; const up = [], dn = [];
    for (let t = tg[0].t; t <= tg[tg.length - 1].t; t += 0.03) { up.push(`${X(t).toFixed(1)},${Y(interp(tg, t) + 1.6).toFixed(1)}`); dn.unshift(`${X(t).toFixed(1)},${Y(interp(tg, t) - 1.6).toFixed(1)}`); }
    g += `<polygon class="band" points="${up.concat(dn).join(' ')}"/>`;
    g += `<polyline class="tline" points="${tg.map(p => `${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')}"/>`;
  }
  const mu = avg(pts.map(p => p.st)); let d = '', prev = null;
  for (const p of pts) { d += (prev == null || p.t - prev > 0.08 ? 'M' : 'L') + X(p.t).toFixed(1) + ' ' + Y(p.st - mu).toFixed(1) + ' '; prev = p.t; }
  g += `<path class="uline" d="${d}"/>`;
  let lastX = -99, row = 0;
  words.forEach(w => { const x = X((w.start + w.end) / 2); row = x - lastX < (narrow() ? 46 : 54) ? 1 - row : 0; lastX = x; g += `<text class="wlabel" x="${x.toFixed(1)}" y="${H - B + 17 + row * 15}" text-anchor="middle">${esc(cleanWord(w.text))}</text>`; });
  g += `<text class="axis" x="${L}" y="${T - 2}">semitones</text>`;
  return svgBox(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Your pitch compared with a typical American melody for this sentence">${g}</svg>`);
}

// Group sound problems by sound for the summary list.
export function issueList(res) {
  const by = new Map();
  for (const w of res.words) {
    for (const p of w.phones) if (p.status !== 'ok') {
      const key = p.unit || p.tok;
      const e = by.get(key) || { unit: p.unit, show: p.show, n: 0, err: 0, heard: new Map(), words: new Set() };
      e.n++; if (p.status === 'err') e.err++; e.heard.set(p.heard, (e.heard.get(p.heard) || 0) + 1); e.words.add(cleanWord(w.text));
      by.set(key, e);
    }
    for (const x of w.inserts) {
      const e = by.get('ins') || { unit: null, show: '+ə', n: 0, err: 0, heard: new Map(), words: new Set(), ins: true };
      e.n++; e.err++; e.words.add(cleanWord(w.text)); by.set('ins', e);
    }
  }
  return [...by.values()].sort((a, b) => (b.err * 2 + b.n) - (a.err * 2 + a.n));
}
function issueText(e) {
  if (e.ins) return { head: 'Extra vowel between consonants', body: 'Keep consonant clusters together with no vowel in between or in front: “sport”, not “esport”; “bag”, not “bag-uh”.' };
  const top = [...e.heard.entries()].sort((a, b) => b[1] - a[1])[0];
  const heard = top && top[0];
  const u = e.unit && UMAP[e.unit];
  const head = heard === '∅' ? `/${e.show}/ was dropped` : `/${e.show}/ sounded like ${HEARD_NAME[heard] || '/' + (heard ? (UMAP[UNIT[heard]] ? UMAP[UNIT[heard]].ipa : heard) : '?') + '/'}`;
  const l1 = store.profile.l1;
  const body = u ? ((u.slip && u.slip[l1]) || u.how[0]) : '';
  return { head, body };
}

export function resultView(a, { onUnit, modelRate } = {}) {
  const wrap = h('div', { class: 'results' });
  const clip = a.clip;
  const playYou = (from, to) => playClip(clip, from, to);
  const model = (rate) => speakAsync(a.text, { rate: rate || modelRate || tts.rate });

  if (a.kind === 'none') {
    const why = a.reason === 'nospeech' ? 'No speech came through. Check the microphone level in Settings and try again.' : a.reason === 'short' ? 'That recording was too short for this sentence. Read the whole line.' : (a.error || 'This browser can’t score speech yet. Turn on sound-by-sound scoring, or use Chrome, Edge or Safari for word checking.');
    wrap.append(h('div', { class: 'verdict warn' }, h('span', { class: 'vh' }, 'Couldn’t score this take'), h('p', {}, why), playbackRow(model, clip ? () => playYou() : null)));
    return wrap;
  }

  const ms = melodyScore(a);
  const stressList = (a.stress || []).filter(s => !s.ok && s.confident);
  const stressScore = a.stress && a.stress.length ? Math.round(100 * a.stress.filter(s => s.ok).length / a.stress.length) : null;
  const pace = a.kind === 'phones' ? a.res.syllPerSec : null;
  const soundScore = a.kind === 'phones' ? a.res.score : a.words.pct;
  const issues = a.kind === 'phones' ? issueList(a.res) : [];

  // Header
  const g = grade(soundScore);
  const nWords = a.kind === 'phones' ? a.res.words.length : a.words.status.length;
  const clear = a.kind === 'phones' ? a.res.words.filter(w => w.score >= 80).length : a.words.status.filter(s => s.s === 'ok').length;
  const headline = a.kind === 'phones'
    ? (issues.length ? `${clear} of ${nWords} words clear. Work on ${issues.slice(0, 2).map(e => e.ins ? 'extra vowels' : '/' + e.show + '/').join(' and ')}.` : `${clear} of ${nWords} words clear. Every sound landed.`)
    : `${clear} of ${nWords} words recognized as written.`;
  const tiles = h('div', { class: 'scores' },
    tile(a.kind === 'phones' ? 'Sounds' : 'Words', soundScore, '%', a.kind === 'phones' ? 'each sound checked' : 'speech recognizer'),
    tile('Melody', ms ? ms.score : null, '/100', ms ? (ms.tuneOk ? (a.tune === 'rise' ? 'rises at the end' : 'falls at the end') : (a.tune === 'rise' ? 'should rise at the end' : 'should fall at the end')) : 'not enough voice'),
    stressScore != null ? tile('Word stress', stressScore, '%', `${a.stress.filter(s => s.ok).length} of ${a.stress.length} long words`) : null,
    pace != null ? tile('Pace', +pace.toFixed(1), 'syl/s', pace < 3 ? 'slow; link words' : pace > 6.2 ? 'fast; slow down' : 'natural', pace < 3 || pace > 6.2 ? 'warn' : 'good') : null);
  wrap.append(h('div', { class: 'scorehead' }, h('div', { class: 'ring ' + g, style: { '--p': soundScore } }, h('span', {}, soundScore)), h('div', { class: 'stack tight' }, h('h3', {}, headline), a.kind === 'words' ? h('p', { class: 'fine' }, 'Heard: “' + a.heard + '”. Sound-by-sound scoring is off, so only whole words were checked.') : null)), tiles);

  // Words and sounds
  if (a.kind === 'phones') {
    const detail = h('div', { class: 'wdetail', hidden: true });
    const line = h('div', { class: 'wordline', role: 'group', 'aria-label': 'Words. Select one to see each sound.' });
    a.res.words.forEach((w, wi) => {
      const ph = h('span', { class: 'ph', 'aria-hidden': 'true' });
      w.phones.forEach(p => {
        for (const x of w.inserts) if (x.before === p.k) ph.append(h('i', { class: 'ins' }, x.show));
        ph.append(h('i', { class: grade(p.score) }, p.show));
        for (const x of w.inserts) if (x.after === p.k && x.before == null) ph.append(h('i', { class: 'ins' }, x.show));
      });
      const b = h('button', { class: 'wtok', type: 'button', 'aria-pressed': 'false', 'aria-label': `${cleanWord(w.text)}, ${w.score} percent` }, h('span', { class: 'wt ' + grade(w.score) }, cleanWord(w.text)), ph);
      b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') !== 'true';
        line.querySelectorAll('.wtok').forEach(x => x.setAttribute('aria-pressed', 'false'));
        if (!on) { detail.hidden = true; return; }
        b.setAttribute('aria-pressed', 'true'); detail.hidden = false;
        detail.replaceChildren(wordDetail(w, playYou));
      });
      line.append(b);
    });
    wrap.append(h('div', { class: 'stack tight' }, h('span', { class: 'eyebrow' }, 'Each word and sound · tap a word'), line, detail));
  } else {
    wrap.append(h('div', { class: 'pills' }, a.words.status.map((s, i) => h('span', { class: 'pill ' + (s.s === 'ok' ? 'g-good' : s.s === 'sub' ? 'g-warn' : 'g-bad') }, cleanWord(a.text.split(/\s+/)[i] || ''), s.heard.length ? ' → ' + s.heard.join(' ') : ''))));
  }

  // What to fix
  if (issues.length) {
    wrap.append(h('div', { class: 'stack tight' }, h('span', { class: 'eyebrow' }, 'What to fix first'),
      h('div', { class: 'issues' }, issues.slice(0, 4).map(e => {
        const t = issueText(e);
        return h('div', { class: 'issue' }, h('span', { class: 'is' }, e.ins ? '+ə' : '/' + e.show + '/'),
          h('div', { class: 'it' }, h('b', {}, t.head), ` in ${[...e.words].slice(0, 3).map(w => '“' + w + '”').join(', ')}. `, h('span', { class: 'muted' }, t.body)),
          e.unit && onUnit && UMAP[e.unit] ? h('button', { class: 'btn', type: 'button', onclick: () => onUnit(e.unit) }, 'Practice') : h('span'));
      }))));
  }

  // Melody and stress
  if (a.melody && a.melody.ok) {
    const chart = pitchChart(a, ms);
    const tuneNote = ms && !ms.tuneOk ? (a.tune === 'rise' ? 'This is a yes/no question: let your voice climb on the last word.' : 'Statements and wh-questions fall: step down on the last stressed word and let it fade.') : null;
    const flat = a.melody.range < 4 ? `Your pitch moved within ${a.melody.range} semitones. American speech uses more: lift stressed words higher and let small words drop.` : null;
    wrap.append(h('div', { class: 'stack tight' }, h('div', { class: 'row between' }, h('span', { class: 'eyebrow' }, 'Melody'), h('div', { class: 'key' }, h('span', {}, h('i', {}), 'your pitch'), ms && ms.tgt ? h('span', {}, h('i', { class: 't' }), 'typical American shape') : null)),
      chart, (tuneNote || flat) ? h('ul', { class: 'tips' }, tuneNote ? h('li', {}, tuneNote) : null, flat ? h('li', {}, flat) : null) : null));
  }
  if (stressList.length) {
    wrap.append(h('div', { class: 'stack tight' }, h('span', { class: 'eyebrow' }, 'Word stress'),
      h('ul', { class: 'tips' }, stressList.map(s => h('li', {}, h('b', {}, cleanWord(s.text)), `: the strongest syllable was the one with /${s.vowels[s.actual]}/. Put the beat on /${s.vowels[s.expected]}/: louder, longer and higher.`)))));
  }
  if (a.kind === 'phones' && a.res.pauses.length) {
    wrap.append(h('p', { class: 'fine' }, `Pauses after ${a.res.pauses.map(p => '“' + cleanWord(a.res.words[p.after].text) + '” (' + p.sec.toFixed(1) + ' s)').join(', ')}. Pause between thought groups, not inside them.`));
  }

  // Playback
  wrap.append(playbackRow(model, () => playYou(), () => model(0.7)));

  // Coach
  if (a.kind === 'phones') {
    const out = h('div', { class: 'coachout' });
    const btn = h('button', { class: 'btn', type: 'button' }, icon('spark'), 'Ask the coach about this take');
    btn.addEventListener('click', async () => {
      if (!coachReady()) { window.dispatchEvent(new CustomEvent('al:coachsetup')); return; }
      btn.disabled = true; out.textContent = 'Thinking…';
      try {
        out.textContent = await explainAttempt(a.text, a.res, {
          melody: ms ? `final direction ${a.melody.finalDir} (expected ${a.tune}), pitch range ${a.melody.range} semitones` : '',
          stress: stressList.map(s => `${cleanWord(s.text)}: strongest on /${s.vowels[s.actual]}/, expected /${s.vowels[s.expected]}/`).join('; ')
        });
      } catch (e) { out.textContent = e.message === 'no_coach' ? '' : 'The coach couldn’t answer: ' + e.message; }
      btn.disabled = false;
    });
    wrap.append(h('div', { class: 'stack tight' }, h('div', {}, btn), out));
    wrap.append(h('p', { class: 'fine' }, `Scored on this device by a phoneme recognizer${a.ms ? ` in ${(a.ms / 1000).toFixed(1)} s` : ''}. It judges sounds, not meaning, and can be wrong on single sounds; trust patterns that repeat across takes.`));
  }
  return wrap;
}

function tile(label, val, unit, note, cls) {
  return h('div', { class: 'score ' + (cls || grade(val)) }, h('span', { class: 'eyebrow' }, label), h('span', { class: 'num' }, val == null ? '—' : val, val == null ? null : h('small', {}, unit)), h('span', { class: 'note2' }, note));
}
export function playbackRow(model, you, slow) {
  return h('div', { class: 'row' },
    h('button', { class: 'btn', type: 'button', onclick: () => { stopPlayback(); model(); } }, icon('play'), 'Model'),
    slow ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { stopPlayback(); slow(); } }, icon('slow'), 'Slow') : null,
    you ? h('button', { class: 'btn voice', type: 'button', onclick: () => { tts.stop(); you(); } }, icon('person'), 'You') : null,
    you ? h('button', { class: 'btn ghost', type: 'button', onclick: async () => { stopPlayback(); await model(); await you(); } }, 'Model, then you') : null);
}
function wordDetail(w, playYou) {
  const cells = h('div', { class: 'phtable' }, w.phones.map(p => {
    const d = describePhone(p);
    return h('div', { class: 'phcell ' + grade(p.score), title: d || 'Clear' }, h('span', { class: 's' }, p.show), h('span', { class: 'n' }, p.score), h('span', { class: 'h' }, p.status === 'ok' ? 'clear' : p.heard === '∅' ? 'dropped' : '→ ' + (HEARD_NAME[p.heard] ? p.heardShow : '/' + p.heardShow + '/')));
  }));
  const ins = w.inserts.length ? h('p', { class: 'fine' }, `Extra vowel /${w.inserts.map(x => x.show).join(', ')}/ detected. Keep the consonants together.`) : null;
  const notes = w.phones.map(describePhone).filter(Boolean);
  return h('div', { class: 'stack tight' },
    h('div', { class: 'row between' }, h('div', {}, h('b', { style: { fontSize: '18px' } }, cleanWord(w.text)), h('span', { class: 'muted ipa', style: { marginLeft: '10px', fontSize: '17px' } }, `expected /${w.expected}/ · heard /${w.heard || '–'}/`)),
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => tts.speak(cleanWord(w.text), { rate: 0.8 }) }, icon('play'), 'Model'), h('button', { class: 'btn voice', type: 'button', onclick: () => playYou(w.start, w.end) }, icon('person'), 'You'))),
    cells, ins, notes.length ? h('ul', { class: 'tips' }, notes.map(n => h('li', {}, n))) : null);
}
