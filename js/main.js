import { h, icon, $, $$, toast } from './ui/dom.js';
import { store, save, saveNow, resetScores, todayPlan } from './store.js';
import { L1, L1_NAME } from './data/sounds.js';
import * as model from './engine/model.js';
import { tts } from './engine/speech.js';
import { settings as audioSettings, stopPlayback, mic, onMic, getStream, record, liveTrace } from './engine/audio.js';
import { initCoach, onCoach, coach } from './coach.js';
import { stopActive } from './ui/recorder.js';
import { setStrictness } from './engine/scoring.js';
import { engineCard } from './ui/engine-card.js';
import { today } from './ui/views/today.js';
import { sounds } from './ui/views/sounds.js';
import { speak } from './ui/views/speak.js';
import { coachView, coachSetup } from './ui/views/coach.js';
import { progress } from './ui/views/progress.js';
import { check } from './ui/views/check.js';
import { tokColor } from './ui/dom.js';

const VIEWS = { today, sounds, speak, coach: coachView, progress, check };
const NAV = [['today', 'Today', 'home'], ['sounds', 'Sounds', 'sound'], ['speak', 'Speak', 'speak'], ['coach', 'Coach', 'coach'], ['progress', 'Progress', 'chart']];
const main = $('#main');

function parse() {
  const raw = decodeURIComponent(location.hash.slice(1)) || 'today';
  const [v, ...args] = raw.split('.');
  return { v: VIEWS[v] ? v : 'today', args };
}
export function go(route, { replace = false } = {}) {
  const url = '#' + route;
  try { replace ? history.replaceState(null, '', url) : history.pushState(null, '', url); } catch (e) { location.hash = route; return; }
  render();
}
function cleanup() { $$('*', main).forEach(el => { if (typeof el._cleanup === 'function') { try { el._cleanup(); } catch (e) {} } }); }
function render() {
  stopActive(); tts.stop(); stopPlayback(); cleanup();
  if (!store.profile.onboarded) { $('#nav').hidden = true; main.replaceChildren(onboarding()); return; }
  $('#nav').hidden = false;
  const { v, args } = parse();
  main.replaceChildren(VIEWS[v](go, args));
  $$('#nav a').forEach(a => a.setAttribute('aria-current', a.dataset.v === v || (v === 'check' && a.dataset.v === 'today') ? 'page' : 'false'));
  window.scrollTo({ top: 0 });
}
window.addEventListener('popstate', render);
window.addEventListener('hashchange', render);

// Header chips
function engineChip() {
  const c = $('#engineChip');
  model.onState(s => {
    const txt = s.status === 'ready' ? 'Scoring every sound' : s.status === 'downloading' ? `Model ${s.total ? Math.round(s.got / s.total * 100) : 0}%` : s.status === 'opening' ? 'Starting model…' : s.status === 'error' ? 'Model error' : 'Scoring words only';
    c.dataset.s = s.status === 'ready' ? 'good' : s.status === 'downloading' || s.status === 'opening' ? 'busy' : 'warn';
    c.replaceChildren(h('span', { class: 'led' }), txt);
  });
  c.addEventListener('click', () => openSettings('engine'));
}

