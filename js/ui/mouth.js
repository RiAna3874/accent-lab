// Side view of the mouth (facing left) with a parametric tongue, lips, jaw and soft palate.
// Poses animate when switching between a sound and its partner.
import { h } from './dom.js';

const P = (o) => Object.assign({ T: [76, 146], B: [94, 138], F: [124, 126], D: [162, 122], K: [202, 140], jaw: 0.22, lips: 'neutral', velum: 0, voice: true, air: 'central', at: null, note: '' }, o);
const REST = P({});
const POSES = {
  th: P({ T: [53, 138], B: [72, 133], F: [112, 126], D: [156, 124], K: [200, 140], jaw: 0.28, voice: false, air: 'central', at: 'tip', note: 'Tongue tip lightly between the teeth; air flows over it.' }),
  dh: P({ T: [53, 138], B: [72, 133], F: [112, 126], D: [156, 124], K: [200, 140], jaw: 0.28, voice: true, air: 'central', at: 'tip', note: 'Same place as /θ/, with the voice on.' }),
  v: P({ lips: 'labio', jaw: 0.14, voice: true, air: 'central', at: 'lip', note: 'Upper teeth rest on the lower lip; voiced air buzzes through.' }),
  f: P({ lips: 'labio', jaw: 0.14, voice: false, air: 'central', at: 'lip', note: 'Upper teeth on the lower lip; air hisses through, no voice.' }),
  w: P({ lips: 'round', jaw: 0.12, D: [180, 108], K: [204, 130], F: [134, 120], voice: true, air: 'central', note: 'Lips rounded and pushed forward; back of the tongue raised. Teeth stay off the lip.' }),
  p: P({ lips: 'closed', jaw: 0.08, voice: false, air: 'stop', at: 'lips', note: 'Lips closed; air builds up, then releases with a puff.' }),
  b: P({ lips: 'closed', jaw: 0.08, voice: true, air: 'stop', at: 'lips', note: 'Lips closed with the voice on; soft release.' }),
  m: P({ lips: 'closed', jaw: 0.08, velum: 1, voice: true, air: 'nasal', at: 'lips', note: 'Lips closed; the soft palate drops so sound hums through the nose.' }),
  t: P({ T: [70, 112], B: [86, 112], F: [118, 118], D: [160, 122], K: [200, 140], jaw: 0.1, voice: false, air: 'stop', at: 'tip', note: 'Tongue tip on the ridge behind the teeth (not on the teeth).' }),
  d: P({ T: [70, 112], B: [86, 112], F: [118, 118], D: [160, 122], K: [200, 140], jaw: 0.1, voice: true, air: 'stop', at: 'tip', note: 'Tip on the ridge, voice on.' }),
  n: P({ T: [70, 112], B: [86, 112], F: [118, 118], D: [160, 122], K: [200, 140], jaw: 0.1, velum: 1, voice: true, air: 'nasal', at: 'tip', note: 'Tip on the ridge; sound goes through the nose.' }),
  s: P({ T: [71, 117], B: [87, 113], F: [118, 118], D: [160, 122], K: [200, 140], jaw: 0.07, lips: 'spread', voice: false, air: 'central', at: 'gap', note: 'Tip close to the ridge without touching; a narrow, sharp hiss.' }),
  z: P({ T: [71, 117], B: [87, 113], F: [118, 118], D: [160, 122], K: [200, 140], jaw: 0.07, lips: 'spread', voice: true, air: 'central', at: 'gap', note: 'Same as /s/ with the voice on. The tongue never touches.' }),
  sh: P({ T: [77, 124], B: [90, 110], F: [118, 108], D: [160, 116], K: [200, 140], jaw: 0.1, lips: 'round', voice: false, air: 'central', at: 'gap2', note: 'Tongue pulled back behind the ridge; lips forward; a wide, soft hush.' }),
  zh: P({ T: [77, 124], B: [90, 110], F: [118, 108], D: [160, 116], K: [200, 140], jaw: 0.1, lips: 'round', voice: true, air: 'central', at: 'gap2', note: 'Like “sh” with the voice on.' }),
  ch: P({ T: [76, 118], B: [88, 106], F: [118, 106], D: [160, 116], K: [200, 140], jaw: 0.1, lips: 'round', voice: false, air: 'stop', at: 'blade', note: 'Front of the tongue presses behind the ridge, then releases into “sh”.' }),
  j: P({ T: [76, 118], B: [88, 106], F: [118, 106], D: [160, 116], K: [200, 140], jaw: 0.1, lips: 'round', voice: true, air: 'stop', at: 'blade', note: 'Like “ch” with the voice on.' }),
  r: P({ T: [84, 130], B: [100, 119], F: [130, 105], D: [166, 108], K: [208, 150], jaw: 0.14, lips: 'round', voice: true, air: 'central', note: 'Tongue bunched up and back; the tip touches nothing; lips slightly rounded.' }),
  l: P({ T: [69, 111], B: [84, 117], F: [116, 128], D: [170, 116], K: [202, 140], jaw: 0.14, voice: true, air: 'lateral', at: 'tip', note: 'Tip pressed on the ridge; air flows around the sides. At the end of words, the back of the tongue rises too.' }),
  ng: P({ T: [76, 148], B: [106, 132], F: [146, 112], D: [186, 99], K: [206, 128], jaw: 0.14, velum: 1, voice: true, air: 'nasal', at: 'back', note: 'Back of the tongue against the soft palate; sound hums through the nose.' }),
  k: P({ T: [76, 148], B: [106, 132], F: [146, 112], D: [186, 99], K: [206, 128], jaw: 0.14, voice: false, air: 'stop', at: 'back', note: 'Back of the tongue against the soft palate, then release with a puff.' }),
  g: P({ T: [76, 148], B: [106, 132], F: [146, 112], D: [186, 99], K: [206, 128], jaw: 0.14, voice: true, air: 'stop', at: 'back', note: 'Like /k/ with the voice on.' }),
  h: P({ jaw: 0.34, voice: false, air: 'central', T: [76, 150], B: [96, 142], F: [126, 130], D: [164, 126], note: 'Open throat, gentle breath. No scraping.' }),
  y: P({ T: [74, 140], B: [96, 122], F: [126, 103], D: [166, 112], K: [204, 138], jaw: 0.1, lips: 'spread', voice: true, air: 'central', note: 'Middle of the tongue rises toward the hard palate, then glides.' }),
  ee: P({ T: [74, 139], B: [96, 120], F: [124, 104], D: [168, 116], K: [204, 140], jaw: 0.1, lips: 'spread', note: 'Tongue high and forward; lips spread; long and tense.' }),
  ih: P({ T: [74, 142], B: [96, 125], F: [124, 111], D: [168, 121], K: [204, 140], jaw: 0.18, lips: 'neutral', note: 'A little lower and looser than /i/; short; lips relaxed.' }),
  ay: P({ T: [74, 144], B: [96, 128], F: [124, 115], D: [166, 122], jaw: 0.22, lips: 'spread', note: 'Starts at “e” and glides up toward “ee”.' }),
  eh: P({ T: [74, 147], B: [96, 133], F: [124, 120], D: [164, 126], jaw: 0.3, lips: 'neutral', note: 'Jaw half open; tongue mid and forward.' }),
  ae: P({ T: [74, 154], B: [94, 144], F: [122, 132], D: [160, 134], K: [204, 146], jaw: 0.5, lips: 'spread', note: 'Jaw dropped wide; lips spread; tongue low and forward.' }),
  ah: P({ T: [76, 158], B: [100, 154], F: [132, 147], D: [172, 140], K: [210, 158], jaw: 0.56, lips: 'neutral', note: 'Jaw open wide; tongue low and pulled back; lips not rounded.' }),
  aw: P({ T: [76, 156], B: [100, 150], F: [132, 141], D: [176, 128], K: [208, 152], jaw: 0.44, lips: 'round', note: 'Jaw open; tongue low and back; lips lightly rounded.' }),
  oh: P({ T: [76, 152], B: [100, 144], F: [132, 132], D: [180, 117], K: [206, 140], jaw: 0.3, lips: 'round', note: 'Rounded lips that close further as the vowel glides to “w”.' }),
  uu: P({ T: [76, 150], B: [100, 140], F: [134, 126], D: [180, 111], K: [206, 136], jaw: 0.2, lips: 'round', note: 'Back of the tongue high-ish; lips loosely rounded; short.' }),
  oo: P({ T: [76, 148], B: [102, 138], F: [138, 122], D: [184, 104], K: [206, 130], jaw: 0.12, lips: 'round', note: 'Back of the tongue high; lips tightly rounded and pushed forward.' }),
  uh: P({ T: [76, 150], B: [98, 142], F: [130, 133], D: [168, 128], K: [204, 146], jaw: 0.36, lips: 'neutral', note: 'Central and relaxed; jaw half open; lips neutral.' }),
  schwa: P({ T: [76, 147], B: [98, 137], F: [128, 127], D: [165, 124], jaw: 0.24, lips: 'neutral', note: 'Everything relaxed in the middle of the mouth; very short.' }),
  er: P({ T: [84, 130], B: [100, 119], F: [130, 105], D: [166, 108], K: [208, 150], jaw: 0.16, lips: 'round', note: 'The American r held as a vowel: tongue bunched back, tip free.' }),
  ai: P({ T: [76, 156], B: [98, 150], F: [128, 142], D: [168, 138], K: [206, 152], jaw: 0.52, lips: 'neutral', note: 'Starts open at “ah” and glides up to “ee”.' }),
  ow: P({ T: [76, 156], B: [98, 150], F: [128, 142], D: [168, 138], K: [206, 152], jaw: 0.52, lips: 'neutral', note: 'Starts open at “ah” and glides to rounded “oo”.' }),
  oy: P({ T: [76, 156], B: [100, 150], F: [132, 141], D: [176, 128], K: [208, 152], jaw: 0.42, lips: 'round', note: 'Starts at rounded “aw” and glides to “ee”.' }),
};
['ar', 'or', 'air', 'ear'].forEach(k => POSES[k] = { ...POSES.r, note: 'The vowel finishes in a bunched American r. Don’t drop it.' });
export const poseFor = id => POSES[id] || REST;

