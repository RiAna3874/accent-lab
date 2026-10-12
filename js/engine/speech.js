// Browser text-to-speech (model voice) and speech recognition (for free conversation).
export const tts = {
  voices: [], voice: null, rate: 0.92, wanted: '',
  init(onChange) {
    if (!('speechSynthesis' in window)) return;
    const load = () => {
      const all = speechSynthesis.getVoices();
      const us = all.filter(v => /^en[-_]US/i.test(v.lang)), en = all.filter(v => /^en/i.test(v.lang));
      this.voices = us.length ? us : en;
      let p = this.voices.find(v => v.name === this.wanted);
      if (!p) for (const re of [/Ava.*(Natural|Premium|Enhanced)/i, /Aria.*Natural/i, /Jenny.*Natural/i, /Natural/i, /Google US English/i, /Samantha/i, /Ava/i, /Allison/i, /Zoe/i]) { p = this.voices.find(v => re.test(v.name)); if (p) break; }
      this.voice = p || this.voices[0] || null;
      onChange && onChange();
    };
    load();
    speechSynthesis.addEventListener ? speechSynthesis.addEventListener('voiceschanged', load) : (speechSynthesis.onvoiceschanged = load);
  },
  available() { return 'speechSynthesis' in window; },
  speak(text, { rate, onboundary, onend, onstart } = {}) {
    if (!this.available()) { onend && onend(); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.lang = (this.voice && this.voice.lang) || 'en-US';
    u.rate = rate || this.rate;
    if (onboundary) u.onboundary = onboundary;
    if (onstart) u.onstart = onstart;
    let ended = false; const end = () => { if (!ended) { ended = true; onend && onend(); } };
    u.onend = end; u.onerror = end;
    // Some browsers drop the end event; guard with a generous timeout.
    setTimeout(end, 1500 + text.length * 140 / (u.rate || 1));
    speechSynthesis.speak(u);
  },
  stop() { try { speechSynthesis.cancel(); } catch (e) {} }
};
export const speakAsync = (text, opts = {}) => new Promise(r => tts.speak(text, { ...opts, onend: r }));

const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
export const recognizer = { available: !!SR };
export const RECOG_ERRORS = {
  network: 'Speech recognition needs an internet connection.', 'not-allowed': 'Speech recognition wasn’t allowed to use the microphone.',
  'service-not-allowed': 'Speech recognition is turned off in this browser.', 'audio-capture': 'Speech recognition couldn’t open the microphone.',
  'no-speech': 'No speech was heard.', 'language-not-supported': 'US English recognition isn’t available here.', aborted: 'Recognition stopped.'
};
// Start recognition; returns {stop, done: Promise<{text, alts, err}>}.
export function listen({ continuous = false, onInterim } = {}) {
  if (!SR) return { stop() {}, done: Promise.resolve({ text: '', alts: [], err: 'unsupported' }) };
  const r = new SR();
  r.lang = 'en-US'; r.interimResults = true; r.maxAlternatives = 3; r.continuous = continuous;
  const finals = []; let interim = '', err = null;
  r.onresult = e => {
    interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) finals[i] = Array.from({ length: res.length }, (_, j) => res[j].transcript);
      else interim += res[0].transcript;
    }
    onInterim && onInterim((finals.filter(Boolean).map(a => a[0]).join(' ') + ' ' + interim).trim());
  };
  r.onerror = e => { err = e.error; };
  const done = new Promise(res => { r.onend = () => { const segs = finals.filter(Boolean); const text = (segs.map(a => a[0]).join(' ') || interim).trim(); res({ text, alts: segs[0] || [], err: text ? null : err }); }; });
  try { r.start(); } catch (e) { return { stop() {}, done: Promise.resolve({ text: '', alts: [], err: 'start' }) }; }
  return { stop: () => { try { r.stop(); } catch (e) {} }, done };
}
