// Sound drills: ear test, minimal pairs (scored per sound), word ladder, vowel mirror.
import { h, icon, pick, grade, clamp, tokColor, toast } from './dom.js';
import { UMAP, first } from '../data/sounds.js';
import { UNIT, HEARD_NAME } from '../engine/phones.js';
import { tts } from '../engine/speech.js';
import { getStream, audioCtx, yin, playClip, stopPlayback } from '../engine/audio.js';
import { formants, VOWEL_TARGETS } from '../engine/formants.js';
import { heardWord } from '../engine/fallback.js';
import { recorderUI, assess, stopActive } from './recorder.js';
import { recordEar, recordPhones, recordSay, logDay, store, markStep, review } from '../store.js';

const sayWord = w => tts.speak(first(w), { rate: Math.max(0.78, tts.rate - 0.05) });
const allPairs = u => u.partners.flatMap(p => p.pairs.map(pr => ({ pair: pr, partner: p.id })));

export function earTest(u, { onFinish } = {}) {
  const N = 8, box = h('div', { class: 'drill-body' });
  const pool = allPairs(u);
  let round = 0, cur = null, done = false; const marks = [];
  if (!pool.length) { box.append(h('p', { class: 'muted' }, 'This sound has no minimal pairs. Use the word ladder instead.')); return box; }
  const draw = () => {
    box.replaceChildren();
    if (!cur) { box.append(h('div', { class: 'stack prose' }, h('p', {}, `You’ll hear ${N} words. Each comes from a pair like “${first(pool[0].pair[0])}” and “${first(pool[0].pair[1])}”. Pick the one you heard. Hearing the difference first makes it easier to say.`), h('div', {}, h('button', { class: 'btn primary', type: 'button', onclick: next }, icon('play'), 'Start ear test')))); return; }
    if (done) {
      const right = marks.filter(m => m === 'g').length;
      box.append(h('div', { class: 'final' }, h('span', { class: 'eyebrow' }, 'Ear test score'), h('span', { class: 'big' }, `${right} / ${N}`),
        h('p', { class: 'muted' }, right === N ? 'Perfect. Move on to saying the pairs.' : right >= 6 ? 'Good ear. Replay the ones you missed and listen for length and lip shape.' : 'These still sound alike to you. Run it again before practicing speech.'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => { round = 0; cur = null; done = false; marks.length = 0; next(); } }, 'Run it again')));
      return;
    }
    const ip = k => k === 0 ? u.ipa : (UMAP[cur.partner] ? UMAP[cur.partner].ipa : '');
    const dots = h('span', { class: 'dots', 'aria-hidden': 'true' }, Array.from({ length: N }, (_, i) => h('i', { class: i < marks.length ? marks[i] : i === round - 1 ? 'c' : '' })));
    const choices = h('div', { class: 'choices' }, [0, 1].map(k => {
      const b = h('button', { class: 'choice', type: 'button', onclick: () => answer(k) }, h('span', { class: 'cw' }, first(cur.pair[k])), h('span', { class: 'csym' }, '/' + ip(k) + '/'));
      if (cur.answered) { b.disabled = true; if (k === cur.which) b.classList.add('right'); else if (k === cur.pick) b.classList.add('wrong'); }
      return b;
    }));
    const ok = cur.answered && cur.pick === cur.which;
    box.append(h('div', { class: 'ear-head' }, h('span', { class: 'mono' }, `Word ${round} of ${N}`), h('span', { class: 'mono muted' }, `${marks.filter(m => m === 'g').length} correct`), dots),
      h('button', { class: 'bigplay', type: 'button', onclick: () => sayWord(cur.pair[cur.which]) }, icon('play'), 'Play again'), choices,
      cur.answered ? h('div', { class: 'fb ' + (ok ? 'good' : 'bad') }, h('span', {}, ok ? 'Correct.' : `It was “${first(cur.pair[cur.which])}”.`), h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => { sayWord(cur.pair[0]); setTimeout(() => sayWord(cur.pair[1]), 1100); } }, 'Hear both'), h('button', { class: 'btn', type: 'button', onclick: next }, round >= N ? 'See score' : 'Next word', icon('next')))) : h('div', { class: 'fb muted' }, 'Listen, then choose.'));
  };
  function next() { if (round >= N) { done = true; draw(); markStep('ear'); onFinish && onFinish(); return; } const p = pick(pool); cur = { pair: p.pair, partner: p.partner, which: Math.random() < 0.5 ? 0 : 1, answered: false }; round++; draw(); sayWord(cur.pair[cur.which]); }
  function answer(k) { if (cur.answered) return; cur.answered = true; cur.pick = k; const ok = k === cur.which; marks.push(ok ? 'g' : 'b'); recordEar(u.id, ok); logDay(); draw(); }
  draw();
  return box;
}

