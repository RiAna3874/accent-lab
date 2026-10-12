// Main-thread client for the phoneme recognizer worker.
export const MODEL = {
  name: 'wav2vec2 phoneme recognizer',
  repo: 'onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX',
  url: (typeof window !== 'undefined' && window.__alModelUrl) || 'https://huggingface.co/onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX/resolve/c69750f5043e5e1f8a71ab95dd3b98338c280c92/onnx/model_q4.onnx',
  bytes: 241691639
};

let worker = null, seq = 0;
const pending = new Map();
const listeners = new Set();
export const state = { status: 'idle', backend: null, got: 0, total: MODEL.bytes, error: null, cached: null, lastMs: null };
const emit = () => listeners.forEach(f => { try { f(state); } catch (e) {} });
export const onState = f => { listeners.add(f); f(state); return () => listeners.delete(f); };

function w() {
  if (worker) return worker;
  worker = new Worker(new URL('./model.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'progress') { state.got = m.got; state.total = m.total || MODEL.bytes; state.status = m.fromCache ? 'opening' : 'downloading'; emit(); return; }
    if (m.type === 'status') { if (m.stage !== 'cpu') state.status = 'opening'; emit(); return; }
    const p = pending.get(m.id); if (!p) return; pending.delete(m.id);
    m.type === 'error' ? p.reject(new Error(m.message)) : p.resolve(m.value);
  };
  worker.onerror = (e) => { state.status = 'error'; state.error = e.message || 'The model worker failed to start.'; emit(); for (const p of pending.values()) p.reject(new Error(state.error)); pending.clear(); };
  return worker;
}
function call(cmd, data = {}, transfer = []) {
  return new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); w().postMessage({ id, cmd, ...data }, transfer); });
}

export async function checkCached() {
  try { state.cached = await call('cached', { url: MODEL.url }); } catch (e) { state.cached = false; }
  emit(); return state.cached;
}
let loading = null;
export function load(prefer) {
  if (state.status === 'ready') return Promise.resolve(state);
  if (loading) return loading;
  state.status = 'downloading'; state.error = null; emit();
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
  loading = call('load', { url: MODEL.url, prefer }).then(v => {
    state.status = 'ready'; state.backend = v.backend; state.cached = true; emit(); return state;
  }).catch(err => {
    state.status = 'error'; state.error = err.message; emit(); throw err;
  }).finally(() => { loading = null; });
  return loading;
}
export const ready = () => state.status === 'ready';
export async function infer(pcm16k) {
  const copy = pcm16k.slice();
  const r = await call('infer', { pcm: copy }, [copy.buffer]);
  state.lastMs = r.ms; if (r.backend) state.backend = r.backend; emit();
  return r;
}
export async function forget() { await call('forget'); state.status = 'idle'; state.cached = false; state.backend = null; emit(); }
