// Microphone capture (raw PCM), resampling to 16 kHz, playback, and pitch/energy analysis.

let ctx = null, stream = null, workletReady = null;
export const mic = { state: 'unknown' };   // unknown | ready | denied | unsupported | blocked
const micListeners = new Set();
export const onMic = f => { micListeners.add(f); f(mic.state); return () => micListeners.delete(f); };
function setMic(s) { mic.state = s; micListeners.forEach(f => f(s)); }

export function audioCtx() {
  if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; ctx = new AC(); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const settings = { noiseSuppression: false };

export async function getStream() {
  if (stream && stream.active) return stream;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { setMic('unsupported'); throw new Error('unsupported'); }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: settings.noiseSuppression, autoGainControl: true, channelCount: 1 } });
  } catch (e) {
    setMic(e && (e.name === 'NotAllowedError' || e.name === 'SecurityError') ? (document.featurePolicy && !document.featurePolicy.allowsFeature('microphone') ? 'blocked' : 'denied') : 'unsupported');
    throw e;
  }
  setMic('ready');
  return stream;
}
export function releaseStream() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }

const WORKLET = `class Cap extends AudioWorkletProcessor{constructor(){super();this.on=true;this.port.onmessage=e=>{if(e.data==='stop')this.on=false}}process(i){const c=i[0]&&i[0][0];if(c&&this.on)this.port.postMessage(c.slice(0));return this.on}}registerProcessor('cap',Cap);`;
async function ensureWorklet(c) {
  if (!c.audioWorklet) return false;
  if (!workletReady) workletReady = c.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }))).then(() => true, () => false);
  return workletReady;
}

// YIN pitch estimate for one frame.
export function yin(x, sr) {
  const maxLag = Math.min(Math.floor(sr / 65), x.length - 260), minLag = Math.floor(sr / 420);
  const W = Math.min(512, x.length - maxLag - 1);
  if (W < 128 || maxLag <= minLag) return { f0: 0, clar: 0 };
  const c = new Float32Array(maxLag + 1); let run = 0; c[0] = 1;
  for (let tau = 1; tau <= maxLag; tau++) { let s = 0; for (let j = 0; j < W; j++) { const d = x[j] - x[j + tau]; s += d * d; } run += s; c[tau] = run ? s * tau / run : 1; }
  let t = -1;
  for (let tau = minLag; tau <= maxLag; tau++) if (c[tau] < 0.15) { while (tau + 1 <= maxLag && c[tau + 1] < c[tau]) tau++; t = tau; break; }
  if (t < 0) { let mi = minLag; for (let tau = minLag; tau <= maxLag; tau++) if (c[tau] < c[mi]) mi = tau; if (c[mi] < 0.3) t = mi; else return { f0: 0, clar: 1 - c[mi] }; }
  let tf = t;
  if (t > 1 && t < maxLag) { const a = c[t - 1], b = c[t], d = c[t + 1], den = a + d - 2 * b; if (den) tf = t + (a - d) / (2 * den); }
  return { f0: sr / tf, clar: 1 - c[t] };
}

// Live scrolling trace: level bars + pitch dots.
export function liveTrace(canvas, winSec = 5, colors) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.max(200, canvas.clientWidth || 300), H = Math.max(36, canvas.clientHeight || 56);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pts = [];
  return (f) => {
    pts.push(f); const span = Math.max(winSec, f.t * 1.05);
    g.clearRect(0, 0, W, H);
    g.fillStyle = colors.level; const bw = Math.max(1.5, W / (span * 45));
    for (const p of pts) { const lv = Math.max(0, Math.min(1, (p.db + 65) / 50)); g.fillRect(p.t / span * W, (H - lv * H * 0.6) / 2 + H * 0.2, bw, lv * H * 0.6); }
    g.fillStyle = colors.pitch;
    for (const p of pts) if (p.f0 > 0 && p.clar > 0.6 && p.db > -50) { const y = H - 4 - (Math.log(p.f0 / 65) / Math.log(420 / 65)) * (H - 8); g.beginPath(); g.arc(p.t / span * W, Math.max(3, Math.min(H - 3, y)), 2, 0, 6.283); g.fill(); }
  };
}

