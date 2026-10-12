import { h, icon, grade } from '../dom.js';
import { UNITS, UMAP, L1, L1_NAME, unitsFor } from '../../data/sounds.js';
import { store, save, mastery, topErr, focusUnits } from '../../store.js';
import { mouthView } from '../mouth.js';
import { earTest, sayPairs, ladder, vowelMirror } from '../drills.js';
import { sentenceDrill } from './speak.js';

const GROUPS = [['Consonants', u => u.kind === 'c'], ['Vowels', u => u.kind === 'v' && !['ar', 'or', 'air', 'ear', 'er'].includes(u.id)], ['R vowels', u => ['er', 'ar', 'or', 'air', 'ear'].includes(u.id)]];

export function sounds(go, args = []) {
  const id = UMAP[args[0]] ? args[0] : focusUnits(1)[0].id;
  const tab = args[1] || 'ear';
  const u = UMAP[id];
  const rail = h('aside', { class: 'rail sound-rail', 'aria-label': 'Sounds' });
  const l1sel = h('select', { id: 'l1sel', class: 'select' }, h('option', { value: '' }, 'All sounds'), L1.filter(([k]) => k !== 'other').map(([k, n]) => h('option', { value: k, selected: store.profile.l1 === k }, `Hard for ${n} speakers`)));
  if (!store.profile.l1 || store.profile.l1 === 'other') l1sel.value = '';
  let filter = l1sel.value;
  l1sel.addEventListener('change', () => { filter = l1sel.value; drawList(); });
  const list = h('div', { class: 'index-list' });
  const drawList = () => {
    list.replaceChildren();
    const pool = filter ? unitsFor(filter) : UNITS;
    for (const [label, test] of GROUPS) {
      const g = pool.filter(test); if (!g.length) continue;
      list.append(h('div', { class: 'group-label' }, label));
      for (const x of g) {
        const m = mastery(x.id);
        list.append(h('button', { class: 'snd', type: 'button', 'aria-current': String(x.id === id), onclick: () => go('sounds.' + x.id + '.' + tab) },
          h('span', { class: 'sym' }, '/' + x.ipa + '/'), h('span', { class: 'lbl' }, x.name + ' · ' + x.key),
          m != null ? h('span', { class: 'badge ' + grade(m) }, m) : h('span', { class: 'meter', title: 'Not practiced yet' }, h('span'))));
      }
    }
    const cur = list.querySelector('[aria-current="true"]'); if (cur && cur.scrollIntoView && window.innerWidth <= 860) setTimeout(() => cur.scrollIntoView({ block: 'nearest', inline: 'center' }), 50);
  };
  drawList();
  rail.append(h('label', { class: 'field', for: 'l1sel' }, h('span', { class: 'eyebrow' }, 'Show'), l1sel), list);

  // Lesson
  const partners = u.partners.map(p => p.id).filter(x => UMAP[x]);
  const m = mastery(u.id), te = topErr(u.id);
  const hero = h('header', { class: 'hero' },
    h('div', { class: 'glyphs', 'aria-label': '/' + u.ipa + '/' }, h('span', { class: 'sl' }, '/'), h('span', {}, u.ipa), h('span', { class: 'sl' }, '/')),
    h('div', { class: 'hero-meta' }, h('h2', {}, u.name), h('p', { class: 'muted' }, `as in “${u.key}”`),
      h('div', { class: 'tags' }, h('span', { class: 'tag' }, u.kind === 'c' ? 'Consonant' : 'Vowel'), m != null ? h('span', { class: 'tag' }, `Your score ${m}`) : h('span', { class: 'tag' }, 'Not practiced yet'), te ? h('span', { class: 'tag' }, `Often heard as /${te.heard}/`) : null)));
  const l1 = store.profile.l1;
  const slip = (u.slip && (u.slip[l1] || u.slip.default)) || '';
  const how = h('section', { class: 'panel' }, h('span', { class: 'eyebrow' }, 'How to make it'), h('ol', { class: 'how' }, u.how.map(x => h('li', {}, h('span', {}, x)))),
    slip ? h('div', { class: 'slip' }, h('span', { class: 'eyebrow' }, l1 && u.slip[l1] ? `For ${L1_NAME[l1]} speakers` : 'Common slip'), h('p', {}, slip)) : null);
  const diagram = h('section', { class: 'panel' }, h('span', { class: 'eyebrow' }, partners.length ? 'Mouth position · compare' : 'Mouth position'), mouthView(u.id, partners, x => UMAP[x] ? UMAP[x].ipa : x));

  const tabs = [['ear', 'Ear test'], ['say', 'Say the pairs'], ['words', 'Word ladder'], ...(u.kind === 'v' && ['ee', 'ih', 'ay', 'eh', 'ae', 'ah', 'aw', 'oh', 'uu', 'oo', 'uh', 'er'].includes(u.id) ? [['mirror', 'Vowel mirror']] : []), ['lines', 'Sentences']];
  const cur = tabs.find(t => t[0] === tab) ? tab : (u.partners.length ? 'ear' : 'words');
  const body = cur === 'ear' ? earTest(u) : cur === 'say' ? sayPairs(u) : cur === 'words' ? ladder(u) : cur === 'mirror' ? vowelMirror(u, partners) : sentenceDrill(u.lines.map(t => ({ text: t })), { title: `/${u.ipa}/ practice lines`, go });
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Drill type' }, tabs.map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(k === cur), onclick: () => go('sounds.' + u.id + '.' + k, { replace: true }) }, l)));
  const drill = h('section', { class: 'panel' }, h('div', { class: 'drill-head' }, h('h3', {}, 'Practice'), seg), body);
  const work = h('article', { class: 'work' }, hero, h('div', { class: 'grid2' }, diagram, how), drill);
  const el = h('div', { class: 'bench' }, rail, work);
  el._cleanup = () => { body._cleanup && body._cleanup(); diagram._cleanup && diagram._cleanup(); };
  return el;
}
