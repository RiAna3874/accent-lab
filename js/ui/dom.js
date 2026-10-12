export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? e.style.setProperty(sk, String(sv)) : (e.style[sk] = sv); }
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids.flat(Infinity)) { if (k == null || k === false) continue; e.append(k instanceof Node ? k : document.createTextNode(String(k))); }
  return e;
}
const ICONS = {
  play: '<path d="M8 5.2v13.6L18.8 12z" fill="currentColor"/>',
  mic: '<rect x="9" y="3" width="6" height="11.5" rx="3" fill="currentColor"/><path d="M5.5 11.2a6.5 6.5 0 0 0 13 0M12 17.8V21" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.2" fill="currentColor"/>',
  next: '<path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  prev: '<path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  sliders: '<path d="M4 7h9M18 7h2M4 17h4M13 17h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="15.5" cy="7" r="2.3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="10.5" cy="17" r="2.3" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  upload: '<path d="M12 15V4.5M7.5 9L12 4.5 16.5 9M5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5v-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  person: '<circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  swap: '<path d="M7 7h11l-3-3M17 17H6l3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  check: '<path d="M5.5 12.5l4 4 9-9.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  home: '<path d="M4 11l8-6.5 8 6.5V20h-5.5v-5.5h-5V20H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  sound: '<path d="M4 9.5v5h3.5l4.5 4V5.5l-4.5 4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  speak: '<path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16h-6l-4.5 4v-4H7a2.5 2.5 0 0 1-2.5-2.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 9h7M8.5 12h4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  coach: '<circle cx="9" cy="9" r="3.3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M15 5.5h5.5v5h-2.2l-2 2v-2H15z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  chart: '<path d="M4 20V4M4 20h16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M7.5 15l3.5-4 3 2.5 5-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  spark: '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  slow: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  download: '<path d="M12 4.5V15M7.5 10.5L12 15l4.5-4.5M5 18.5h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  loop: '<path d="M6 9.5A6.5 6.5 0 0 1 18 8M18 14.5A6.5 6.5 0 0 1 6 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M18.5 4.5V8.5h-4M5.5 19.5v-4h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
};
export function icon(n) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', 'ic'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
  s.innerHTML = ICONS[n] || '';
  return s;
}
export function svgBox(markup, cls) { const d = h('div', { class: cls || null }); d.innerHTML = markup; return d; }
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const grade = v => v == null ? 'none' : v >= 80 ? 'good' : v >= 55 ? 'warn' : 'bad';
let toastT = 0;
export function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3800); }
export const tokColor = () => { const cs = getComputedStyle(document.documentElement); return n => cs.getPropertyValue(n).trim(); };
