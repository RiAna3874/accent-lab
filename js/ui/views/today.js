import { h, icon, grade } from '../dom.js';
import { store, streak, todayPlan, focusUnits, mastery, dueItems, topErr, dkey } from '../../store.js';
import { UMAP } from '../../data/sounds.js';
import { INTONATION, CONNECTED } from '../../data/practice.js';
import { engineCard } from '../engine-card.js';
import { coachReady } from '../../coach.js';

export function today(go) {
  const plan = todayPlan();
  const s = streak();
  const hr = new Date().getHours();
  const hello = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
  const done = plan.steps.filter(x => x.done && !x.optional).length, total = plan.steps.filter(x => !x.optional).length;
  const el = h('div', { class: 'stack' });
  el.append(h('div', { class: 'hello' },
    h('div', { class: 'stack tight' }, h('span', { class: 'eyebrow' }, new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })), h('h2', {}, `${hello}. ${done === total ? 'Today’s session is done.' : `${total - done} short steps today.`}`)),
    h('div', { class: 'streak', title: 'Days in a row with practice' }, h('b', {}, s), h('span', { class: 'muted' }, s === 1 ? 'day streak' : 'day streak'))));

  el.append(engineCard({ compactWhenReady: true }));

  if (!store.checks.length) {
    el.append(h('section', { class: 'panel' }, h('div', { class: 'row between', style: { alignItems: 'flex-start' } },
      h('div', { class: 'stack tight prose' }, h('h3', {}, 'Start with an accent check'), h('p', { class: 'muted' }, 'Read 12 short sentences (about 3 minutes). Every sound is scored, and your plan is built from the sounds that need the most work.')),
      h('button', { class: 'btn primary lg', type: 'button', onclick: () => go('check') }, 'Take the accent check', icon('next')))));
  }

  const f = focusUnits(3);
  el.append(h('section', { class: 'stack tight' }, h('div', { class: 'row between' }, h('span', { class: 'eyebrow' }, store.checks.length ? 'Your focus sounds' : 'Suggested focus sounds'), h('button', { class: 'btn ghost', type: 'button', onclick: () => go('progress') }, 'All sounds', icon('next'))),
    h('div', { class: 'focuscards' }, f.map(u => {
      const m = mastery(u.id), te = topErr(u.id);
      return h('button', { class: 'fcard', type: 'button', onclick: () => go('sounds.' + u.id) },
        h('div', { class: 'row between' }, h('span', { class: 'fs' }, '/' + u.ipa + '/'), m != null ? h('span', { class: 'badge ' + grade(m) }, m) : h('span', { class: 'badge' }, 'new')),
        h('b', {}, u.name), h('span', { class: 'fn' }, te ? `Often heard as /${te.heard}/` : `as in “${u.key}”`));
    }))));

  const due = dueItems().length;
  const label = st => {
    if (st.id === 'ear') return [`Ear warm-up: `, h('span', { class: 'ipa' }, `/${UMAP[st.unit].ipa}/`), ` vs its partners`];
    if (st.id === 'pairs' || st.id === 'pairs2') return [`Say minimal pairs for `, h('span', { class: 'ipa' }, `/${UMAP[st.unit].ipa}/`)];
    if (st.id === 'lines') return ['Practice lines with your focus sounds'];
    if (st.id === 'rhythm') { const t = [...INTONATION, ...CONNECTED].find(x => x.id === st.topic); return [`Rhythm and melody: ${t ? t.name : 'word stress'}`]; }
    if (st.id === 'review') return [due ? `Review ${due} item${due === 1 ? '' : 's'} you missed before` : 'Review: nothing due yet'];
    if (st.id === 'talk') return [coachReady() ? 'Five-minute conversation with the coach' : 'Conversation practice (needs the coach)'];
    return [st.label];
  };
  const sub = st => ({ ear: '2 min', pairs: '3 min', pairs2: '3 min', lines: '3 min', rhythm: '2 min', review: '2 min', talk: 'optional · 5 min' }[st.id]);
  const target = st => ({ ear: 'sounds.' + st.unit + '.ear', pairs: 'sounds.' + st.unit + '.say', pairs2: 'sounds.' + st.unit + '.say', lines: 'speak.focus', rhythm: ['statement', 'yesno', 'contrast', 'groups', 'list', 'wh', 'choice'].includes(st.topic) ? 'speak.tune-' + st.topic : st.topic === 'stress' ? 'speak.stress' : 'speak.cs-' + st.topic, review: 'speak.review', talk: 'coach' }[st.id]);
  el.append(h('section', { class: 'stack tight' }, h('div', { class: 'row between' }, h('span', { class: 'eyebrow' }, 'Today’s session'), h('span', { class: 'mono muted' }, `${done} of ${total} done`)),
    h('div', { class: 'steps' }, plan.steps.map(st => h('button', { class: 'step' + (st.done ? ' done' : ''), type: 'button', onclick: () => go(target(st)) },
      h('span', { class: 'tick', 'aria-hidden': 'true' }, st.done ? icon('check') : null),
      h('span', {}, h('span', { class: 'st-title' }, ...label(st)), h('br'), h('span', { class: 'st-sub' }, sub(st))),
      icon('next'))))));
  return el;
}
