import { h, icon, grade, toast } from '../dom.js';
import { SETS, CONNECTED, INTONATION, STRESS, STRESS_RULES } from '../../data/practice.js';
import { UMAP } from '../../data/sounds.js';
import { store, save, fill, focusUnits, recordPhones, addHist, lastScore, logDay, review, dueItems, markStep, todayPlan } from '../../store.js';
import { toPhones } from '../../engine/g2p.js';
import { tts } from '../../engine/speech.js';
import { recorderUI, assess, speakSentence, stopActive } from '../recorder.js';
import { resultView, playbackRow } from '../result.js';
import { coachReady, makeDrills } from '../../coach.js';
import { playClip } from '../../engine/audio.js';

const tuneMark = t => /\?\s*$/.test(t) ? (/^(do|does|did|is|are|was|were|can|could|will|would|should|have|has|had|may|am)\b/i.test(t.trim()) && !/\bor\b/i.test(t) ? '↗' : '↘') : '↘';

// Sentence with stressed words bold and reduced words grey (from espeak stress marks).
function sentenceEl(text) {
  const p = h('p', { class: 'sent' });
  const words = text.split(/\s+/);
  p.append(...words.flatMap((w, i) => i < words.length - 1 ? [h('span', { class: 'w' }, w), ' '] : [h('span', { class: 'w' }, w)]), h('span', { class: 'tune', 'aria-hidden': 'true' }, tuneMark(text)));
  toPhones(text).then(ws => {
    if (ws.length !== words.length) return;
    const spans = p.querySelectorAll('.w');
    ws.forEach((w, i) => { const s = spans[i]; if (!s) return; if (w.stress.includes(1)) s.replaceChildren(h('b', {}, s.textContent)); else if (!w.stress.some(x => x)) s.classList.add('red'); });
  }).catch(() => {});
  return p;
}

// Reusable sentence practice: list + current sentence + recorder + feedback.
export function sentenceDrill(items, { title = '', tip = '', go, kind = 'line', onScored } = {}) {
  const box = h('div', { class: 'stack' });
  let idx = 0;
  const results = new Map();
  const draw = () => {
    stopActive();
    const it = items[idx]; const text = fill(it.text);
    const resBox = h('div', {});
    const disp = sentenceEl(text);
    const rec = recorderUI({ label: 'Tap the mic and read the sentence', onDone: async (clip, recog) => {
      const a = await assess(text, clip, recog);
      results.set(idx, a);
      if (a.kind === 'phones') recordPhones(a.res);
      const sc = a.kind === 'phones' ? a.res.score : a.kind === 'words' ? a.words.pct : null;
      if (sc != null) { addHist(kind, text, sc); logDay(); review('line', it.text, sc); onScored && onScored(sc, a); }
      resBox.replaceChildren(resultView(a, { onUnit: id => go('sounds.' + id + '.say') }));
      drawList();
    } });
    const prev = results.get(idx);
    if (prev) resBox.append(resultView(prev, { onUnit: id => go('sounds.' + id + '.say') }));
    current.replaceChildren(
      h('section', { class: 'panel stack' },
        h('div', { class: 'row between' }, h('span', { class: 'eyebrow' }, `${title}${title ? ' · ' : ''}${idx + 1} of ${items.length}`),
          h('div', { class: 'row' }, h('button', { class: 'iconbtn sm', type: 'button', 'aria-label': 'Previous sentence', onclick: () => { idx = (idx - 1 + items.length) % items.length; draw(); } }, icon('prev')), h('button', { class: 'iconbtn sm', type: 'button', 'aria-label': 'Next sentence', onclick: () => { idx = (idx + 1) % items.length; draw(); } }, icon('next')))),
        disp,
        h('div', { class: 'legend' }, h('span', {}, h('b', {}, 'Bold'), ' stressed'), h('span', {}, h('span', { class: 'red', style: { color: 'var(--faint)' } }, 'Grey'), ' reduce it'), h('span', {}, '↘ ↗ melody at the end')),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => speakSentence(text, disp) }, icon('play'), 'Listen'), h('button', { class: 'btn', type: 'button', onclick: () => speakSentence(text, disp, { rate: 0.66 }) }, icon('slow'), 'Listen slowly')),
        rec),
      resBox);
  };
  const list = h('div', { class: 'pills' });
  const drawList = () => list.replaceChildren(...items.map((it, i) => {
    const r = results.get(i); const sc = r ? (r.kind === 'phones' ? r.res.score : r.kind === 'words' ? r.words.pct : null) : lastScore(fill(it.text));
    return h('button', { class: 'pill', type: 'button', 'aria-current': String(i === idx), title: fill(it.text), onclick: () => { idx = i; draw(); drawList(); } }, `${i + 1}`, sc != null ? h('span', { class: 'badge ' + grade(sc), style: { marginLeft: '6px' } }, sc) : null);
  }));
  const current = h('div', { class: 'stack' });
  if (tip) box.append(h('div', { class: 'note info' }, h('div', {}, h('strong', {}, title), tip)));
  box.append(list, current);
  drawList(); draw();
  return box;
}