// Did the learner hit the target sound in a one-word attempt?
export function pairVerdict(a, u, partnerId, target, partnerWord) {
  if (a.kind === 'phones') {
    const w = a.res.words[0]; if (!w) return { v: 'none' };
    const rel = w.phones.filter(p => p.unit === u.id);
    const use = rel.length ? rel : w.phones;
    const score = Math.round(use.reduce((s, p) => s + p.score, 0) / use.length);
    const bad = use.filter(p => p.status !== 'ok');
    if (!bad.length && score >= 60) return { v: 'hit', score, w };
    const swap = bad.find(p => p.heard && (UNIT[p.heard] === partnerId));
    if (swap) return { v: 'swap', p: swap, score, w };
    return { v: bad.length && bad[0].status === 'near' ? 'near' : 'miss', p: bad[0], score, w };
  }
  if (a.kind === 'words') { const v = heardWord(a.heard, target, partnerWord); return { v: v === 'hit' ? 'hit' : v === 'swap' ? 'swap' : 'miss', heard: a.heard, score: v === 'hit' ? 90 : v === 'swap' ? 20 : 45 }; }
  return { v: 'none' };
}

export function sayPairs(u, { onFinish } = {}) {
  const box = h('div', { class: 'drill-body' });
  const pool = allPairs(u);
  if (!pool.length) { box.append(h('p', { class: 'muted' }, 'This sound has no minimal pairs. Use the word ladder.')); return box; }
  let pi = 0, side = 0, last = null; const marks = {};
  const draw = () => {
    stopActive();
    const { pair, partner } = pool[pi];
    const tw = first(pair[side]), pw = first(pair[1 - side]);
    const tid = side === 0 ? u.id : partner, pid = side === 0 ? partner : u.id;
    const tu = UMAP[tid] || u, pu = UMAP[pid];
    const card = h('div', { class: 'say-card' }, h('span', { class: 'eyebrow' }, 'Say this word'), h('div', { class: 'say-word' }, tw),
      h('p', { class: 'say-sub' }, h('span', { class: 'ipa' }, '/' + tu.ipa + '/'), ` · not “${pw}” `, pu ? h('span', { class: 'ipa muted' }, '/' + pu.ipa + '/') : null),
      h('div', { class: 'row center' }, h('button', { class: 'btn', type: 'button', onclick: () => sayWord(tw) }, icon('play'), 'Hear it'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { side = 1 - side; last = null; draw(); } }, icon('swap'), `Say “${pw}” instead`),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { pi = (pi + 1) % pool.length; side = Math.random() < 0.5 ? 0 : 1; last = null; draw(); } }, 'Next pair', icon('next'))));
    const rec = recorderUI({ mode: 'word', label: `Tap the mic, then say “${tw}”`, compact: true, onDone: async (clip, recog) => {
      const a = await assess(tw, clip, recog);
      const v = pairVerdict(a, tu, pid, pair[side], pair[1 - side]);
      if (a.kind === 'phones') recordPhones(a.res); else if (v.v !== 'none') recordSay(tu.id, v.score);
      if (v.v !== 'none') { marks[pi + '-' + side] = v.v === 'hit'; logDay(); review('word', tw, v.score); }
      if (Object.keys(marks).length >= 6) { markStep('pairs'); if (Object.keys(marks).length >= 10) markStep('pairs2'); onFinish && onFinish(); }
      last = { a, v, tw, pw, tu, pu }; draw();
    } });
    const parts = [card, rec];
    if (last) parts.push(pairResult(last));
    parts.push(h('div', { class: 'pills', style: { marginTop: '12px' } }, pool.map((p, k) => {
      const m0 = marks[k + '-0'], m1 = marks[k + '-1'];
      return h('button', { class: 'pill', type: 'button', 'aria-current': String(k === pi), onclick: () => { pi = k; last = null; draw(); } }, first(p.pair[0]) + ' / ' + first(p.pair[1]), m0 === true || m1 === true ? h('span', { style: { color: 'var(--good)' } }, ' ✓') : m0 === false || m1 === false ? h('span', { style: { color: 'var(--bad)' } }, ' ✕') : null);
    })));
    box.replaceChildren(...parts);
  };
  draw();
  return box;
}
function pairResult({ a, v, tw, pw, tu, pu }) {
  const model = () => new Promise(r => tts.speak(tw, { rate: 0.8, onend: r }));
  const you = a.clip ? () => playClip(a.clip) : null;
  let cls = 'warn', head, body = '';
  if (v.v === 'none') { head = a.reason === 'nospeech' ? 'No speech came through.' : 'Couldn’t score this take.'; body = a.error || 'Say the word once, clearly, about a hand’s width from the mic.'; }
  else if (v.v === 'hit') { cls = 'good'; head = `Clear /${tu.ipa}/ in “${tw}”${v.score != null && a.kind === 'phones' ? ` (${v.score})` : ''}.`; body = `Now switch to “${pw}” and make the contrast obvious.`; }
  else if (v.v === 'swap') { cls = 'bad'; head = a.kind === 'phones' ? `That came out as /${pu ? pu.ipa : v.p.heardShow}/, so it sounded like “${pw}”.` : `Heard “${v.heard}”. That’s the other word.`; body = tu.how[0]; }
  else if (v.p) { head = v.p.heard === '∅' ? `/${v.p.show}/ was missing.` : `/${v.p.show}/ sounded like ${HEARD_NAME[v.p.heard] || '/' + v.p.heardShow + '/'}.`; body = (tu.slip && tu.slip[store.profile.l1]) || tu.how[1] || tu.how[0]; cls = v.v === 'near' ? 'warn' : 'bad'; }
  else { head = `Heard “${v.heard || 'something else'}”.`; body = 'Say it a little slower, with the word on its own.'; }
  const phs = a.kind === 'phones' && v.w ? h('div', { class: 'ph', style: { fontSize: '22px', gap: '3px' } }, v.w.phones.map(p => h('i', { class: grade(p.score) }, p.show))) : null;
  return h('div', { class: 'verdict ' + cls }, h('span', { class: 'vh' }, head), phs, body ? h('p', {}, body) : null,
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => { stopPlayback(); model(); } }, icon('play'), 'Model'), you ? h('button', { class: 'btn voice', type: 'button', onclick: () => { tts.stop(); you(); } }, icon('person'), 'You') : null, you ? h('button', { class: 'btn ghost', type: 'button', onclick: async () => { await model(); await you(); } }, 'Model, then you') : null));
}

