// AI coach: Claude through the claude.ai page (no key needed) or the Anthropic API with your own key.
import { store, save } from './store.js';
import { L1_NAME, UMAP } from './data/sounds.js';

export const coach = { mode: 'none', sample: null };
const listeners = new Set();
export const onCoach = f => { listeners.add(f); f(coach); return () => listeners.delete(f); };
const emit = () => listeners.forEach(f => f(coach));

export async function initCoach() {
  if (window.claude && typeof window.claude.use === 'function') {
    try { const s = await window.claude.use('sample'); if (s) { coach.sample = s; coach.mode = 'claude'; emit(); return; } } catch (e) {}
  }
  coach.mode = store.set.apiKey ? 'api' : 'none';
  emit();
}
export function setKey(k) { store.set.apiKey = (k || '').trim(); save(); if (coach.mode !== 'claude') coach.mode = store.set.apiKey ? 'api' : 'none'; emit(); }
export const coachReady = () => coach.mode !== 'none';

const MODELS = { 'claude-sonnet-5-5': 'Claude Sonnet 5.5', 'claude-haiku-5-5': 'Claude Haiku 5.5', 'claude-opus-5-5': 'Claude Opus 5.5' };
export const COACH_MODELS = Object.entries(MODELS);

// messages: [{role, content}] ending on user.
export async function ask(system, messages, { maxTokens = 700, signal } = {}) {
  if (coach.mode === 'claude') {
    const flat = messages.map((m, i) => i === 0 && m.role === 'user' ? { role: 'user', content: `${system}\n\n---\n\n${m.content}` } : m);
    const r = await coach.sample(flat, { signal, modelTier: 'default', cache: false });
    return r.text;
  }
  if (coach.mode === 'api') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-api-key': store.set.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: store.set.coachModel, max_tokens: maxTokens, system, messages })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data && data.error && data.error.message || res.statusText;
      throw new Error(res.status === 401 ? 'The API key was rejected. Check it in Settings.' : res.status === 429 ? 'Rate limited. Wait a moment and try again.' : msg);
    }
    return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  }
  throw new Error('no_coach');
}

const learner = () => {
  const l1 = store.profile.l1 && store.profile.l1 !== 'other' ? L1_NAME[store.profile.l1] : null;
  return `The learner is a physician working in the United States${l1 ? ` whose first language is ${l1}` : ''}. They are training toward a clear General American accent.`;
};
const COACH_STYLE = 'You are an expert American English accent coach (a speech-language pathologist who specializes in accent modification). Be direct, warm and specific. Use plain words; use IPA only between slashes and only for the sound in question. Give physical instructions (tongue, lips, jaw, airflow, voicing) rather than generic encouragement. No preamble, no sign-off.';

// Phone-level results → short, specific coaching.
export function summarizeAttempt(text, res) {
  const issues = [];
  for (const w of res.words) {
    for (const p of w.phones) if (p.status !== 'ok') issues.push(`${w.text.replace(/[^\w'’-]/g, '')}: /${p.show}/ → ${p.heard === '∅' ? 'dropped' : '/' + p.heardShow + '/'} (${p.status === 'near' ? 'accented' : 'wrong sound'})`);
    for (const x of w.inserts) issues.push(`${w.text.replace(/[^\w'’-]/g, '')}: extra vowel /${x.show}/`);
  }
  return { text, score: res.score, issues };
}
export async function explainAttempt(text, res, extra = {}) {
  const s = summarizeAttempt(text, res);
  const system = `${COACH_STYLE}\n${learner()}`;
  const user = `Sentence: "${text}"\nOverall sound accuracy: ${s.score}/100.\nSound-level findings from the scoring model:\n${s.issues.length ? s.issues.map(x => '- ' + x).join('\n') : '- none'}\n${extra.melody ? 'Melody: ' + extra.melody + '\n' : ''}${extra.stress ? 'Word stress: ' + extra.stress + '\n' : ''}\nWrite 3 to 5 short bullet points: the most important fix first, each with a concrete way to do it and one example word from the sentence. If there are no issues, give one tip to sound more natural (linking, reductions or stress). Keep it under 110 words. The scoring model can be wrong; if a finding looks implausible for this learner, say so briefly.`;
  return ask(system, [{ role: 'user', content: user }], { maxTokens: 400 });
}

export async function makeDrills(unitIds, context = 'hospital and clinical work') {
  const sounds = unitIds.map(id => UMAP[id]).filter(Boolean).map(u => `/${u.ipa}/ (${u.name}, as in “${u.key}”)`).join(', ');
  const system = `${COACH_STYLE}\n${learner()}`;
  const user = `Write 8 natural sentences a physician might really say, about ${context}, that pack in these target sounds: ${sounds}. 8 to 14 words each, everyday spoken American English, no tongue twisters, no names. Return only a JSON array of strings.`;
  const txt = await ask(system, [{ role: 'user', content: user }], { maxTokens: 700 });
  const m = txt.match(/\[[\s\S]*\]/);
  const arr = m ? JSON.parse(m[0]) : [];
  return arr.filter(s => typeof s === 'string' && s.length > 8 && s.length < 160).slice(0, 8);
}

export function scenarioSystem(sc) {
  return `You are role-playing ${sc.them}. The learner plays ${sc.you}. ${learner()}\nStay in character. Speak naturally as an American would in this situation: 1 to 3 short sentences per turn, contractions, everyday words. Ask one question or react, so the learner keeps talking. Never mention pronunciation or that this is practice. If the learner's message looks garbled, it came from speech recognition: respond to the most likely meaning, or ask them to repeat as a real person would.`;
}
export async function converse(sc, turns) {
  return ask(scenarioSystem(sc), turns.map(t => ({ role: t.role, content: t.text })), { maxTokens: 220 });
}
export async function conversationFeedback(sc, turns, pronunciation) {
  const system = `${COACH_STYLE}\n${learner()}`;
  const transcript = turns.map(t => `${t.role === 'user' ? 'LEARNER' : 'PARTNER'}: ${t.text}`).join('\n');
  const user = `Role-play: ${sc.name} (learner as ${sc.you}).\nTranscript (learner lines come from speech recognition, so odd words may be recognition errors caused by pronunciation):\n${transcript}\n\nSound-level findings across the learner's turns:\n${pronunciation || 'not available'}\n\nGive feedback in three short sections with these exact headings:\nPronunciation: the 2 or 3 sounds or patterns to work on, with a physical tip each.\nNatural phrasing: up to 3 learner lines rewritten the way an American physician would say them (quote original → better).\nDo next: one specific exercise for tomorrow.\nUnder 200 words total.`;
  return ask(system, [{ role: 'user', content: user }], { maxTokens: 700 });
}
