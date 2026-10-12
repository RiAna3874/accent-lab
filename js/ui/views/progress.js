import { h, icon, grade, svgBox, toast } from '../dom.js';
import { UNITS, UMAP } from '../../data/sounds.js';
import { store, streak, mastery, topErr, dkey, exportData, importData } from '../../store.js';

const narrow = () => window.innerWidth < 620;
function checkChart(checks) {
  const W = narrow() ? 360 : 560, H = 190, L = 34, R = 14, T = 14, B = 26, n = checks.length;
  const X = i => L + (n < 2 ? (W - L - R) / 2 : i / (n - 1) * (W - L - R)), Y = v => T + (1 - v / 100) * (H - T - B);
  let g = '';
  for (const v of [0, 50, 100]) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="axis" x="${L - 6}" y="${Y(v) + 3.5}" text-anchor="end">${v}</text>`;
  if (n > 1) g += `<path class="area" d="M${X(0)} ${Y(0)} ${checks.map((c, i) => `L${X(i).toFixed(1)} ${Y(c.score).toFixed(1)}`).join(' ')} L${X(n - 1)} ${Y(0)} Z"/><path class="hline a" d="${checks.map((c, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(c.score).toFixed(1)}`).join(' ')}"/>`;
  checks.forEach((c, i) => { g += `<circle class="hdot a" cx="${X(i).toFixed(1)}" cy="${Y(c.score).toFixed(1)}" r="${i === n - 1 ? 5 : 3.5}"/>`; });
  const last = checks[n - 1]; g += `<text class="axis" x="${Math.min(W - R, X(n - 1)).toFixed(1)}" y="${(Y(last.score) - 10).toFixed(1)}" text-anchor="end" style="font-weight:600;fill:var(--ink)">${last.score}</text>`;
  g += `<text class="axis" x="${L}" y="${H - 6}">${new Date(checks[0].t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>`;
  if (n > 1) g += `<text class="axis" x="${W - R}" y="${H - 6}" text-anchor="end">${new Date(last.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>`;
  return svgBox(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Accent check scores over time">${g}</svg>`);
}

export function progress(go) {
  const el = h('div', { class: 'stack' });
  const days30 = (() => { let n = 0; const d = new Date(); for (let i = 0; i < 30; i++) { if (store.days[dkey(d)]) n++; d.setDate(d.getDate() - 1); } return n; })();
  const recent = store.hist.slice(-40);
  const avg = recent.length ? Math.round(recent.reduce((s, x) => s + x.score, 0) / recent.length) : null;
  const practiced = UNITS.filter(u => mastery(u.id) != null).length;
  const kpi = (l, v, u, n) => h('div', { class: 'kpi' }, h('span', { class: 'eyebrow' }, l), h('span', { class: 'num' }, v == null ? '—' : v, v == null ? null : h('small', {}, u)), h('span', { class: 'note2' }, n));
  el.append(h('div', { class: 'kpis' }, kpi('Streak', streak(), streak() === 1 ? 'day' : 'days', 'days in a row'), kpi('Last 30 days', days30, 'days', 'with practice'), kpi('Recent accuracy', avg, '%', `last ${recent.length} scored takes`), kpi('Sounds practiced', practiced, `of ${UNITS.length}`, 'with a score')));

  const checks = store.checks;
  el.append(h('div', { class: 'grid2' },
    h('section', { class: 'panel stack tight' }, h('div', { class: 'row between' }, h('h3', {}, 'Accent checks'), h('button', { class: 'btn', type: 'button', onclick: () => go('check') }, checks.length ? 'Retake' : 'Take it')),
      checks.length ? checkChart(checks) : h('p', { class: 'muted' }, 'Take the accent check to get a baseline. Retake it every few weeks to see progress.'),
      checks.length > 1 ? changes(checks[0], checks[checks.length - 1]) : null),
    h('section', { class: 'panel stack tight' }, h('h3', {}, 'Practice calendar'), heatmap(), h('p', { class: 'fine' }, 'Each square is a day; darker means more practice. Short daily sessions beat long weekly ones.'))));

  const rows = UNITS.map(u => ({ u, m: mastery(u.id), e: topErr(u.id), s: store.units[u.id] })).sort((a, b) => (a.m == null ? 999 : a.m) - (b.m == null ? 999 : b.m));
  const bar = v => v == null ? h('span', { class: 'muted' }, '—') : h('div', { class: 'barcell' }, h('div', { class: 'bar' }, h('span', { style: { width: v + '%', background: `var(--${v >= 80 ? 'good' : v >= 55 ? 'warn' : 'bad'})` } })), h('span', {}, v));
  el.append(h('section', { class: 'panel stack tight' }, h('h3', {}, 'Every sound, weakest first'),
    h('div', { class: 'tablewrap' }, h('table', { class: 'ptable' }, h('thead', {}, h('tr', {}, h('th', {}, 'Sound'), h('th', {}, 'Speaking'), h('th', {}, 'Ear'), h('th', {}, 'Often heard as'), h('th', {}, 'Tries'), h('th', {}, ''))),
      h('tbody', {}, rows.map(({ u, m, e, s }) => h('tr', {}, h('td', {}, h('span', { class: 'ipa' }, '/' + u.ipa + '/'), ' ', h('span', { class: 'muted' }, u.name)), h('td', {}, bar(s && s.ema != null ? Math.round(s.ema) : null)), h('td', {}, bar(s && s.ear[1] ? Math.round(s.ear[0] / s.ear[1] * 100) : null)), h('td', { class: 'ipa' }, e ? `/${e.heard}/ ×${e.n}` : ''), h('td', {}, s ? s.n + s.ear[1] : 0), h('td', {}, h('button', { class: 'btn ghost', type: 'button', onclick: () => go('sounds.' + u.id) }, 'Practice')))))))));

  const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr-only', id: 'importfile' });
  file.addEventListener('change', async () => { const f = file.files[0]; file.value = ''; if (!f) return; try { importData(await f.text()); toast('Progress restored.'); go('progress', { replace: true }); } catch (e) { toast(e.message); } });
  el.append(h('section', { class: 'panel stack tight' }, h('h3', {}, 'Your data'), h('p', { class: 'muted prose' }, 'Scores live only in this browser. Download a backup to move them to another device.'),
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => { const b = new Blob([exportData()], { type: 'application/json' }); const a = h('a', { href: URL.createObjectURL(b), download: `accent-lab-backup-${dkey()}.json` }); document.body.append(a); a.click(); a.remove(); } }, icon('download'), 'Download backup'), file, h('button', { class: 'btn ghost', type: 'button', onclick: () => file.click() }, icon('upload'), 'Restore from backup'))));
  return el;
}
function changes(a, b) {
  const diffs = Object.keys(b.units).filter(k => a.units[k] != null && UMAP[k]).map(k => ({ k, d: b.units[k] - a.units[k] })).sort((x, y) => y.d - x.d);
  if (!diffs.length) return null;
  const up = diffs.filter(x => x.d > 3).slice(0, 4), down = diffs.filter(x => x.d < -3).slice(-3);
  return h('p', { class: 'fine' }, up.length ? 'Most improved: ' + up.map(x => `/${UMAP[x.k].ipa}/ +${x.d}`).join(', ') + '. ' : '', down.length ? 'Slipped: ' + down.map(x => `/${UMAP[x.k].ipa}/ ${x.d}`).join(', ') + '.' : '');
}
function heatmap() {
  const g = h('div', { class: 'heat', role: 'img', 'aria-label': 'Practice days over the last 16 weeks' });
  const d = new Date(); d.setDate(d.getDate() - (16 * 7 - 1) - d.getDay());
  for (let i = 0; i < 16 * 7; i++) { const n = store.days[dkey(d)] || 0; g.append(h('i', { class: n ? (n >= 20 ? 'l3' : n >= 8 ? 'l2' : 'l1') : '', title: `${dkey(d)}: ${n} tries` })); d.setDate(d.getDate() + 1); }
  return g;
}