export function ladder(u) {
  const box = h('div', { class: 'drill-body' });
  const note = h('p', { class: 'fine', style: { minHeight: '1.4em' } }, 'Hear each word, then tap the mic beside it and say it.');
  let busy = null;
  const rows = u.words.map(w => {
    const st = h('span', { class: 'lst' });
    const mic = h('button', { class: 'mini m', type: 'button', 'aria-label': 'Say ' + w }, icon('mic'));
    const host = h('div', { hidden: true });
    mic.addEventListener('click', () => {
      if (busy && busy !== host) busy.hidden = true;
      busy = host; host.hidden = !host.hidden;
      if (!host.hidden && !host.childElementCount) host.append(recorderUI({ mode: 'word', label: `Say “${w}”`, compact: true, upload: false, onDone: async (clip, recog) => {
        const a = await assess(w, clip, recog);
        const v = pairVerdict(a, u, null, w, null);
        if (a.kind === 'phones') recordPhones(a.res); else if (v.v !== 'none') recordSay(u.id, v.score);
        if (v.v !== 'none') { logDay(); review('word', w, v.score); st.textContent = v.score ?? ''; st.className = 'lst badge ' + grade(v.score); }
        note.textContent = v.v === 'hit' ? `“${w}” came through clearly.` : v.p ? `In “${w}”, /${v.p.show}/ ${v.p.heard === '∅' ? 'was missing' : 'sounded like ' + (HEARD_NAME[v.p.heard] || '/' + v.p.heardShow + '/')}.` : v.v === 'none' ? (a.error || 'Nothing was recognized. Try again a little louder.') : `Heard “${v.heard}”. Listen again and focus on /${u.ipa}/.`;
      } }));
    });
    return [h('div', { class: 'lrow' }, h('span', { class: 'lw' }, w), h('button', { class: 'mini', type: 'button', 'aria-label': 'Hear ' + w, onclick: () => sayWord(w) }, icon('play')), mic, st), host];
  });
  box.append(h('div', {}, rows.flat()), note);
  return box;
}

