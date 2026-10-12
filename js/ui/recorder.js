// Recorder widget and the scoring pipeline shared by every exercise.
import { h, icon, toast, tokColor } from './dom.js';
import { record, liveTrace, decodeFile, mic, stopPlayback } from '../engine/audio.js';
import { listen, recognizer, tts, RECOG_ERRORS } from '../engine/speech.js';
import * as model from '../engine/model.js';
import { toPhones, splitWords } from '../engine/g2p.js';
import { scoreUtterance } from '../engine/scoring.js';
import { wordStress, melody, expectedTune } from '../engine/prosody.js';
import { scoreWords } from '../engine/fallback.js';
import { fill } from '../store.js';

let active = null;
export function stopActive() { if (active) { try { active.stop(); } catch (e) {} active = null; } }

export async function assess(text, clip, recog) {
  const shown = fill(text);
  const out = { text: shown, clip, kind: 'none', recog, tune: expectedTune(shown) };
  if (!clip.speech) { out.reason = 'nospeech'; return out; }
  if (model.ready()) {
    try {
      const words = await toPhones(shown);
      if (words.length) {
        const r = window.__alSynth ? await window.__alSynth(words) : await model.infer(clip.pcm);
        const res = scoreUtterance(r.logp, r.T, words);
        if (res.ok) { out.kind = 'phones'; out.res = res; out.stress = wordStress(res, clip); out.melody = melody(res, clip); out.ms = r.ms; }
        else out.reason = res.reason;
      }
    } catch (e) { out.error = e.message; }
  }
  if (out.kind === 'none' && recog && recog.text) {
    out.kind = 'words'; out.heard = recog.text; out.words = scoreWords(splitWords(shown), recog.text); out.melody = melody(null, clip);
  } else if (out.kind === 'none') {
    out.melody = melody(null, clip);
    if (recog && recog.err && !out.error) out.error = RECOG_ERRORS[recog.err] || null;
  }
  return out;
}
export const micProblem = () => ({ blocked: 'The microphone is blocked on this page. Open Accent Lab from its own link, or upload a recording.', denied: 'Microphone permission was denied. Allow it from the icon in the address bar, then try again.', unsupported: 'This browser can’t record audio here. Upload a recording instead.' }[mic.state] || 'The microphone couldn’t start.');

// mode: 'word' (short, auto-stop quickly) | 'sentence' | 'free' (conversation; always uses the recognizer)
export function recorderUI({ label = 'Tap the mic and speak', mode = 'sentence', onDone, upload = true, compact = false }) {
  const cfg = mode === 'word' ? { maxSec: 4.5, silenceSec: 0.8 } : mode === 'free' ? { maxSec: 30, silenceSec: 2.2 } : { maxSec: 16, silenceSec: 1.3 };
  const col = tokColor();
  const canvas = h('canvas', { class: 'live', 'aria-hidden': 'true' });
  const btn = h('button', { class: 'rec', type: 'button', 'aria-label': 'Start recording' }, icon('mic'));
  const status = h('div', { class: 'rec-status' }, label);
  const sub = h('div', { class: 'interim' });
  const tools = h('div', { class: 'rec-tools' });
  let rec = null, rg = null, busy = false;
  const setIdle = (msg) => { btn.className = 'rec'; btn.disabled = false; btn.replaceChildren(icon('mic')); btn.setAttribute('aria-label', 'Start recording'); status.textContent = msg || label; };
  const hint = () => {
    if (mode !== 'free' && !model.ready()) {
      sub.replaceChildren(model.state.status === 'downloading' || model.state.status === 'opening' ? 'The sound model is loading. Until then, whole words are checked.' : h('span', {}, 'Checking whole words only. ', h('button', { class: 'btn ghost', type: 'button', style: { padding: '2px 8px', fontSize: '12.5px' }, onclick: () => window.dispatchEvent(new CustomEvent('al:engine')) }, 'Turn on sound-by-sound scoring')));
    } else sub.textContent = '';
  };
  hint();
  const finish = async (clip, recog) => {
    busy = true; btn.className = 'rec busy'; btn.disabled = true; btn.replaceChildren(icon('loop')); status.textContent = clip.speech ? 'Scoring…' : 'No speech came through.';
    try { await onDone(clip, recog); } catch (e) { console.error(e); toast('Something went wrong while scoring. Try again.'); }
    busy = false; setIdle(clip.speech ? 'Tap to try again' : 'No speech came through. Check the mic and try again.'); hint();
  };
  btn.addEventListener('click', async () => {
    if (busy) return;
    if (rec) { rec.stop(); return; }
    stopActive(); tts.stop(); stopPlayback();
    const useRecog = recognizer.available && (mode === 'free' || !model.ready());
    let draw = null;
    try {
      rec = await record({ ...cfg, onFrame: f => { if (!draw) draw = liveTrace(canvas, mode === 'free' ? 10 : 5, { level: col('--line'), pitch: col('--voice') }); draw(f); } });
    } catch (e) { rec = null; setIdle(micProblem()); return; }
    if (useRecog) rg = listen({ continuous: mode !== 'word', onInterim: t => { sub.textContent = t; } });
    active = { stop: () => rec && rec.stop() };
    btn.className = 'rec on'; btn.replaceChildren(icon('stop')); btn.setAttribute('aria-label', 'Stop recording');
    status.textContent = 'Listening. Speak now.'; if (!useRecog) sub.textContent = '';
    const clip = await rec.result; rec = null; active = null;
    let recog = null;
    if (rg) { rg.stop(); recog = await Promise.race([rg.done, new Promise(r => setTimeout(() => r({ text: '', err: 'timeout' }), 3500))]); rg = null; }
    await finish(clip, recog);
  });
  if (upload) {
    const id = 'up' + Math.random().toString(36).slice(2, 8);
    const input = h('input', { type: 'file', id, accept: 'audio/*', class: 'sr-only', 'aria-label': 'Upload a recording' });
    input.addEventListener('change', async () => {
      const f = input.files[0]; input.value = ''; if (!f || busy) return;
      try { const clip = await decodeFile(f); await finish(clip, null); }
      catch (e) { toast('Couldn’t read that audio. Try an .m4a, .mp3, .wav or .webm file.'); }
    });
    tools.append(input, h('button', { class: 'btn ghost', type: 'button', style: { padding: '5px 10px', fontSize: '13px' }, onclick: () => input.click() }, icon('upload'), 'Upload a recording'));
  }
  const unsub = model.onState(() => { if (!busy && !rec) hint(); });
  const el = h('div', { class: 'recorder' }, btn, h('div', { class: 'rec-side' }, status, canvas, sub, compact ? null : tools));
  el._cleanup = unsub;
  return el;
}

// Speak a sentence with the model voice, highlighting words in `el` (spans with class "w").
export function speakSentence(text, el, { rate, onend } = {}) {
  const spans = el ? Array.from(el.querySelectorAll('.w')) : [];
  const words = String(text).split(/\s+/); const starts = []; let p = 0;
  words.forEach(w => { starts.push(p); p += w.length + 1; });
  tts.speak(text, {
    rate,
    onboundary: e => { if (e.name && e.name !== 'word') return; let k = 0; for (let i = 0; i < starts.length; i++) if (starts[i] <= e.charIndex) k = i; spans.forEach((s, i) => s.classList.toggle('now', i === k)); },
    onend: () => { spans.forEach(s => s.classList.remove('now')); onend && onend(); }
  });
}
