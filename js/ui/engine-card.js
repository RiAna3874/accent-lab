import { h, icon } from './dom.js';
import * as model from '../engine/model.js';

const mb = n => (n / 1048576).toFixed(0);
export function engineCard({ compactWhenReady = false } = {}) {
  const box = h('section', { class: 'panel' });
  const render = (s) => {
    if (s.status === 'ready' && compactWhenReady) { box.hidden = true; return; }
    box.hidden = false;
    const glyph = h('div', { class: 'glyph', 'aria-hidden': 'true' }, 'θ');
    let body;
    if (s.status === 'ready') {
      body = h('div', { class: 'stack tight' }, h('h3', {}, 'Sound-by-sound scoring is on'), h('p', { class: 'muted' }, `Running on this device with ${s.backend === 'webgpu' ? 'the GPU' : 'the CPU'}${s.lastMs ? `; last check took ${(s.lastMs / 1000).toFixed(1)} s` : ''}. Recordings never leave your device.`));
    } else if (s.status === 'downloading' || s.status === 'opening') {
      const pct = s.total ? Math.round(s.got / s.total * 100) : 0;
      body = h('div', { class: 'stack tight' }, h('h3', {}, s.status === 'opening' ? 'Starting the sound model…' : 'Downloading the sound model…'),
        h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('span', { style: { width: (s.status === 'opening' ? 100 : pct) + '%' } })),
        h('p', { class: 'fine' }, s.status === 'opening' ? 'Preparing it for your device. This takes a few seconds the first time.' : `${mb(s.got)} of ${mb(s.total)} MB. You can keep practicing; whole words are checked until it finishes.`));
    } else if (s.status === 'error') {
      body = h('div', { class: 'stack tight' }, h('h3', {}, 'The sound model didn’t start'), h('p', { class: 'muted' }, friendly(s.error)),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => model.load().catch(() => {}) }, 'Try again'), h('button', { class: 'btn', type: 'button', onclick: () => model.load('wasm').catch(() => {}) }, 'Try without the GPU')));
    } else {
      body = h('div', { class: 'stack tight prose' }, h('h3', {}, 'Turn on sound-by-sound scoring'),
        h('p', { class: 'muted' }, `Downloads a speech model (${mb(model.MODEL.bytes)} MB) once. After that it runs offline on this device, scores every sound you say, and tells you what each one sounded like. Use Wi-Fi.`),
        h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => model.load().catch(() => {}) }, icon('download'), `Download (${mb(model.MODEL.bytes)} MB)`)),
        h('p', { class: 'fine' }, 'Model: wav2vec2 phoneme recognizer (Meta AI, Apache 2.0), converted for the browser by the ONNX Community.'));
    }
    box.replaceChildren(h('div', { class: 'engine' }, glyph, body));
  };
  const off = model.onState(render);
  box._cleanup = off;
  return box;
}
function friendly(e) {
  if (!e) return 'Unknown error.';
  if (/download_failed|Failed to fetch|NetworkError|network/i.test(e)) return 'The download was interrupted. Check your connection and try again.';
  if (/memory|OOM|allocation/i.test(e)) return 'This device ran out of memory loading the model. Close other tabs and try again, or practice with word-level checks.';
  if (/quota/i.test(e)) return 'Not enough storage space on this device to keep the model.';
  return e;
}
