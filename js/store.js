// Local progress store (this device only), sound statistics, spaced review and the daily plan.
import { UMAP, UNITS, unitsFor } from './data/sounds.js';

const KEY = 'accentlab.v2';
const DEF = () => ({
  v: 2, created: Date.now(),
  profile: { l1: null, name: '', onboarded: false, voiceRange: 'auto' },
  set: { voice: '', rate: 0.92, noise: false, prefer: 'auto', strict: 'standard', coachModel: 'claude-sonnet-5-5', apiKey: '' },
  units: {},        // id -> {n, sum, ema, last, ear:[right,total], errs:{heard:count}}
  days: {},         // yyyy-mm-dd -> attempts
  hist: [],         // recent scored attempts {t, kind, text, score}
  checks: [],       // accent checks {t, score, units:{id:score}, n}
  srs: {},          // key -> {text, kind, box, due, last}
  custom: [], coachDrills: [], convos: [],
  plan: null
});
let S;
try { S = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { S = null; }
S = Object.assign(DEF(), S || {});
S.profile = Object.assign(DEF().profile, S.profile); S.set = Object.assign(DEF().set, S.set);
export const store = S;
let saveT = 0;
export function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }, 60); }
export function saveNow() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

export const dkey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export function logDay(n = 1) { const k = dkey(); S.days[k] = (S.days[k] || 0) + n; save(); }
export function streak() { const d = new Date(); if (!S.days[dkey(d)]) d.setDate(d.getDate() - 1); let n = 0; while (S.days[dkey(d)]) { n++; d.setDate(d.getDate() - 1); } return n; }

export function unit(id) { return S.units[id] || (S.units[id] = { n: 0, sum: 0, ema: null, last: 0, ear: [0, 0], errs: {} }); }
// Fold every scored phone of an attempt into its sound's statistics.
export function recordPhones(res) {
  if (!res || !res.ok) return;
  for (const p of res.phones) {
    if (!p.unit || !UMAP[p.unit]) continue;
    const u = unit(p.unit);
    u.n++; u.sum += p.score; u.ema = u.ema == null ? p.score : u.ema * 0.85 + p.score * 0.15; u.last = Date.now();
    if (p.status !== 'ok' && p.heardShow) u.errs[p.heardShow] = (u.errs[p.heardShow] || 0) + 1;
  }
  save();
}
export function recordEar(id, right) { const u = unit(id); u.ear[1]++; if (right) u.ear[0]++; u.last = Date.now(); save(); }
export function recordSay(id, score) { const u = unit(id); u.n++; u.sum += score; u.ema = u.ema == null ? score : u.ema * 0.8 + score * 0.2; u.last = Date.now(); save(); }
export function mastery(id) { const u = S.units[id]; if (!u) return null; if (u.ema != null) return Math.round(u.ema); if (u.ear[1]) return Math.round(u.ear[0] / u.ear[1] * 100); return null; }
export function topErr(id) { const u = S.units[id]; if (!u) return null; const e = Object.entries(u.errs).sort((a, b) => b[1] - a[1])[0]; return e ? { heard: e[0], n: e[1], of: u.n } : null; }

export function addHist(kind, text, score) { S.hist.push({ t: Date.now(), kind, text, score }); if (S.hist.length > 400) S.hist.splice(0, S.hist.length - 400); save(); }
export function lastScore(text) { for (let i = S.hist.length - 1; i >= 0; i--) if (S.hist[i].text === text) return S.hist[i].score; return null; }

// Spaced review: items you scored low on come back after 1, 3, 7, 16 and 35 days.
const BOX_DAYS = [0, 1, 3, 7, 16, 35];
export function review(kind, text, score) {
  const key = kind + ':' + text;
  const it = S.srs[key];
  const good = score >= 80;
  if (!it) { if (good) return; S.srs[key] = { kind, text, box: 1, due: Date.now() + 864e5, last: score }; save(); return; }
  it.box = good ? Math.min(BOX_DAYS.length - 1, it.box + 1) : 1;
  it.due = Date.now() + BOX_DAYS[it.box] * 864e5; it.last = score;
  if (good && it.box === BOX_DAYS.length - 1) delete S.srs[key];
  save();
}
export const dueItems = () => Object.values(S.srs).filter(x => x.due <= Date.now()).sort((a, b) => a.due - b.due);

// Weakest sounds: low mastery weighted by how much the contrast matters (functional load).
export function focusUnits(n = 3) {
  const pool = unitsFor(S.profile.l1);
  const scored = pool.map(u => ({ u, m: mastery(u.id) })).filter(x => x.m != null && (S.units[x.u.id].n >= 4 || S.units[x.u.id].ear[1] >= 6));
  scored.sort((a, b) => (a.m - b.u.fl * 3) - (b.m - a.u.fl * 3));
  const weak = scored.filter(x => x.m < 85).map(x => x.u);
  if (weak.length >= n) return weak.slice(0, n);
  const untried = pool.filter(u => mastery(u.id) == null).sort((a, b) => b.fl - a.fl);
  return [...weak, ...untried, ...pool].filter((u, i, a) => a.indexOf(u) === i).slice(0, n);
}

// Today's plan: a short session built from your weakest sounds and due reviews.
export function todayPlan() {
  const k = dkey();
  if (S.plan && S.plan.day === k) return S.plan;
  const f = focusUnits(3);
  const doy = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 864e5);
  const rhythmTopics = ['flap', 'linking', 'reduce', 'statement', 'yesno', 'contrast', 'groups', 'glottal', 'cant', 'list', 'stress'];
  S.plan = { day: k, steps: [
    { id: 'ear', label: 'Ear warm-up', unit: f[0].id, done: false },
    { id: 'pairs', label: 'Minimal pairs', unit: f[0].id, done: false },
    { id: 'pairs2', label: 'Minimal pairs', unit: (f[1] || f[0]).id, done: false },
    { id: 'lines', label: 'Practice lines', units: f.map(u => u.id), done: false },
    { id: 'rhythm', label: 'Rhythm and melody', topic: rhythmTopics[doy % rhythmTopics.length], done: false },
    { id: 'review', label: 'Review', done: false },
    { id: 'talk', label: 'Conversation', done: false, optional: true }
  ] };
  save();
  return S.plan;
}
export function markStep(id) { const p = todayPlan(); const s = p.steps.find(x => x.id === id); if (s && !s.done) { s.done = true; save(); } }

export function addCheck(c) { S.checks.push(c); save(); }
export function exportData() { return JSON.stringify(S, null, 1); }
export function importData(txt) { const d = JSON.parse(txt); if (!d || d.v !== 2) throw new Error('This file is not an Accent Lab backup.'); Object.keys(S).forEach(k => delete S[k]); Object.assign(S, DEF(), d); saveNow(); }
export function resetScores() { Object.assign(S, { units: {}, days: {}, hist: [], checks: [], srs: {}, plan: null }); saveNow(); }
export const practiceName = () => (S.profile.name || '').trim() || 'Lee';
export const fill = t => String(t).replace(/\{name\}/g, practiceName());
