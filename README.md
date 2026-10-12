# Accent Lab

A web app for training a clear General American accent. Record yourself and see which sounds landed, what each one sounded like instead, and how to fix it. Scoring runs on your own device.

## What it does

- **Sound-by-sound scoring.** A wav2vec2 phoneme recognizer runs in the browser (WebGPU, or WebAssembly on the CPU). Each expected sound is tested against every plausible substitute and against deletion, so feedback reads like “/θ/ sounded like a dental t” or “/v/ sounded like /w/”. Extra vowels in consonant clusters are detected too.
- **Accent check.** Twelve diagnostic sentences produce a profile of every sound, ranked by how much it matters for being understood.
- **Daily plan.** Built from your weakest sounds: an ear test, minimal pairs, practice lines, a rhythm or melody topic, spaced review of what you missed, and an optional conversation.
- **44 sound lessons.** Each has an animated side view of the mouth, step-by-step instructions, notes for 12 first languages, an ear test, scored minimal pairs, a word ladder and practice lines. Vowels also have a live **vowel mirror** that plots your tongue position (F1/F2) as you speak.
- **Rhythm and melody.** Word stress (measured from loudness, pitch and length of each vowel), flap T, linking, weak forms, stopped T, can/can’t, and seven intonation patterns. Your pitch is drawn against a typical American contour aligned to your own timing.
- **AI coach (optional).** Claude explains your mistakes, writes practice lines for your weak sounds, and plays the other person in role-plays (admitting a patient, rounds, conference Q&A, phone calls, small talk, interviews). Add an Anthropic API key in Settings.

## Privacy

Recordings are processed on your device and are never uploaded. Scores are stored in your browser’s local storage. The coach sends only text (sentences, transcripts and scoring summaries) to the Anthropic API, and only when you turn it on.

## Running it

It is a static site with no build step. Serve the folder over HTTPS (GitHub Pages works) or `localhost`, then open it in Chrome, Edge or Safari. The first time, the app downloads the speech model (about 240 MB) from Hugging Face and caches it for offline use.

`build.py` refreshes the service worker’s offline file list after you change files.

## How scoring works

1. Text is converted to expected phones with eSpeak NG (en-us), keeping weak forms and sentence stress.
2. The recognizer outputs phone probabilities every 20 ms; the expected phones are force-aligned to them with CTC.
3. For each phone, a goodness-of-pronunciation score compares the expected phone (and accepted American variants) with every substitute and with deletion over a short window, re-scored with the learner’s actual neighboring sounds.
4. Word stress and melody use the alignment plus pitch (YIN) and loudness.

The model judges sounds, not meaning. Treat single flags as hints and patterns across takes as signal. Strictness can be adjusted in Settings.

## Credits

- Phoneme model: [facebook/wav2vec2-lv-60-espeak-cv-ft](https://huggingface.co/facebook/wav2vec2-lv-60-espeak-cv-ft) (Apache-2.0), ONNX conversion by [onnx-community](https://huggingface.co/onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX). Downloaded at run time, not redistributed here.
- Runtime: [ONNX Runtime Web](https://github.com/microsoft/onnxruntime) (MIT).
- Phonemizer: [phonemizer.js](https://github.com/xenova/phonemizer.js) (Apache-2.0), which bundles [eSpeak NG](https://github.com/espeak-ng/espeak-ng) (GPL-3.0-or-later).
- Vowel targets: Hillenbrand, Getty, Clark & Wheeler (1995), *Acoustic characteristics of American English vowels*, JASA 97(5).
- Fonts: Schibsted Grotesk, Gentium Plus, IBM Plex Mono (SIL Open Font License).

See `licenses/` for third-party license texts.
