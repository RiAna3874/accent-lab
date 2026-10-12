// Real-time vowel formants (F1, F2) by LPC, for the vowel mirror.
function lpc(x, order) {
  const n = x.length, r = new Float64Array(order + 1);
  for (let k = 0; k <= order; k++) { let s = 0; for (let i = k; i < n; i++) s += x[i] * x[i - k]; r[k] = s; }
  if (r[0] <= 0) return null;
  r[0] *= 1.0001;
  const a = new Float64Array(order + 1); a[0] = 1; let e = r[0];
  for (let i = 1; i <= order; i++) {
    let acc = r[i]; for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
    const k = -acc / e; const prev = a.slice();
    for (let j = 1; j < i; j++) a[j] = prev[j] + k * prev[i - j];
    a[i] = k; e *= (1 - k * k); if (e <= 0) return null;
  }
  return a;
}
// Roots of polynomial a[0] z^n + a[1] z^(n-1) + ... (Durand–Kerner).
function roots(a) {
  const n = a.length - 1, c = Array.from(a, v => v / a[0]);
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) { const ang = 2 * Math.PI * i / n + 0.4; re[i] = 0.9 * Math.cos(ang); im[i] = 0.9 * Math.sin(ang); }
  for (let it = 0; it < 120; it++) {
    let moved = 0;
    for (let i = 0; i < n; i++) {
      let pr = 1, pi = 0;
      for (let k = 1; k <= n; k++) { const tr = pr * re[i] - pi * im[i] + c[k]; const ti = pr * im[i] + pi * re[i]; pr = tr; pi = ti; }
      let dr = 1, di = 0;
      for (let j = 0; j < n; j++) if (j !== i) { const xr = re[i] - re[j], xi = im[i] - im[j]; const tr = dr * xr - di * xi; di = dr * xi + di * xr; dr = tr; }
      const den = dr * dr + di * di || 1e-12;
      const qr = (pr * dr + pi * di) / den, qi = (pi * dr - pr * di) / den;
      re[i] -= qr; im[i] -= qi; moved += Math.abs(qr) + Math.abs(qi);
    }
    if (moved < 1e-9) break;
  }
  return Array.from({ length: n }, (_, i) => [re[i], im[i]]);
}
// x: time-domain frame at sample rate sr. Returns {f1, f2} or null.
export function formants(x, sr) {
  const target = 11025, step = Math.max(1, Math.round(sr / target)), fs = sr / step;
  const m = Math.floor(x.length / step);
  if (m < 256) return null;
  const y = new Float64Array(m);
  for (let i = 0; i < m; i++) { let s = 0; for (let q = 0; q < step; q++) s += x[i * step + q]; y[i] = s / step; }
  for (let i = m - 1; i > 0; i--) y[i] -= 0.63 * y[i - 1];
  for (let i = 0; i < m; i++) y[i] *= 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (m - 1));
  const a = lpc(y, 12); if (!a) return null;
  const fr = [];
  for (const [r, i] of roots(a)) {
    if (i <= 0) continue;
    const f = Math.atan2(i, r) * fs / (2 * Math.PI), mag = Math.hypot(r, i), bw = -Math.log(mag) * fs / Math.PI;
    if (f > 180 && f < 4000 && bw > 0 && bw < 500) fr.push(f);
  }
  fr.sort((p, q) => p - q);
  const f1 = fr.find(f => f >= 220 && f <= 1100);
  const f2 = fr.find(f => f > (f1 || 0) + 180 && f >= 650 && f <= 3100);
  return f1 && f2 ? { f1, f2 } : null;
}
// Hillenbrand et al. (1995) average American English vowels (Hz): [F1, F2] for adult men and women.
export const VOWEL_TARGETS = {
  men:   { 'i': [342, 2322], 'ɪ': [427, 2034], 'eɪ': [476, 2089], 'ɛ': [580, 1799], 'æ': [588, 1952], 'ɑ': [768, 1333], 'ɔ': [652, 997], 'oʊ': [497, 910], 'ʊ': [469, 1122], 'u': [378, 997], 'ʌ': [623, 1200], 'ɝ': [474, 1379] },
  women: { 'i': [437, 2761], 'ɪ': [483, 2365], 'eɪ': [536, 2530], 'ɛ': [731, 2058], 'æ': [669, 2349], 'ɑ': [936, 1551], 'ɔ': [781, 1136], 'oʊ': [555, 1035], 'ʊ': [519, 1225], 'u': [459, 1105], 'ʌ': [753, 1426], 'ɝ': [523, 1588] }
};