const lerp = (a, b, k) => a + (b - a) * k;
const lerp2 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
const LIPS = { neutral: [0, null], spread: [3, null], round: [-9, 'round'], closed: [0, 'closed'], labio: [0, 'labio'] };
function geometry(p) {
  const jaw = p.jaw, lip = LIPS[p.lips] || LIPS.neutral;
  const dx = p.lipDx ?? lip[0];
  let llx = 41 + dx * 0.9, lly = 141 + jaw * 26;
  if (p.lips === 'closed') { lly = 129; }
  if (p.lips === 'labio') { llx = 54; lly = 138; }
  if (p.lips === 'round') { lly = Math.min(lly, 136 + jaw * 10); }
  return { jaw, dx, llx: p.llx ?? llx, lly: p.lly ?? lly, ltY: 143 + jaw * 20 };
}
function catmull(pts) {
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}
function tonguePath(p, g) {
  const top = [p.T, p.B, p.F, p.D, p.K, [224, 204], [222, 234]];
  let d = catmull(top);
  const fl = g.jaw * 16;
  d += ` C206 236 170 ${226 + fl * 0.4} 140 ${214 + fl * 0.6} C108 ${202 + fl} 88 ${182 + fl} ${p.T[0] + 10} ${p.T[1] + 14} C${p.T[0] + 2} ${p.T[1] + 10} ${p.T[0] - 2} ${p.T[1] + 4} ${p.T[0]} ${p.T[1]} Z`;
  return d;
}
const PALATE = [[60, 119], [68, 115], [80, 108], [100, 101], [140, 94], [188, 96], [228, 103]];
const palateY = x => { for (let i = 0; i < PALATE.length - 1; i++) { const [a, b] = [PALATE[i], PALATE[i + 1]]; if (x <= b[0]) return a[1] + (b[1] - a[1]) * Math.max(0, (x - a[0]) / (b[0] - a[0])); } return 103; };
function render(p) {
  const g = geometry(p);
  const ux = g.dx;
  const profile = `M96 6 C88 24 70 42 50 56 C40 63 30 68 28 74 C27 80 36 85 50 88 C52 90 54 92 55 94`;
  const upperLip = `M55 94 C48 98 ${38 + ux} 104 ${35 + ux} 113 C${34 + ux} 120 ${39 + ux} 125 ${47 + ux * 0.6} 126.5 C53 127 57 124 58 118 Z`;
  const llx = g.llx, lly = g.lly;
  const lowerLip = `M59 ${lly - 1} C53 ${lly - 5} ${llx - 5} ${lly - 5} ${llx - 8} ${lly + 3} C${llx - 9} ${lly + 12} ${llx - 1} ${lly + 17} ${llx + 9} ${lly + 17} C63 ${lly + 17} 67 ${lly + 9} 65 ${lly + 2} Z`;
  const lowTeeth = `M58 ${g.ltY} L64 ${g.ltY - 1} L67 ${g.ltY + 16} L60 ${g.ltY + 17} Z`;
  const chin = `M${llx + 7} ${lly + 17} C${llx - 4} ${lly + 34} ${llx + 4} ${lly + 52} ${llx + 20} ${200 + g.jaw * 14} C70 ${212 + g.jaw * 14} 120 ${214 + g.jaw * 12} 160 ${222 + g.jaw * 6} C190 228 210 232 222 246`;
  const vel = p.velum;
  const vtip = [lerp(234, 220, vel), lerp(103, 130, vel)];
  const velum = `M186 92 C202 93 ${vtip[0] - 8} ${vtip[1] - 8} ${vtip[0]} ${vtip[1]} C${vtip[0] - 6} ${vtip[1] + 4} ${vtip[0] - 18} ${vtip[1] - 4} 190 100 Z`;
  let air = '', head = '';
  const exit = [14, 123];
  if (p.air === 'central' || p.air === 'lateral') {
    const mids = [p.D, p.F, p.B].map(q => [q[0], (q[1] + palateY(q[0])) / 2]);
    const c = p.at === 'tip' ? [p.T[0] - 3, (p.T[1] + palateY(p.T[0])) / 2 - 2] : p.at === 'lip' ? [52, 132] : p.at === 'gap' ? [68, 116] : p.at === 'gap2' ? [74, 117] : [56, 124];
    const pts = [[238, 236], [238, 176], [226, 128], ...mids.filter(m => m[0] > c[0] + 6), c, exit];
    air = catmull(pts);
    head = `M${exit[0] - 6} ${exit[1]} l10 -5.5 l0 11 z`;
  } else if (p.air === 'nasal') {
    air = catmull([[238, 236], [240, 170], [240, 110], [232, 82], [180, 70], [100, 72], [44, 80]]);
    head = 'M36 81 l10 -6.5 l1 11 z';
  }
  const voice = p.voice ? 'M226 254 l4 -6 l4 12 l4 -12 l4 12 l4 -6' : 'M226 254 L250 254';
  const contact = p.air === 'stop' && p.at ? (p.at === 'lips' ? [46, 128] : p.at === 'tip' ? [70, 111] : p.at === 'blade' ? [88, 105] : p.at === 'back' ? [187, 98] : null) : null;
  return `
  <path class="m-line" d="${profile}"/>
  <path class="m-line" d="M60 92 C100 70 196 64 246 80" stroke-dasharray="3 5"/>
  <text class="m-label" x="140" y="60" text-anchor="middle">nasal passage</text>
  <path class="m-line" d="M250 80 C254 120 254 190 250 262"/>
  <path class="m-static" d="M57 118 C62 112 70 106 80 105 C100 96 140 86 186 92 L190 100 C150 96 110 104 92 109 C82 111 72 114 66 117 Z"/>
  <path class="m-teeth" d="M55 116 L64 115 L66 136 L59 138 L55 128 Z"/>
  <path class="m-velum" d="${velum}"/>
  <path class="m-lip" d="${upperLip}"/>
  <path class="m-tongue" d="${tonguePath(p, g)}"/>
  <path class="m-teeth" d="${lowTeeth}"/>
  <path class="m-lip" d="${lowerLip}"/>
  <path class="m-line" d="${chin}"/>
  ${air ? `<path class="m-air" d="${air}"/><path class="m-airhead" d="${head}"/>` : ''}
  ${p.air === 'stop' ? `<text class="m-label" x="176" y="36" text-anchor="middle">air blocked, then released</text>` : ''}
  ${p.air === 'lateral' ? `<text class="m-label" x="176" y="36" text-anchor="middle">air flows around the sides</text>` : ''}
  ${contact ? `<circle class="m-contact" cx="${contact[0]}" cy="${contact[1]}" r="5"/>` : ''}
  <path class="m-voice" d="${voice}" ${p.voice ? '' : 'style="stroke:var(--faint)"'}/>
  <text class="m-label" x="220" y="258" text-anchor="end">${p.voice ? 'voice on' : 'voice off'}</text>
  <text class="m-label" x="84" y="97" text-anchor="middle">ridge</text>
  <text class="m-label" x="136" y="84" text-anchor="middle">palate</text>
  <text class="m-label" x="212" y="82" text-anchor="middle">soft palate</text>`;
}