// Live vowel chart from formants (F1/F2) while you hold a vowel.
export function vowelMirror(u, partnerIds = []) {
  const keyOf = id => ({ ee: 'i', ih: 'ɪ', ay: 'eɪ', eh: 'ɛ', ae: 'æ', ah: 'ɑ', aw: 'ɔ', oh: 'oʊ', uu: 'ʊ', oo: 'u', uh: 'ʌ', er: 'ɝ' }[id]);
  const target = keyOf(u.id), partners = partnerIds.map(keyOf).filter(Boolean);
  const box = h('div', { class: 'drill-body mirror' });
  if (!target) { box.append(h('p', { class: 'muted' }, 'The vowel mirror works for single vowels.')); return box; }
  const canvas = h('canvas', { width: 520, height: 416, 'aria-label': 'Vowel chart with your live vowel position' });
  const status = h('p', { class: 'fine' }, 'Hold the vowel for two seconds (“' + u.key + '” without the consonants). The dot shows where your tongue is.');
  let voice = store.profile.voiceRange === 'high' ? 'women' : store.profile.voiceRange === 'low' ? 'men' : null;
  const btn = h('button', { class: 'btn primary', type: 'button' }, icon('mic'), 'Start mirror');
  const vsel = h('div', { class: 'seg', role: 'group', 'aria-label': 'Voice range' }, [['men', 'Lower voice'], ['women', 'Higher voice']].map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(voice === k), onclick: (e) => { voice = k; store.profile.voiceRange = k === 'women' ? 'high' : 'low'; vsel.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); drawStatic(); } }, l)));
  const col = tokColor();
  const g = canvas.getContext('2d');
  const W = 520, H = 416, L = 40, R = 16, T = 22, B = 34;
  const X = f2 => L + (3000 - clamp(f2, 600, 3000)) / 2400 * (W - L - R), Y = f1 => T + (clamp(f1, 220, 1050) - 220) / 830 * (H - T - B);
  let trail = [], raf = 0, running = false, src = null, an = null, f0s = [];
  function drawStatic() {
    const tg = VOWEL_TARGETS[voice || 'men'];
    g.clearRect(0, 0, W, H);
    g.strokeStyle = col('--line'); g.lineWidth = 1; g.font = '11px "IBM Plex Mono", monospace'; g.fillStyle = col('--muted');
    for (const f2 of [2800, 2200, 1600, 1000]) { g.beginPath(); g.moveTo(X(f2), T); g.lineTo(X(f2), H - B); g.stroke(); g.fillText(f2 + '', X(f2) - 14, H - B + 16); }
    for (const f1 of [300, 500, 700, 900]) { g.beginPath(); g.moveTo(L, Y(f1)); g.lineTo(W - R, Y(f1)); g.stroke(); g.fillText(f1 + '', 4, Y(f1) + 4); }
    g.fillText('front ← tongue → back', L + 4, T - 6); g.fillText('high', W - R - 30, T + 12); g.fillText('low', W - R - 26, H - B - 6);
    for (const [k, [f1, f2]] of Object.entries(tg)) {
      const isT = k === target, isP = partners.includes(k);
      g.beginPath(); g.arc(X(f2), Y(f1), isT ? 30 : isP ? 22 : 15, 0, 6.283);
      g.fillStyle = isT ? col('--accent-soft') : isP ? col('--surface') : 'transparent'; g.fill();
      g.strokeStyle = isT ? col('--accent') : isP ? col('--muted') : col('--line'); g.lineWidth = isT ? 2 : 1; g.stroke();
      g.fillStyle = isT ? col('--accent') : isP ? col('--ink') : col('--faint'); g.font = (isT ? 'bold 22px ' : '17px ') + '"Gentium Plus", serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(k, X(f2), Y(f1)); g.textAlign = 'start'; g.textBaseline = 'alphabetic'; g.font = '11px "IBM Plex Mono", monospace';
    }
  }
  function drawLive() {
    drawStatic();
    trail.forEach((p, i) => { g.beginPath(); g.arc(X(p.f2), Y(p.f1), i === trail.length - 1 ? 9 : 4, 0, 6.283); g.fillStyle = col('--voice'); g.globalAlpha = 0.25 + 0.75 * (i / trail.length); g.fill(); g.globalAlpha = 1; });
  }
  async function start() {
    if (running) return stop();
    try { const st = await getStream(); const c = audioCtx(); src = c.createMediaStreamSource(st); an = c.createAnalyser(); an.fftSize = 2048; src.connect(an); }
    catch (e) { status.textContent = 'The microphone isn’t available here.'; return; }
    running = true; btn.replaceChildren(icon('stop'), 'Stop'); trail = []; f0s = [];
    const buf = new Float32Array(2048), sr = audioCtx().sampleRate; let lastT = 0;
    const tick = (now) => {
      if (!running) return;
      if (now - lastT > 60) {
        lastT = now; an.getFloatTimeDomainData(buf);
        let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
        const db = 10 * Math.log10(s / buf.length + 1e-12);
        if (db > -42) {
          const half = new Float32Array(1024); for (let i = 0; i < 1024; i++) half[i] = (buf[2 * i] + buf[2 * i + 1]) / 2;
          const p = yin(half, sr / 2);
          if (p.f0 > 70 && p.clar > 0.7) {
            f0s.push(p.f0);
            if (!voice && f0s.length > 8) { const m = f0s.slice().sort((a, b) => a - b)[f0s.length >> 1]; voice = m > 165 ? 'women' : 'men'; vsel.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-pressed', String((i === 1) === (voice === 'women')))); }
            const f = formants(buf, sr);
            if (f) { trail.push(f); if (trail.length > 24) trail.shift(); }
          }
        }
        drawLive();
        const tg = VOWEL_TARGETS[voice || 'men'][target];
        if (trail.length > 5) {
          const r = trail.slice(-6), f1 = r.reduce((a, p) => a + p.f1, 0) / r.length, f2 = r.reduce((a, p) => a + p.f2, 0) / r.length;
          const dist = Math.hypot((f1 - tg[0]) / 830 * 1.6, (f2 - tg[1]) / 2400);
          status.textContent = dist < 0.08 ? `On target for /${target}/.` : (f1 > tg[0] + 70 ? 'Raise your tongue a little (close the jaw).' : f1 < tg[0] - 70 ? 'Open your jaw a little more.' : f2 > tg[1] + 180 ? 'Pull the tongue back a little.' : f2 < tg[1] - 180 ? 'Push the tongue forward a little.' : 'Close. Hold it steady.');
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  function stop() { running = false; cancelAnimationFrame(raf); try { src && src.disconnect(); } catch (e) {} btn.replaceChildren(icon('mic'), 'Start mirror'); }
  btn.addEventListener('click', start);
  drawStatic();
  box.append(h('div', { class: 'row between' }, h('div', { class: 'row' }, btn, h('button', { class: 'btn ghost', type: 'button', onclick: () => tts.speak(u.key) }, icon('play'), 'Hear “' + u.key + '”')), vsel), canvas, status,
    h('p', { class: 'fine' }, 'Targets are average American vowels (Hillenbrand et al., 1995). Formant tracking works best in a quiet room with a steady, held vowel.'));
  box._cleanup = stop;
  return box;
}