// Settings
function openSettings(focus) {
  const dlg = $('#settings');
  const body = $('#settingsBody');
  const l1 = h('select', { id: 'setL1', class: 'select' }, L1.map(([k, n]) => h('option', { value: k, selected: store.profile.l1 === k }, n)));
  l1.addEventListener('change', () => { store.profile.l1 = l1.value; store.plan = null; save(); });
  const name = h('input', { id: 'setName', class: 'text-in', value: store.profile.name || '', placeholder: 'e.g. Rivera', autocomplete: 'family-name' });
  name.addEventListener('change', () => { store.profile.name = name.value.trim(); save(); });
  const voice = h('select', { id: 'setVoice', class: 'select' }, tts.voices.length ? tts.voices.map(v => h('option', { value: v.name, selected: tts.voice && v.name === tts.voice.name }, `${v.name} (${v.lang})`)) : [h('option', { value: '' }, 'No US English voices found')]);
  voice.addEventListener('change', () => { const v = tts.voices.find(x => x.name === voice.value); if (v) { tts.voice = v; store.set.voice = v.name; save(); tts.speak('This is the model voice.'); } });
  const rate = h('input', { id: 'setRate', type: 'range', min: '0.6', max: '1.15', step: '0.05', value: store.set.rate });
  const rateOut = h('output', { class: 'mono', for: 'setRate' }, (+store.set.rate).toFixed(2) + '×');
  rate.addEventListener('input', () => { store.set.rate = +rate.value; tts.rate = +rate.value; rateOut.textContent = (+rate.value).toFixed(2) + '×'; });
  rate.addEventListener('change', () => { save(); tts.speak('Thank you for coming this afternoon.'); });
  const ns = h('input', { type: 'checkbox', id: 'setNoise', checked: store.set.noise });
  ns.addEventListener('change', () => { store.set.noise = ns.checked; audioSettings.noiseSuppression = ns.checked; save(); });
  const strict = h('div', { class: 'seg', role: 'group', 'aria-label': 'Feedback strictness' }, [['lenient', 'Lenient'], ['standard', 'Standard'], ['strict', 'Strict']].map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(store.set.strict === k), onclick: e => { store.set.strict = k; setStrictness(k); save(); strict.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, l)));
  const testCanvas = h('canvas', { class: 'live', 'aria-hidden': 'true' });
  const testStatus = h('span', { class: 'fine' }, 'Say a short sentence at normal volume.');
  const testBtn = h('button', { class: 'btn', type: 'button' }, icon('mic'), 'Test for 4 seconds');
  testBtn.addEventListener('click', async () => {
    let r; const col = tokColor(); let draw = null;
    try { r = await record({ maxSec: 4, silenceSec: 3, onFrame: f => { if (!draw) draw = liveTrace(testCanvas, 4, { level: col('--line'), pitch: col('--voice') }); draw(f); } }); }
    catch (e) { testStatus.textContent = 'The microphone isn’t available: ' + (mic.state === 'denied' ? 'permission was denied.' : 'this browser or page can’t record.'); return; }
    testBtn.disabled = true; testStatus.textContent = 'Listening…';
    const clip = await r.result; testBtn.disabled = false;
    testStatus.textContent = !clip.speech ? `Very quiet (peak ${clip.peakDb.toFixed(0)} dB). Move closer or raise the input level.` : clip.peakDb > -4 ? 'Loud enough, close to clipping. Back off a little.' : `Good level (peak ${clip.peakDb.toFixed(0)} dB).`;
  });
  const resetBox = h('div', { class: 'confirm', hidden: true }, h('span', {}, 'Delete every score, check and streak on this device?'), h('button', { class: 'btn danger', type: 'button', onclick: () => { resetScores(); resetBox.hidden = true; toast('Scores deleted.'); render(); } }, 'Delete scores'), h('button', { class: 'btn', type: 'button', onclick: () => { resetBox.hidden = true; } }, 'Keep them'));
  const engineBox = h('div', { class: 'stack tight', id: 'set-engine' }, engineCard(),
    h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', onclick: async () => { await model.forget(); toast('Model removed from this device.'); } }, 'Remove the model from this device')));
  body.replaceChildren(
    h('div', { class: 'grid2' }, h('label', { class: 'field', for: 'setL1' }, h('span', { class: 'eyebrow' }, 'Your first language'), l1), h('label', { class: 'field', for: 'setName' }, h('span', { class: 'eyebrow' }, 'Last name for practice lines'), name)),
    h('hr'),
    h('div', { class: 'grid2' }, h('label', { class: 'field', for: 'setVoice' }, h('span', { class: 'eyebrow' }, 'Model voice'), voice), h('div', { class: 'field' }, h('label', { class: 'eyebrow', for: 'setRate' }, 'Model speed'), h('div', { class: 'rangerow' }, rate, rateOut))),
    h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, 'Microphone'), h('div', { class: 'row' }, testBtn, testStatus), testCanvas,
      h('label', { class: 'check', for: 'setNoise' }, ns, h('span', {}, 'Noise reduction. Leave it off in a quiet room: it can blur soft sounds like /θ/, /f/ and /s/.'))),
    h('hr'), h('span', { class: 'eyebrow' }, 'Sound-by-sound scoring'), engineBox,
    h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, 'Feedback strictness'), strict, h('p', { class: 'fine' }, 'If clear sounds keep getting flagged, choose Lenient. Strict flags smaller accent features.')),
    h('hr'), coachSetup({}),
    h('hr'), h('div', { class: 'field' }, h('span', { class: 'eyebrow' }, 'Progress'), h('div', {}, h('button', { class: 'btn danger', type: 'button', onclick: () => { resetBox.hidden = false; } }, 'Reset all scores')), resetBox));
  try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); }
  if (focus === 'engine') setTimeout(() => engineBox.scrollIntoView({ block: 'center' }), 50);
  if (focus === 'coach') setTimeout(() => body.querySelector('#apikey') && body.querySelector('#apikey').scrollIntoView({ block: 'center' }), 50);
}
function closeSettings() { const d = $('#settings'); $$('*', d).forEach(el => el._cleanup && el._cleanup()); try { d.close(); } catch (e) { d.removeAttribute('open'); } render(); }

