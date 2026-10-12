import { h, icon, grade, toast } from '../dom.js';
import { SCENARIOS } from '../../data/practice.js';
import { store, save, recordPhones, logDay, markStep, addHist } from '../../store.js';
import { coach, coachReady, converse, conversationFeedback, setKey, COACH_MODELS, onCoach } from '../../coach.js';
import { tts, speakAsync, recognizer } from '../../engine/speech.js';
import * as model from '../../engine/model.js';
import { recorderUI, assess, stopActive } from '../recorder.js';
import { issueList } from '../result.js';
import { playClip } from '../../engine/audio.js';

export function coachSetup({ onDone } = {}) {
  const key = h('input', { id: 'apikey', class: 'text-in', type: 'password', autocomplete: 'off', placeholder: 'sk-ant-…', value: store.set.apiKey || '' });
  const msel = h('select', { id: 'coachmodel', class: 'select' }, COACH_MODELS.map(([k, n]) => h('option', { value: k, selected: store.set.coachModel === k }, n)));
  const status = h('p', { class: 'fine' });
  return h('section', { class: 'panel stack' },
    h('div', { class: 'stack tight prose' }, h('h3', {}, 'Turn on the AI coach'),
      h('p', { class: 'muted' }, 'The coach is Claude. It explains your mistakes, writes practice lines for your weak sounds, and plays the other person in conversations. Pronunciation scoring itself always runs on your device.')),
    coach.mode === 'claude' ? h('p', {}, 'The coach is already on through Claude.') : h('div', { class: 'stack tight' },
      h('label', { class: 'field', for: 'apikey' }, h('span', { class: 'eyebrow' }, 'Anthropic API key'), key),
      h('label', { class: 'field', for: 'coachmodel' }, h('span', { class: 'eyebrow' }, 'Model'), msel),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { store.set.coachModel = msel.value; setKey(key.value); status.textContent = key.value.trim() ? 'Saved. The coach is on.' : 'Key removed. The coach is off.'; onDone && onDone(); } }, 'Save'),
        store.set.apiKey ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { key.value = ''; setKey(''); status.textContent = 'Key removed.'; onDone && onDone(); } }, 'Remove key') : null),
      status,
      h('p', { class: 'fine' }, 'Get a key at console.anthropic.com. It’s stored only in this browser and sent only to api.anthropic.com. Usage is billed to your Anthropic account.')));
}

export function coachView(go, args = []) {
  const el = h('div', { class: 'stack' });
  const draw = () => {
    if (!coachReady()) { el.replaceChildren(coachSetup({ onDone: draw })); return; }
    const sc = SCENARIOS.find(s => s.id === args[0]);
    if (!sc) {
      el.replaceChildren(h('div', { class: 'stack tight prose' }, h('span', { class: 'eyebrow' }, 'Conversation practice'), h('h2', {}, 'Talk it through, out loud'),
        h('p', { class: 'muted' }, 'Claude plays the other person. Answer by speaking. Each of your turns is scored sound by sound, and at the end you get feedback on pronunciation and phrasing.')),
        h('div', { class: 'grid3' }, SCENARIOS.map(s => h('button', { class: 'scen', type: 'button', onclick: () => go('coach.' + s.id) }, h('b', {}, s.name), h('span', {}, 'You: ' + s.you)))),
        !recognizer.available ? h('div', { class: 'note' }, h('div', {}, h('strong', {}, 'Speech recognition isn’t available in this browser.'), 'You can still type your replies. Chrome, Edge and Safari support spoken replies.')) : null);
      return;
    }
    el.replaceChildren(chat(sc, go));
  };
  draw();
  const off = onCoach(() => {});
  el._cleanup = off;
  return el;
}