// Component: diagram for a unit, with optional partner toggle.
export function mouthView(unitId, partners = [], ipaOf = x => x) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 280 266'); svg.setAttribute('role', 'img');
  let cur = { ...poseFor(unitId) }, raf = 0;
  const cap = h('p', { class: 'cap' });
  const draw = (p, id) => { svg.innerHTML = render(p); svg.setAttribute('aria-label', `Side view of the mouth for /${ipaOf(id)}/`); };
  const show = (id) => {
    const target = poseFor(id), from = { ...cur }, t0 = performance.now(), dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 380;
    cancelAnimationFrame(raf);
    cap.textContent = target.note;
    const step = (now) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1, e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const mix = { ...target };
      for (const key of ['T', 'B', 'F', 'D', 'K']) mix[key] = lerp2(from[key], target[key], e);
      mix.jaw = lerp(from.jaw, target.jaw, e); mix.velum = lerp(from.velum, target.velum, e);
      const gf = geometry(from), gt = geometry(target);
      mix.lipDx = lerp(gf.dx, gt.dx, e); mix.llx = lerp(gf.llx, gt.llx, e); mix.lly = lerp(gf.lly, gt.lly, e);
      draw(mix, id);
      if (k < 1) raf = requestAnimationFrame(step); else cur = { ...target };
    };
    raf = requestAnimationFrame(step);
  };
  draw(cur, unitId); cap.textContent = cur.note;
  const ids = [unitId, ...partners.filter(p => p !== unitId)];
  const seg = ids.length > 1 ? h('div', { class: 'seg', role: 'group', 'aria-label': 'Compare mouth positions' }, ids.map((id, i) => {
    const b = h('button', { type: 'button', 'aria-pressed': String(i === 0) }, h('span', { class: 'ipa' }, '/' + ipaOf(id) + '/'));
    b.addEventListener('click', () => { seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); show(id); });
    return b;
  })) : null;
  return h('div', { class: 'mouth' }, svg, cap, seg);
}