function stressDrill(cat, go) {
  const box = h('div', { class: 'stack' });
  let idx = 0, picked = null;
  const draw = () => {
    stopActive();
    const it = cat.items[idx];
    const say = () => tts.speak(it.say, { rate: Math.max(0.78, tts.rate - 0.05) });
    const syls = h('div', { class: 'syls' }, it.s.map((sy, i) => {
      const b = h('button', { class: 'syl', type: 'button', onclick: () => { if (picked != null) return; picked = i; draw(); say(); } }, sy);
      if (picked != null) { b.disabled = true; if (i === it.k) b.classList.add('right'); else if (i === picked) b.classList.add('wrong'); }
      return b;
    }));
    const resBox = h('div', {});
    const parts = [h('div', { class: 'row between' }, h('span', { class: 'mono muted' }, `Word ${idx + 1} of ${cat.items.length}${it.pos ? ' · ' + it.pos : ''}`),
      h('div', { class: 'row' }, h('button', { class: 'iconbtn sm', type: 'button', 'aria-label': 'Previous word', onclick: () => { idx = (idx - 1 + cat.items.length) % cat.items.length; picked = null; draw(); } }, icon('prev')), h('button', { class: 'btn', type: 'button', onclick: () => { idx = (idx + 1) % cat.items.length; picked = null; draw(); } }, 'Next word', icon('next')))),
      h('p', { class: 'say-sub', style: { textAlign: 'center' } }, picked == null ? 'Tap the syllable that carries the main stress.' : picked === it.k ? 'Right.' : `The stress falls on “${it.s[it.k]}”.`),
      it.say !== it.w ? h('p', { class: 'say-sub', style: { textAlign: 'center' } }, `Say it as “${it.say}”`) : null, syls];
    if (picked == null) parts.push(h('div', { class: 'row center' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { picked = -1; draw(); say(); } }, 'Show me')));
    else {
      parts.push(h('p', { class: 'respell' }, it.s.map((sy, i) => i === it.k ? h('b', {}, sy.toUpperCase()) : sy).reduce((a, x, i) => i ? a.concat(['·', x]) : [x], [])),
        h('div', { class: 'row center' }, h('button', { class: 'btn primary', type: 'button', onclick: say }, icon('play'), 'Listen')),
        recorderUI({ mode: 'word', label: `Tap the mic and say “${it.say}”`, onDone: async (clip, recog) => {
          const a = await assess(it.say, clip, recog);
          resBox.replaceChildren(stressResult(a, it));
        } }), resBox);
    }
    current.replaceChildren(h('section', { class: 'panel stack' }, ...parts));
  };
  const current = h('div', {});
  box.append(current, h('section', { class: 'panel flat' }, h('h3', {}, 'Patterns worth knowing'), h('div', { class: 'kv', style: { marginTop: '10px' } }, STRESS_RULES.flatMap(([a, b]) => [h('dt', {}, a), h('dd', {}, b)]))));
  draw();
  return box;
}
function stressResult(a, it) {
  const you = a.clip ? () => playClip(a.clip) : null;
  const model = () => new Promise(r => tts.speak(it.say, { rate: 0.85, onend: r }));
  if (a.kind !== 'phones') return h('div', { class: 'verdict warn' }, h('span', { class: 'vh' }, a.kind === 'none' ? 'Couldn’t score this take.' : 'Word stress needs sound-by-sound scoring.'), h('p', {}, a.kind === 'none' ? (a.error || 'Say the word once, at normal volume.') : 'Turn it on from Today. Meanwhile, compare by ear.'), playbackRow(model, you));
  recordPhones(a.res); logDay();
  const target = a.res.words.length - 1;
  const st = (a.stress || []).find(s => s.word === target);
  const w = a.res.words[target];
  const vowels = w.phones.filter(p => p.vowel && p.tok !== 'əl' && p.tok !== 'n̩');
  let cls = 'warn', head = 'Couldn’t find clear syllable beats. Say it a little louder.', bars = null;
  if (st) {
    const okIdx = vowels.length === it.s.length ? it.k : st.expected;
    const ok = st.actual === okIdx;
    cls = ok ? 'good' : 'bad';
    head = ok ? `Your strongest beat landed on “${it.s[okIdx] || vowels[okIdx].show}”. That’s the stressed syllable.` : `Your strongest beat landed on ${vowels.length === it.s.length ? '“' + it.s[st.actual] + '”' : '/' + vowels[st.actual].show + '/'}. Move it to “${it.s[it.k]}”: louder, longer, higher.`;
    if (vowels.length === it.s.length) bars = h('div', { class: 'sbars', 'aria-hidden': 'true' }, it.s.map((sy, i) => h('div', {}, h('i', { class: (i === st.actual ? 'top' : '') + (i === okIdx ? ' exp' : ''), style: { height: (i === st.actual ? 56 : 22 + (i === okIdx ? 8 : 0)) + 'px' } }), h('span', {}, sy))));
  }
  return h('div', { class: 'verdict ' + cls }, h('span', { class: 'vh' }, head), bars, h('p', { class: 'fine' }, `Sounds: ${a.res.score}/100.`), playbackRow(model, you));
}