// Record until silence after speech, max length, or stop().
export async function record({ maxSec = 12, silenceSec = 1.2, onFrame, onSpeech } = {}) {
  const st = await getStream();
  const c = audioCtx();
  const src = c.createMediaStreamSource(st);
  const an = c.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0;
  src.connect(an);
  const chunks = []; let node = null, sp = null;
  const sink = c.createGain(); sink.gain.value = 0; sink.connect(c.destination);
  if (await ensureWorklet(c)) {
    node = new AudioWorkletNode(c, 'cap');
    node.port.onmessage = e => chunks.push(e.data);
    src.connect(node); node.connect(sink);
  } else {
    sp = c.createScriptProcessor(4096, 1, 1);
    sp.onaudioprocess = e => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(sp); sp.connect(sink);
  }
  const buf = new Float32Array(an.fftSize), dec = new Float32Array(an.fftSize / 2);
  const t0 = c.currentTime;
  let raf = 0, done = false, noise = Infinity, speechAt = null, lastLoud = 0, run = 0, resolveStop;
  const stopped = new Promise(r => resolveStop = r);
  const finish = why => { if (!done) { done = true; cancelAnimationFrame(raf); resolveStop(why); } };
  const tick = () => {
    if (done) return;
    an.getFloatTimeDomainData(buf);
    let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    for (let i = 0; i < dec.length; i++) dec[i] = (buf[2 * i] + buf[2 * i + 1]) * 0.5;
    const db = 10 * Math.log10(s / buf.length + 1e-12), t = c.currentTime - t0;
    let f0 = 0, clar = 0; if (db > -58) { const r = yin(dec, c.sampleRate / 2); f0 = r.f0; clar = r.clar; }
    if (t < 0.3) noise = Math.min(noise, db);
    const thr = t < 0.3 ? -45 : Math.max(-54, Math.min(-28, noise + 13));
    if (db > thr) { run++; if (run >= 3 && speechAt == null) { speechAt = t; onSpeech && onSpeech(); } lastLoud = t; } else run = 0;
    onFrame && onFrame({ t, db, f0, clar, thr });
    if (speechAt != null && t - lastLoud > silenceSec) return finish('silence');
    if (speechAt == null && t > 7) return finish('nospeech');
    if (t > maxSec) return finish('max');
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  const result = (async () => {
    const why = await stopped;
    await new Promise(r => setTimeout(r, 120));
    try { src.disconnect(); an.disconnect(); if (node) { node.port.postMessage('stop'); node.disconnect(); } if (sp) sp.disconnect(); sink.disconnect(); } catch (e) {}
    const n = chunks.reduce((a, x) => a + x.length, 0);
    const raw = new Float32Array(n); let o = 0; for (const x of chunks) { raw.set(x, o); o += x.length; }
    return finishClip(raw, c.sampleRate, why, speechAt != null);
  })();
  return { stop: () => finish('user'), result };
}

export async function resample(x, sr, to = 16000) {
  if (sr === to) return x.slice();
  const len = Math.max(1, Math.ceil(x.length * to / sr));
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  try {
    const oc = new OAC(1, len, to);
    const b = oc.createBuffer(1, x.length, sr); b.copyToChannel ? b.copyToChannel(x, 0) : b.getChannelData(0).set(x);
    const s = oc.createBufferSource(); s.buffer = b; s.connect(oc.destination); s.start();
    const r = await oc.startRendering();
    return r.getChannelData(0).slice();
  } catch (e) {
    // Fallback: box-filter then linear interpolation.
    const ratio = sr / to, k = Math.max(1, Math.round(ratio)), out = new Float32Array(len);
    for (let i = 0; i < len; i++) { const p = i * ratio, j = Math.floor(p); let acc = 0, m = 0; for (let q = 0; q < k && j + q < x.length; q++) { acc += x[j + q]; m++; } out[i] = m ? acc / m : 0; }
    return out;
  }
}

// Energy (dB) and pitch every 10 ms on 16 kHz audio.
export function analyze(x16) {
  const sr = 16000, hop = 160, win = 1024, frames = [];
  for (let i = 0; i + win <= x16.length; i += hop) {
    let s = 0; for (let k = 0; k < win; k++) s += x16[i + k] * x16[i + k];
    const db = 10 * Math.log10(s / win + 1e-12);
    let f0 = 0, clar = 0;
    if (db > -58) { const r = yin(x16.subarray(i, i + win), sr); f0 = r.f0; clar = r.clar; }
    frames.push({ t: (i + win / 2) / sr, db, f0, clar });
  }
  return frames;
}

// Package a recording: trimmed 16 kHz PCM for the model plus analysis.
export async function finishClip(raw, sr, why = 'upload', heard = true) {
  const x16 = await resample(raw, sr, 16000);
  const frames = analyze(x16);
  const dbs = frames.map(f => f.db).sort((a, b) => a - b);
  const q = p => dbs.length ? dbs[Math.min(dbs.length - 1, Math.max(0, Math.round(p * (dbs.length - 1))))] : -90;
  const thr = Math.min(Math.max(q(0.1) + 13, -54), q(0.97) - 12, -26);
  let first = -1, last = -1, run = 0;
  frames.forEach((f, i) => { if (f.db > thr) { run++; if (run >= 3 && first < 0) first = i - 2; last = i; } else run = 0; });
  const speech = first >= 0 && last - first >= 8;
  const t0 = speech ? Math.max(0, frames[first].t - 0.3) : 0;
  const t1 = speech ? Math.min(x16.length / 16000, frames[last].t + 0.35) : x16.length / 16000;
  const pcm = x16.slice(Math.floor(t0 * 16000), Math.ceil(t1 * 16000));
  const peak = q(1);
  return {
    pcm, offset: t0, dur: pcm.length / 16000, frames: frames.filter(f => f.t >= t0 && f.t <= t1).map(f => ({ ...f, t: f.t - t0 })),
    thr, speech: speech && heard, why, peakDb: peak, clipped: raw.some ? raw.some(v => Math.abs(v) > 0.995) : false,
    raw, rawSr: sr
  };
}

export async function decodeFile(file) {
  const c = audioCtx();
  const arr = await file.arrayBuffer();
  const ab = await new Promise((res, rej) => { const p = c.decodeAudioData(arr, res, rej); if (p && p.then) p.then(res, rej); });
  const n = Math.min(ab.length, Math.round(ab.sampleRate * 60));
  const x = new Float32Array(n);
  for (let ch = 0; ch < ab.numberOfChannels; ch++) { const d = ab.getChannelData(ch); for (let i = 0; i < n; i++) x[i] += d[i] / ab.numberOfChannels; }
  return finishClip(x, ab.sampleRate, 'upload', true);
}

// Playback of a clip (or a slice of it, in seconds relative to clip start).
let playing = null;
export function playClip(clip, from = 0, to = null, rate = 1) {
  stopPlayback();
  const c = audioCtx();
  const b = c.createBuffer(1, clip.pcm.length, 16000);
  b.getChannelData(0).set(clip.pcm);
  const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
  const g = c.createGain(); g.gain.value = 1;
  s.connect(g); g.connect(c.destination);
  const a = Math.max(0, from), d = to != null ? Math.max(0.05, to - a) : undefined;
  s.start(0, a, d);
  playing = s;
  return new Promise(r => { s.onended = () => { if (playing === s) playing = null; r(); }; });
}
export function stopPlayback() { if (playing) { try { playing.stop(); } catch (e) {} playing = null; } }

// Smoothed pitch contour in semitones relative to the speaker's median, limited to voiced speech.
export function pitchContour(frames, t0 = 0, t1 = Infinity) {
  let v = frames.filter(f => f.t >= t0 && f.t <= t1 && f.f0 >= 65 && f.f0 <= 420 && f.clar >= 0.6 && f.db > -50);
  if (v.length < 5) return { pts: [], med: 0, range: 0 };
  const sorted = v.map(f => f.f0).sort((a, b) => a - b);
  const med = sorted[sorted.length >> 1];
  v = v.filter(f => Math.abs(12 * Math.log2(f.f0 / med)) <= 10);
  const st = v.map(f => 12 * Math.log2(f.f0 / med));
  const sm = st.map((x, i) => { const w = st.slice(Math.max(0, i - 2), i + 3).sort((a, b) => a - b); return w[w.length >> 1]; });
  const ss = [...sm].sort((a, b) => a - b);
  const qq = p => ss[Math.max(0, Math.min(ss.length - 1, Math.round(p * (ss.length - 1))))];
  return { pts: v.map((f, i) => ({ t: f.t, st: sm[i] })), med, range: qq(0.9) - qq(0.1) };
}
