// Runs the phoneme recognizer off the main thread.
import * as ort from '../../vendor/ort/ort.webgpu.min.mjs';
import { logSoftmax } from './scoring.js';

const CACHE = 'accentlab-model-v1';
let session = null, backend = null, inName = 'input_values', maskName = null, outName = 'logits', V = 392;

ort.env.wasm.wasmPaths = new URL('../../vendor/ort/', import.meta.url).href;
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)) : 1;
ort.env.logLevel = 'error';

const post = (type, data = {}, transfer) => self.postMessage({ type, ...data }, transfer || []);

async function cachedBytes(url, onProgress) {
  let cache = null;
  try { cache = await caches.open(CACHE); } catch (e) { cache = null; }
  if (cache) {
    const hit = await cache.match(url);
    if (hit) { onProgress(1, 1, true); return new Uint8Array(await hit.arrayBuffer()); }
  }
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error('download_failed_' + res.status);
  const total = +res.headers.get('content-length') || 0;
  if (cache && res.body && res.body.tee) {
    const [a, b] = res.body.tee();
    const putting = cache.put(url, new Response(a, { headers: { 'content-type': 'application/octet-stream', 'content-length': String(total || '') } }));
    const reader = b.getReader(); let got = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; got += value.byteLength; onProgress(got, total, false); }
    await putting;
    const hit = await cache.match(url);
    if (hit) return new Uint8Array(await hit.arrayBuffer());
  }
  const reader = res.body.getReader(); const chunks = []; let got = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.byteLength; onProgress(got, total, false); }
  const out = new Uint8Array(got); let o = 0; for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}

async function isCached(url) {
  try { const c = await caches.open(CACHE); return !!(await c.match(url)); } catch (e) { return false; }
}

let modelUrl = null;
async function createSession(bytes, ep) {
  const s = await ort.InferenceSession.create(bytes, { executionProviders: [ep], graphOptimizationLevel: 'all' });
  inName = s.inputNames.find(n => /input/.test(n)) || s.inputNames[0];
  maskName = s.inputNames.find(n => /mask/.test(n)) || null;
  outName = s.outputNames.find(n => /logit/.test(n)) || s.outputNames[0];
  return s;
}
// If the GPU path fails at run time, rebuild on the CPU from the cached file and carry on.
async function fallbackToCpu() {
  post('status', { stage: 'cpu' });
  const bytes = await cachedBytes(modelUrl, () => {});
  session = await createSession(bytes, 'wasm'); backend = 'wasm';
}
async function load(url, prefer) {
  modelUrl = url;
  let last = 0;
  const bytes = await cachedBytes(url, (got, total, fromCache) => {
    const now = Date.now(); if (now - last < 150 && got !== total) return; last = now;
    post('progress', { got, total, fromCache });
  });
  post('status', { stage: 'init' });
  const tries = [];
  if (prefer !== 'wasm' && self.navigator && navigator.gpu) tries.push('webgpu');
  tries.push('wasm');
  let err = null;
  for (const ep of tries) {
    try { session = await createSession(bytes, ep); backend = ep; break; }
    catch (e) { err = e; session = null; }
  }
  if (!session) throw err || new Error('no_backend');
  // Warm up (compiles GPU shaders) on half a second of silence.
  await safeInfer(new Float32Array(8000));
  return { backend, threads: ort.env.wasm.numThreads, inputs: session.inputNames, outputs: session.outputNames };
}

async function infer(pcm) {
  const n = pcm.length;
  let mean = 0; for (let i = 0; i < n; i++) mean += pcm[i]; mean /= n;
  let v = 0; for (let i = 0; i < n; i++) { const d = pcm[i] - mean; v += d * d; } v /= n;
  const sd = Math.sqrt(v + 1e-7);
  const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = (pcm[i] - mean) / sd;
  const feeds = { [inName]: new ort.Tensor('float32', x, [1, n]) };
  if (maskName) feeds[maskName] = new ort.Tensor('int64', new BigInt64Array(n).fill(1n), [1, n]);
  const out = await session.run(feeds);
  const t = out[outName];
  const T = t.dims[1]; V = t.dims[2];
  let data = t.data;
  if (!(data instanceof Float32Array)) data = Float32Array.from(data);
  return { logp: logSoftmax(data, T, V), T, V };
}

async function safeInfer(pcm) {
  try { return await infer(pcm); }
  catch (e) { if (backend !== 'webgpu') throw e; await fallbackToCpu(); return infer(pcm); }
}

self.onmessage = async (e) => {
  const { id, cmd } = e.data;
  try {
    if (cmd === 'cached') return post('result', { id, value: await isCached(e.data.url) });
    if (cmd === 'load') return post('result', { id, value: await load(e.data.url, e.data.prefer) });
    if (cmd === 'infer') {
      if (!session) throw new Error('not_loaded');
      const t0 = performance.now();
      const r = await safeInfer(e.data.pcm);
      return post('result', { id, value: { ...r, ms: Math.round(performance.now() - t0), backend } }, [r.logp.buffer]);
    }
    if (cmd === 'forget') { try { await caches.delete(CACHE); } catch (x) {} session = null; return post('result', { id, value: true }); }
  } catch (err) {
    post('error', { id, message: String(err && err.message || err) });
  }
};