export function speak(go, args = []) {
  const sec = args[0] || 'wards';
  const rail = h('aside', { class: 'rail', 'aria-label': 'Practice sets' });
  const item = (id, label, extra) => h('button', { class: 'snd', type: 'button', style: { gridTemplateColumns: 'minmax(0,1fr) auto' }, 'aria-current': String(id === sec), onclick: () => go('speak.' + id) }, h('span', {}, label), extra || h('span'));
  const due = dueItems();
  const opts = [['Sentences', SETS.map(s => [s.id, s.name]).concat([['focus', 'Your focus sounds'], ['review', `Review${due.length ? ' (' + due.length + ')' : ''}`], ['coachlines', 'Coach-written lines'], ['mine', 'My sentences']])], ['Rhythm', [['stress', 'Word stress'], ...CONNECTED.map(c => ['cs-' + c.id, c.name])]], ['Melody', INTONATION.map(c => ['tune-' + c.id, c.name])]];
  const sel = h('select', { id: 'speaksel', class: 'select rail-select', 'aria-label': 'Practice set' }, opts.map(([g, xs]) => h('optgroup', { label: g }, xs.map(([v, l]) => h('option', { value: v, selected: v === sec }, l)))));
  sel.addEventListener('change', () => go('speak.' + sel.value));
  const listBox = h('div', { class: 'rail-list' });
  rail.append(sel, listBox);
  listBox.append(
    h('div', { class: 'group-label' }, 'Sentences'), ...SETS.map(s => item(s.id, s.name)),
    item('focus', 'Your focus sounds'), item('review', 'Review', due.length ? h('span', { class: 'badge warn' }, due.length) : null),
    item('coachlines', 'Coach-written lines', store.coachDrills.length ? h('span', { class: 'badge' }, store.coachDrills.length) : null), item('mine', 'My sentences'),
    h('div', { class: 'group-label' }, 'Rhythm'), item('stress', 'Word stress'), ...CONNECTED.map(c => item('cs-' + c.id, c.name)),
    h('div', { class: 'group-label' }, 'Melody'), ...INTONATION.map(c => item('tune-' + c.id, c.name)));
  const work = h('article', { class: 'work' });
  let body;
  const set = SETS.find(s => s.id === sec);
  if (set) body = sentenceDrill(set.items.map(text => ({ text })), { title: set.name, go });
  else if (sec === 'focus') {
    const f = focusUnits(3);
    const items = f.flatMap(u => u.lines.map(text => ({ text }))).concat(store.coachDrills.slice(-4).map(text => ({ text })));
    body = sentenceDrill(items, { title: 'Focus: ' + f.map(u => '/' + u.ipa + '/').join(' '), go, onScored: () => markStep('lines') });
  } else if (sec === 'review') {
    const items = due.map(d => ({ text: d.text }));
    body = items.length ? sentenceDrill(items, { title: 'Due for review', go, onScored: () => { if (dueItems().length <= 1) markStep('review'); } })
      : h('section', { class: 'panel empty' }, h('h3', {}, 'Nothing due'), h('p', { class: 'muted' }, 'Words and sentences you score under 80 come back here after 1, 3, 7, 16 and 35 days until you get them right.'), h('button', { class: 'btn', type: 'button', onclick: () => { markStep('review'); go('today'); } }, 'Mark review done'));
  } else if (sec === 'coachlines') body = coachLines(go);
  else if (sec === 'mine') body = mine(go);
  else if (sec === 'stress') body = h('div', { class: 'stack' }, h('div', { class: 'seg', role: 'group', 'aria-label': 'Word set' }, STRESS.map(c => h('button', { type: 'button', 'aria-pressed': String(c.id === (args[1] || 'clinical')), onclick: () => go('speak.stress.' + c.id, { replace: true }) }, c.name))), stressDrill(STRESS.find(c => c.id === (args[1] || 'clinical')) || STRESS[0], go));
  else if (sec.startsWith('cs-')) { const c = CONNECTED.find(x => 'cs-' + x.id === sec) || CONNECTED[0]; body = sentenceDrill(c.items.map(text => ({ text })), { title: c.name, tip: c.tip, go, onScored: () => markStep('rhythm') }); }
  else if (sec.startsWith('tune-')) { const c = INTONATION.find(x => 'tune-' + x.id === sec) || INTONATION[0]; body = sentenceDrill(c.items.map(text => ({ text })), { title: c.name, tip: c.tip, go, onScored: () => markStep('rhythm') }); }
  else body = sentenceDrill(SETS[0].items.map(text => ({ text })), { title: SETS[0].name, go });
  work.append(body);
  return h('div', { class: 'bench' }, rail, work);
}

