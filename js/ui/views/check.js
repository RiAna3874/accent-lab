import { h, icon, grade } from '../dom.js';
import { CHECK } from '../../data/practice.js';
import { UMAP, UNITS } from '../../data/sounds.js';
import { store, save, recordPhones, addCheck, logDay, addHist, fill } from '../../store.js';
import * as model from '../../engine/model.js';
import { tts } from '../../engine/speech.js';
import { recorderUI, assess, speakSentence, stopActive } from '../recorder.js';
import { engineCard } from '../engine-card.js';
import { issueList } from '../result.js';

export function check(go) {
  const el = h('div', { class: 'stack', style: { maxWidth: '860px' } });
  const takes = [];
  let i = -1;
  const intro = () => {
    el.replaceChildren(
      h('div', { class: 'stack tight prose' }, h('span', { class: 'eyebrow' }, 'Accent check'), h('h2', {}, 'Read 12 sentences. Get a map of every sound.'),
        h('p', { class: 'muted' }, 'Find a quiet spot and read each line the way you normally speak. Don’t listen to the model first: the check measures your natural accent. It takes about three minutes.')),
      engineCard(),
      h('div', { class: 'row' }, h('button', { class: 'btn primary lg', type: 'button', onclick: () => { if (!model.ready()) { el.querySelector('.panel').scrollIntoView({ behavior: 'smooth' }); return; } i = 0; step(); } }, 'Start', icon('next')),
        h('span', { class: 'fine' }, 'Needs sound-by-sound scoring. Retake it every few weeks to see what changed.')));
  };
  const step = () => {
    stopActive();
    const text = fill(CHECK[i]);
    const disp = h('p', { class: 'sent' }, ...text.split(/\s+/).flatMap((w, k, a) => [h('span', { class: 'w' }, w), k < a.length - 1 ? ' ' : null]));
    const fb = h('div', {});
    const nextBtn = h('button', { class: 'btn primary', type: 'button', hidden: true, onclick: () => { i++; i < CHECK.length ? step() : finish(); } }, i < CHECK.length - 1 ? 'Next sentence' : 'See my results', icon('next'));
    const rec = recorderUI({ label: 'Tap the mic and read the sentence', onDone: async (clip, recog) => {
      const a = await assess(text, clip, recog);
      if (a.kind !== 'phones') { fb.replaceChildren(h('div', { class: 'verdict warn' }, h('span', { class: 'vh' }, 'Couldn’t score that one'), h('p', {}, a.error || 'Read the whole sentence at a normal volume, then try again.'))); return; }
      takes[i] = a; recordPhones(a.res); addHist('check', text, a.res.score); logDay();
      fb.replaceChildren(h('div', { class: 'row' }, h('span', { class: 'badge ' + grade(a.res.score) }, a.res.score), h('span', { class: 'muted' }, a.res.words.filter(w => w.score >= 80).length + ' of ' + a.res.words.length + ' words clear.')));
      nextBtn.hidden = false; nextBtn.focus();
    } });
    el.replaceChildren(
      h('div', { class: 'checkbar', 'aria-hidden': 'true' }, CHECK.map((_, k) => h('i', { class: k < i ? 'd' : k === i ? 'c' : '' }))),
      h('section', { class: 'panel stack' }, h('div', { class: 'row between' }, h('span', { class: 'eyebrow' }, `Sentence ${i + 1} of ${CHECK.length}`), h('button', { class: 'btn ghost', type: 'button', onclick: () => speakSentence(text, disp) }, icon('play'), 'Hear it (after you try)')),
        disp, rec, fb, h('div', { class: 'row between' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { i++; i < CHECK.length ? step() : finish(); } }, 'Skip'), nextBtn)));
  };
  const finish = () => {
    const done = takes.filter(Boolean);
    if (done.length < 4) { el.replaceChildren(h('section', { class: 'panel empty' }, h('h3', {}, 'Not enough sentences scored'), h('p', { class: 'muted' }, 'Read at least four sentences to build a profile.'), h('button', { class: 'btn primary', type: 'button', onclick: () => { i = 0; step(); } }, 'Start again'))); return; }
    const per = {};
    for (const a of done) for (const p of a.res.phones) if (p.unit && UMAP[p.unit]) { const e = per[p.unit] || (per[p.unit] = { sum: 0, n: 0, heard: {} }); e.sum += p.score; e.n++; if (p.status !== 'ok' && p.heardShow) e.heard[p.heardShow] = (e.heard[p.heardShow] || 0) + 1; }
    const units = Object.fromEntries(Object.entries(per).filter(([, e]) => e.n >= 2).map(([k, e]) => [k, Math.round(e.sum / e.n)]));
    const score = Math.round(done.reduce((s, a) => s + a.res.score, 0) / done.length);
    const rng = done.map(a => a.melody && a.melody.ok ? a.melody.range : null).filter(x => x != null);
    const pace = done.reduce((s, a) => s + a.res.syllPerSec, 0) / done.length;
    const ins = done.reduce((s, a) => s + a.res.inserts.length, 0);
    addCheck({ t: Date.now(), score, units, n: done.length, range: rng.length ? +(rng.reduce((a, b) => a + b, 0) / rng.length).toFixed(1) : null, pace: +pace.toFixed(2), ins });
    store.plan = null; save();
    const rows = Object.entries(per).filter(([, e]) => e.n >= 2).map(([k, e]) => ({ u: UMAP[k], s: Math.round(e.sum / e.n), n: e.n, heard: Object.entries(e.heard).sort((a, b) => b[1] - a[1])[0] })).sort((a, b) => (a.s - a.u.fl * 2) - (b.s - b.u.fl * 2));
    const prev = store.checks.length > 1 ? store.checks[store.checks.length - 2] : null;
    el.replaceChildren(
      h('div', { class: 'stack tight' }, h('span', { class: 'eyebrow' }, 'Accent check results'), h('h2', {}, `Overall sound accuracy ${score}${prev ? ` (${score - prev.score >= 0 ? '+' : ''}${score - prev.score} since last check)` : ''}`),
        h('p', { class: 'muted prose' }, `Your three focus sounds: ${rows.slice(0, 3).map(r => '/' + r.u.ipa + '/ (' + r.u.key + ')').join(', ')}. Today’s plan now starts with them.`)),
      h('div', { class: 'scores' },
        h('div', { class: 'score ' + grade(score) }, h('span', { class: 'eyebrow' }, 'Sounds'), h('span', { class: 'num' }, score, h('small', {}, '%')), h('span', { class: 'note2' }, `${done.length} sentences`)),
        h('div', { class: 'score ' + (rng.length && rng.reduce((a, b) => a + b, 0) / rng.length >= 4.5 ? 'good' : 'warn') }, h('span', { class: 'eyebrow' }, 'Pitch range'), h('span', { class: 'num' }, rng.length ? (rng.reduce((a, b) => a + b, 0) / rng.length).toFixed(1) : '—', h('small', {}, 'st')), h('span', { class: 'note2' }, 'American speech is often 5–8')),
        h('div', { class: 'score ' + (pace >= 3 && pace <= 6.2 ? 'good' : 'warn') }, h('span', { class: 'eyebrow' }, 'Pace'), h('span', { class: 'num' }, pace.toFixed(1), h('small', {}, 'syl/s')), h('span', { class: 'note2' }, pace < 3 ? 'deliberate' : pace > 6.2 ? 'fast' : 'natural')),
        h('div', { class: 'score ' + (ins ? 'warn' : 'good') }, h('span', { class: 'eyebrow' }, 'Extra vowels'), h('span', { class: 'num' }, ins), h('span', { class: 'note2' }, 'between consonants'))),
      h('section', { class: 'panel stack tight' }, h('h3', {}, 'Every sound, weakest first'), h('div', { class: 'profile-list' }, rows.map(r => h('div', { class: 'prow' },
        h('span', { class: 'ipa' }, '/' + r.u.ipa + '/'), h('span', {}, h('b', {}, r.u.name), h('span', { class: 'muted' }, r.heard ? ` · heard as /${r.heard[0]}/ ×${r.heard[1]}` : ` · as in “${r.u.key}”`)),
        h('div', { class: 'bar' }, h('span', { style: { width: r.s + '%', background: `var(--${grade(r.s) === 'none' ? 'line' : grade(r.s) === 'good' ? 'good' : grade(r.s) === 'warn' ? 'warn' : 'bad'})` } })),
        h('button', { class: 'btn ghost', type: 'button', style: { padding: '4px 8px' }, onclick: () => go('sounds.' + r.u.id) }, r.s))))),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => go('today') }, 'Go to today’s plan', icon('next')), h('button', { class: 'btn', type: 'button', onclick: () => go('progress') }, 'See progress')));
  };
  intro();
  return el;
}
