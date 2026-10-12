// Word-level checking with the browser's speech recognizer, used until the sound model is downloaded.
const ONES = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const TENS = ['', '', 'twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
const n2w = n => n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '') : n < 1000 ? ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + n2w(n % 100) : '') : String(n);
export function normText(s) {
  return String(s).toLowerCase().replace(/(\d+)\s*%/g, '$1 percent').replace(/\d+/g, m => +m < 1000 ? n2w(+m) : m)
    .replace(/[’']/g, '').replace(/[-–—/]/g, ' ').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}
function align(ref, hyp) {
  const n = ref.length, m = hyp.length, D = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) D[i][0] = i; for (let j = 0; j <= m; j++) D[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) D[i][j] = Math.min(D[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1), D[i - 1][j] + 1, D[i][j - 1] + 1);
  let i = n, j = m; const ops = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1)) { ops.push({ type: ref[i - 1] === hyp[j - 1] ? 'ok' : 'sub', ri: i - 1, hyp: hyp[j - 1] }); i--; j--; }
    else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { ops.push({ type: 'miss', ri: i - 1 }); i--; }
    else { ops.push({ type: 'extra', hyp: hyp[j - 1] }); j--; }
  }
  return ops.reverse();
}
// words: display words; heard: recognizer text → per-word status.
export function scoreWords(words, heard) {
  const ref = [], owner = [];
  words.forEach((w, i) => normText(w).forEach(x => { ref.push(x); owner.push(i); }));
  const status = words.map(() => ({ s: 'ok', heard: [] }));
  let ok = 0;
  for (const o of align(ref, normText(heard))) {
    if (o.type === 'ok') { ok++; continue; } if (o.type === 'extra') continue;
    const st = status[owner[o.ri]]; if (o.type === 'miss') st.s = 'miss'; else { if (st.s !== 'miss') st.s = 'sub'; st.heard.push(o.hyp); }
  }
  return { pct: ref.length ? Math.round(ok / ref.length * 100) : 0, status };
}
export function heardWord(text, target, partner) {
  const forms = s => s ? s.split('|').map(x => normText(x).join(' ')) : [];
  const T = forms(target), P = forms(partner), top = normText(text).join(' ');
  const has = (t, fs) => fs.some(f => (' ' + t + ' ').includes(' ' + f + ' '));
  return has(top, T) ? 'hit' : P.length && has(top, P) ? 'swap' : 'other';
}