function mine(go) {
  const box = h('div', { class: 'stack' });
  const ta = h('textarea', { id: 'mytext', class: 'text-in', rows: '3', placeholder: 'Paste a line from your next talk, or something you say every day.' });
  const form = h('form', { class: 'panel stack tight', onsubmit: e => { e.preventDefault(); const t = ta.value.trim().replace(/\s+/g, ' '); if (!t) return; store.custom.push(t.slice(0, 240)); save(); ta.value = ''; go('speak.mine', { replace: true }); } },
    h('label', { class: 'eyebrow', for: 'mytext' }, 'Add your own sentence'), ta, h('div', {}, h('button', { class: 'btn', type: 'submit' }, 'Add sentence')),
    h('p', { class: 'fine' }, 'Any English sentence works. The expected pronunciation is generated on your device.'));
  box.append(form);
  if (store.custom.length) {
    box.append(h('div', { class: 'pills' }, store.custom.map((t, i) => h('span', { class: 'pill' }, t.length > 40 ? t.slice(0, 40) + '…' : t, ' ', h('button', { class: 'iconbtn sm', style: { width: '22px', height: '22px', border: 0 }, type: 'button', 'aria-label': 'Delete', onclick: () => { store.custom.splice(i, 1); save(); go('speak.mine', { replace: true }); } }, icon('x'))))));
    box.append(sentenceDrill(store.custom.map(text => ({ text })), { title: 'My sentences', go }));
  }
  return box;
}

function coachLines(go) {
  const box = h('div', { class: 'stack' });
  const f = focusUnits(3);
  const ctxSel = h('select', { id: 'ctxsel', class: 'select' }, ['hospital and clinical work', 'presenting research at a conference', 'phone calls and handoffs', 'everyday small talk'].map(c => h('option', { value: c }, c)));
  const btn = h('button', { class: 'btn primary', type: 'button' }, icon('spark'), 'Write 8 new lines');
  const status = h('p', { class: 'fine' });
  btn.addEventListener('click', async () => {
    if (!coachReady()) { window.dispatchEvent(new CustomEvent('al:coachsetup')); return; }
    btn.disabled = true; status.textContent = 'Writing lines for ' + f.map(u => '/' + u.ipa + '/').join(', ') + '…';
    try { const lines = await makeDrills(f.map(u => u.id), ctxSel.value); store.coachDrills.push(...lines); store.coachDrills = store.coachDrills.slice(-40); save(); go('speak.coachlines', { replace: true }); }
    catch (e) { status.textContent = 'The coach couldn’t write lines: ' + e.message; btn.disabled = false; }
  });
  box.append(h('section', { class: 'panel stack tight' }, h('h3', {}, 'Lines written for your weak sounds'), h('p', { class: 'muted' }, 'The coach writes sentences that pack in ' + f.map(u => '/' + u.ipa + '/').join(', ') + '.'),
    h('div', { class: 'row' }, h('label', { class: 'sr-only', for: 'ctxsel' }, 'Context'), ctxSel, btn), status));
  if (store.coachDrills.length) box.append(sentenceDrill(store.coachDrills.slice().reverse().map(text => ({ text })), { title: 'Coach-written', go }));
  return box;
}