// First run
function onboarding() {
  let step = 0, l1 = store.profile.l1;
  const box = h('div', { class: 'onboard' });
  const draw = () => {
    if (step === 0) {
      const grid = h('div', { class: 'l1grid', role: 'group', 'aria-label': 'First language' }, L1.map(([k, n]) => h('button', { type: 'button', 'aria-pressed': String(l1 === k), onclick: () => { l1 = k; draw(); } }, n)));
      const name = h('input', { id: 'obName', class: 'text-in', value: store.profile.name || '', placeholder: 'Optional', autocomplete: 'family-name' });
      box.replaceChildren(h('span', { class: 'eyebrow' }, 'Accent Lab'), h('h1', {}, 'Train a clear American accent, one sound at a time.'),
        h('p', { class: 'muted prose' }, 'Record yourself and see which sounds landed, what each one sounded like instead, and how to fix it. Scoring runs on your device.'),
        h('div', { class: 'stack tight' }, h('span', { class: 'eyebrow' }, 'Your first language'), grid),
        h('label', { class: 'field', for: 'obName' }, h('span', { class: 'eyebrow' }, 'Last name, for lines like “Hi, I’m Doctor ___”'), name),
        h('div', {}, h('button', { class: 'btn primary lg', type: 'button', disabled: !l1, onclick: () => { store.profile.l1 = l1; store.profile.name = name.value.trim(); save(); step = 1; draw(); } }, 'Continue', icon('next'))));
    } else {
      box.replaceChildren(h('span', { class: 'eyebrow' }, 'One-time setup'), h('h1', {}, 'Download the sound model'),
        h('p', { class: 'muted prose' }, 'This is what checks each sound. It’s a large download, so use Wi-Fi. You can start practicing while it downloads.'),
        engineCard(),
        h('div', { class: 'row' }, h('button', { class: 'btn primary lg', type: 'button', onclick: () => { store.profile.onboarded = true; saveNow(); go('check', { replace: true }); } }, 'Take the accent check', icon('next')),
          h('button', { class: 'btn lg', type: 'button', onclick: () => { store.profile.onboarded = true; saveNow(); go('today', { replace: true }); } }, 'Skip to today’s plan')));
    }
  };
  draw();
  return box;
}

function boot() {
  const nav = $('#nav');
  nav.replaceChildren(...NAV.map(([v, l, ic]) => h('a', { href: '#' + v, 'data-v': v }, icon(ic), h('span', {}, l))));
  nav.addEventListener('click', e => { const a = e.target.closest('a'); if (!a) return; e.preventDefault(); go(a.dataset.v); });
  $('#openSettings').addEventListener('click', () => openSettings());
  $('#settingsClose').addEventListener('click', closeSettings);
  $('#settings').addEventListener('cancel', e => { e.preventDefault(); closeSettings(); });
  window.addEventListener('al:engine', () => openSettings('engine'));
  window.addEventListener('al:coachsetup', () => openSettings('coach'));
  audioSettings.noiseSuppression = !!store.set.noise;
  setStrictness(store.set.strict);
  tts.rate = store.set.rate; tts.wanted = store.set.voice; tts.init();
  engineChip();
  onMic(s => { if (s === 'blocked') $('#banner').hidden = false; });
  initCoach();
  model.checkCached().then(c => { if (c) model.load().catch(() => {}); });
  if (!(window.claude && window.claude.use) && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').then(() => {
      if (!self.crossOriginIsolated && navigator.serviceWorker.controller && !sessionStorage.getItem('coi-reload')) { sessionStorage.setItem('coi-reload', '1'); location.reload(); }
    }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!self.crossOriginIsolated && !sessionStorage.getItem('coi-reload')) { sessionStorage.setItem('coi-reload', '1'); location.reload(); } });
  }
  todayPlan();
  render();
}
boot();