function chat(sc, go) {
  const turns = [{ role: 'assistant', text: sc.opener }];
  const scored = [];
  const log = h('div', { class: 'chat', 'aria-live': 'polite' });
  const status = h('p', { class: 'fine' });
  const fbBox = h('div', {});
  let busy = false;
  const bubble = (t, extra) => {
    if (t.role === 'assistant') return h('div', { class: 'bubble them' }, t.text, h('div', { class: 'meta' }, h('button', { class: 'btn ghost', type: 'button', style: { padding: '2px 8px', fontSize: '12.5px' }, onclick: () => tts.speak(t.text) }, icon('play'), 'Replay')));
    const body = extra && extra.kind === 'phones'
      ? h('div', { class: 'wline' }, extra.res.words.map(w => h('span', { class: w.score >= 80 ? '' : w.score >= 55 ? 'warn' : 'bad', title: `${w.score}` }, w.text)))
      : h('div', {}, t.text);
    return h('div', { class: 'bubble me' }, body, h('div', { class: 'meta' }, extra && extra.kind === 'phones' ? `Sounds ${extra.res.score} · ` : '', extra && extra.clip ? h('button', { class: 'btn ghost', type: 'button', style: { padding: '2px 8px', fontSize: '12.5px' }, onclick: () => playClip(extra.clip) }, icon('person'), 'Hear yourself') : null));
  };
  const redraw = () => { log.replaceChildren(...turns.map((t, i) => bubble(t, t.a))); log.lastElementChild && log.lastElementChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
  const reply = async () => {
    busy = true; status.textContent = 'Thinking…';
    try {
      const msgs = turns.map(t => ({ role: t.role, text: t.text }));
      if (msgs[0].role === 'assistant') msgs.unshift({ role: 'user', text: '(Start the role-play. You have just said your opening line.)' });
      const text = await converse(sc, msgs);
      turns.push({ role: 'assistant', text }); redraw(); status.textContent = '';
      speakAsync(text);
    } catch (e) { status.textContent = 'The coach couldn’t reply: ' + e.message; }
    busy = false;
  };
  const userTurn = async (text, clip) => {
    if (!text) { status.textContent = 'Nothing was recognized. Try again, or type your reply.'; return; }
    let a = null;
    if (clip && model.ready()) { try { a = await assess(text, clip, { text }); if (a.kind === 'phones') { recordPhones(a.res); scored.push(a); addHist('talk', text, a.res.score); } } catch (e) {} }
    turns.push({ role: 'user', text, a: a || (clip ? { clip } : null) }); redraw(); logDay();
    await reply();
  };
  const rec = recorderUI({ mode: 'free', label: 'Tap the mic and answer', upload: false, onDone: async (clip, recog) => {
    if (busy) return;
    await userTurn(recog && recog.text ? recog.text.trim() : '', clip.speech ? clip : null);
  } });
  const typed = h('input', { id: 'typed', class: 'text-in', placeholder: 'Or type your reply' });
  const form = h('form', { class: 'row', onsubmit: async e => { e.preventDefault(); const t = typed.value.trim(); if (!t || busy) return; typed.value = ''; await userTurn(t, null); } }, h('label', { class: 'sr-only', for: 'typed' }, 'Type your reply'), h('div', { style: { flex: '1', minWidth: '0' } }, typed), h('button', { class: 'btn', type: 'submit' }, 'Send'));
  const end = h('button', { class: 'btn', type: 'button', onclick: async () => {
    stopActive(); tts.stop();
    if (turns.filter(t => t.role === 'user').length < 2) { toast('Say at least two things first.'); return; }
    end.disabled = true; fbBox.replaceChildren(h('p', { class: 'muted' }, 'Writing feedback…'));
    const agg = new Map();
    for (const a of scored) for (const e of issueList(a.res)) { const k = e.ins ? 'extra vowels' : '/' + e.show + '/'; const x = agg.get(k) || { n: 0, heard: new Map(), words: new Set() }; x.n += e.n; e.heard.forEach((v, kk) => x.heard.set(kk, (x.heard.get(kk) || 0) + v)); e.words.forEach(w => x.words.add(w)); agg.set(k, x); }
    const pron = [...agg.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 6).map(([k, x]) => `${k}: ${x.n}× (heard as ${[...x.heard.keys()].map(v => v === '∅' ? 'dropped' : '/' + v + '/').join(', ')}) in ${[...x.words].slice(0, 4).join(', ')}`).join('\n');
    try {
      const txt = await conversationFeedback(sc, turns, pron);
      const avg = scored.length ? Math.round(scored.reduce((s, a) => s + a.res.score, 0) / scored.length) : null;
      store.convos.push({ t: Date.now(), id: sc.id, turns: turns.length, score: avg }); save(); markStep('talk');
      fbBox.replaceChildren(h('section', { class: 'panel stack tight' }, h('div', { class: 'row between' }, h('h3', {}, 'Feedback'), avg != null ? h('span', { class: 'badge ' + grade(avg) }, 'Sounds ' + avg) : null), h('div', { class: 'coachout' }, txt)));
    } catch (e) { fbBox.replaceChildren(h('p', { class: 'muted' }, 'Feedback failed: ' + e.message)); }
    end.disabled = false;
  } }, 'End and get feedback');
  redraw();
  setTimeout(() => speakAsync(sc.opener), 300);
  return h('div', { class: 'stack', style: { maxWidth: '820px' } },
    h('div', { class: 'row between' }, h('div', { class: 'stack tight' }, h('span', { class: 'eyebrow' }, 'Conversation'), h('h2', {}, sc.name), h('p', { class: 'muted' }, 'You are ' + sc.you + '.')), h('button', { class: 'btn ghost', type: 'button', onclick: () => go('coach') }, icon('prev'), 'All scenarios')),
    h('section', { class: 'panel stack' }, log, status, rec, form, h('div', { class: 'row between' }, h('span', { class: 'fine' }, model.ready() ? 'Your turns are scored sound by sound.' : 'Turn on sound-by-sound scoring to score your turns.'), end)),
    fbBox);
}
