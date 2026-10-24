/**
 * Mumble 0.3.0 — small, deterministic voices for imaginary characters.
 * Original implementation. No audio samples, models or dependencies.
 *
 * Only A/E/I/O/U (including accented forms) are vocalized. Punctuation shapes
 * their timing and pitch. This is expressive mumble speech, not intelligible TTS.
 * Pure rendering and WAV encoding work in browsers and Node. Playback uses Web Audio.
 */

export const VERSION = '0.3.0';
export const SAMPLE_RATE = 24000;
export const MAX_CHARACTERS = 500;
export const MAX_DURATION = 60;

const TAU = Math.PI * 2;
const TABLE_SIZE = 2048;
const EMOTION_ALIASES = Object.freeze({ neutral: 0, happy: 1, sad: -1, angry: 0.65, curious: 0.35 });
const STYLE_ALIASES = Object.freeze({ beep: 0, mumble: 0.5, robot: 1 });
// Deliberately pronounced contours remain audible on short vowel-only phrases.
// These shape timing/pitch only; punctuation does not raise the output level.
const PROSODY = Object.freeze({
  periodHold: 1.9, periodFall: 4,
  questionHold: 1.85, questionRise: 8,
  exclamationHold: 1.55, exclamationLaunch: 7,
  hesitation: 0.88,
});

const DEFAULTS = Object.freeze({
  pitch: 270, speed: 1, variation: 0.42, brightness: 0.55,
  breathiness: 0.12, roughness: 0.06, volume: 0.7,
  mood: 0, seed: 42, voiceType: 0.5,
});

function preset(name, description, options) {
  return Object.freeze({ name, description, options: Object.freeze({ ...DEFAULTS, ...options }) });
}

export const PRESETS = Object.freeze({
  sprout: preset('Sprout', 'A curious little forest dweller.', { pitch: 270, speed: 1.08, variation: 0.48, brightness: 0.58, breathiness: 0.1, roughness: 0.03 }),
  pip: preset('Pip', 'Tiny, excitable, and full of questions.', { pitch: 420, speed: 1.28, variation: 0.64, brightness: 0.75, breathiness: 0.04, roughness: 0.02, mood: 0.85, voiceType: 0.38 }),
  byte: preset('Byte', 'A friendly robot with a digital accent.', { pitch: 185, speed: 1.05, variation: 0.12, brightness: 0.7, breathiness: 0, roughness: 0.08, voiceType: 1 }),
  grumble: preset('Grumble', 'Low, gravelly, and secretly kind.', { pitch: 105, speed: 0.78, variation: 0.29, brightness: 0.25, breathiness: 0.1, roughness: 0.58, mood: -0.35, voiceType: 0.62 }),
  wisp: preset('Wisp', 'A soft, airy voice from somewhere magical.', { pitch: 350, speed: 0.85, variation: 0.46, brightness: 0.7, breathiness: 0.6, roughness: 0, mood: -0.15 }),
  orbit: preset('Orbit', 'An inquisitive visitor from another planet.', { pitch: 225, speed: 1.08, variation: 0.83, brightness: 0.9, breathiness: 0.08, roughness: 0.22, mood: 0.4, voiceType: 0.68 }),
  ember: preset('Ember', 'A bold little adventurer with a raspy edge.', { pitch: 195, speed: 1.14, variation: 0.55, brightness: 0.48, breathiness: 0.12, roughness: 0.36, mood: 0.5, voiceType: 0.6 }),
  sage: preset('Sage', 'A measured, warm, story-telling voice.', { pitch: 145, speed: 0.76, variation: 0.34, brightness: 0.38, breathiness: 0.2, roughness: 0.1, mood: -0.2, voiceType: 0.45 }),
});

const NUMERIC_RANGES = Object.freeze({
  pitch: [60, 700], speed: [0.35, 2.5], variation: [0, 1], brightness: [0, 1],
  breathiness: [0, 1], roughness: [0, 1], volume: [0, 1], mood: [-1, 1], voiceType: [0, 1],
});

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** Validate and clamp options. Unknown keys are ignored; invalid values throw. */
export function normalizeOptions(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Mumble options must be an object.');
  }
  const normalized = { ...DEFAULTS };
  // Old categorical inputs remain accepted for saved presets/imports. The
  // normalized output is numeric; explicit new values take precedence.
  if (options.emotion !== undefined) {
    if (!Object.hasOwn(EMOTION_ALIASES, options.emotion)) throw new TypeError('Mumble emotion must be neutral, happy, sad, angry or curious.');
    normalized.mood = EMOTION_ALIASES[options.emotion];
  }
  if (options.style !== undefined) {
    if (!Object.hasOwn(STYLE_ALIASES, options.style)) throw new TypeError('Mumble style must be mumble, beep or robot.');
    normalized.voiceType = STYLE_ALIASES[options.style];
  }
  for (const [key, [low, high]] of Object.entries(NUMERIC_RANGES)) {
    if (options[key] === undefined) continue;
    if (typeof options[key] !== 'number' || !Number.isFinite(options[key])) {
      throw new TypeError(`Mumble option "${key}" must be a finite number.`);
    }
    normalized[key] = clamp(options[key], low, high);
  }
  if (options.seed !== undefined) {
    if (typeof options.seed !== 'number' || !Number.isFinite(options.seed) || !Number.isInteger(options.seed)) {
      throw new TypeError('Mumble option "seed" must be a finite integer.');
    }
    normalized.seed = options.seed >>> 0;
  }
  return normalized;
}

function moodShape(mood) {
  return {
    pitch: 2 ** (mood * 2 / 12),
    pace: 1 + mood * (mood < 0 ? 0.18 : 0.15),
    range: 1 + mood * 0.4,
    grit: Math.max(0, mood) * 0.035,
  };
}

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let number = Math.imul(state ^ (state >>> 15), 1 | state);
    number ^= number + Math.imul(number ^ (number >>> 7), 61 | number);
    return ((number ^ (number >>> 14)) >>> 0) / 4294967296;
  };
}

function validateText(text) {
  if (typeof text !== 'string') throw new TypeError('Mumble text must be a string.');
  if (Array.from(text).length > MAX_CHARACTERS) {
    throw new RangeError(`Mumble accepts at most ${MAX_CHARACTERS} Unicode characters per utterance.`);
  }
}

const VOWEL_INDEX = { a: 0, e: 1, i: 2, o: 3, u: 4 };
const VOWEL_NAMES = ['ah', 'eh', 'ee', 'oh', 'oo'];

function basicLetter(char) {
  return char.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function speechHash(text) {
  // Punctuation changes expression, not the random identity of the underlying
  // vowels. Whitespace is removed too, keeping formatting from reseeding audio.
  return hashText(text.normalize('NFD').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase());
}

function shapeSentence(vowels, marks) {
  if (!vowels.length) return;
  const count = vowels.length;
  const questionCount = Math.min(2, count);
  const exclamationCount = Math.min(3, count);
  for (let i = 0; i < count; i++) {
    const event = vowels[i];
    let startSemitones = -0.45 * i / count;
    let endSemitones = -0.45 * (i + 1) / count;
    if (marks.includes('?') && i >= count - questionCount) {
      const offset = i - (count - questionCount);
      startSemitones += PROSODY.questionRise * (offset / questionCount) ** 1.7;
      endSemitones += PROSODY.questionRise * ((offset + 1) / questionCount) ** 1.7;
    }
    if (marks.includes('!') && i < exclamationCount) {
      startSemitones += PROSODY.exclamationLaunch * (1 - i / exclamationCount) ** 1.5;
      endSemitones += PROSODY.exclamationLaunch * (1 - (i + 1) / exclamationCount) ** 1.5;
    }
    if (marks === '.' && i === count - 1) endSemitones -= PROSODY.periodFall;
    event.pitchStart = clamp(event.pitch * 2 ** (startSemitones / 12), 45, 1100);
    event.pitchEnd = clamp(event.pitch * 2 ** (endSemitones / 12), 45, 1100);
    event.pitch = Math.sqrt(event.pitchStart * event.pitchEnd);
  }
  if (marks === '.') vowels[count - 1].duration *= PROSODY.periodHold;
  if (marks.includes('?')) vowels[count - 1].duration *= PROSODY.questionHold;
  if (marks.includes('!')) vowels[0].duration *= PROSODY.exclamationHold;
}

/** Build a text-synchronised timeline. Indices are UTF-16 offsets for String.slice. */
export function planSpeech(text, options = {}) {
  validateText(text);
  const voice = normalizeOptions(options);
  if (!text.trim()) return { text, options: voice, events: [], duration: 0 };
  const mood = moodShape(voice.mood);
  const random = randomGenerator(speechHash(text) ^ voice.seed);
  const chars = Array.from(text);
  const events = [];
  let index = 0;
  let wordIndex = -1;
  let inWord = false;
  let wordPitch = 0;

  for (let position = 0; position < chars.length; position++) {
    const char = chars[position];
    const isWordCharacter = /[\p{L}\p{N}\p{M}]/u.test(char);
    if (isWordCharacter && !inWord) {
      wordIndex++;
      inWord = true;
      wordPitch = (random() - 0.5) * 4.3 * voice.variation * mood.range;
    }
    const letter = basicLetter(char);
    if (Object.hasOwn(VOWEL_INDEX, letter)) {
      const vowel = VOWEL_INDEX[letter];
      const randomPitch = (random() - 0.5) * 3 * voice.variation * mood.range;
      const pitch = clamp(voice.pitch * mood.pitch * 2 ** ((wordPitch + randomPitch) / 12), 45, 1100);
      const duration = 0.12 * (0.93 + random() * 0.14 * voice.variation + (char !== char.toLowerCase() ? 0.04 : 0)) / (voice.speed * mood.pace);
      events.push({ char, index, start: 0, duration, phoneme: VOWEL_NAMES[vowel], wordIndex, kind: 'vowel', vowel, pitch, pitchStart: pitch, pitchEnd: pitch });
    } else {
      // Silent letters retain an event for text highlighting but consume no
      // synthesis time. Whitespace and punctuation can add deliberate silence.
      const pause = /\n/u.test(char) ? 0.3 : /\s/u.test(char) ? 0.055 : /[,;:]/u.test(char) ? 0.12 : 0;
      const punctuation = /[.!?…]/u.test(char);
      const kind = pause > 0 || punctuation ? 'pause' : 'silent';
      events.push({ char, index, start: 0, duration: pause / Math.sqrt(voice.speed * mood.pace), phoneme: kind, wordIndex: Math.max(0, wordIndex), kind, vowel: -1, pitch: 0, pitchStart: 0, pitchEnd: 0 });
    }
    if (!isWordCharacter && !['\'', '’'].includes(char)) inWord = false;
    index += char.length;
  }

  let sentenceStart = 0;
  for (let i = 0; i < events.length; i++) {
    if (!/[.!?…\n]/u.test(events[i].char)) continue;
    let groupEnd = i + 1;
    if (events[i].char !== '\n') {
      while (groupEnd < events.length && /[.!?…]/u.test(events[groupEnd].char)) groupEnd++;
    }
    const marks = events.slice(i, groupEnd).map(event => event.char).join('');
    const ellipsis = marks.includes('…') || marks.includes('..');
    // Every run of dots is one hesitation. A Unicode ellipsis is equivalent.
    if (events[i].char !== '\n') events[i].duration = (ellipsis ? PROSODY.hesitation : marks === '.' ? 0.08 : 0.09) / Math.sqrt(voice.speed * mood.pace);
    // A hesitation does not start a new sentence. Defer its pitch shaping until
    // the eventual sentence ending so ! still reaches the original beginning.
    // Mixed punctuation such as ...? or …! does close the current sentence.
    if (!ellipsis || /[?!]/u.test(marks)) {
      const vowels = events.slice(sentenceStart, i).filter(event => event.kind === 'vowel');
      shapeSentence(vowels, marks);
      sentenceStart = groupEnd;
    }
    i = groupEnd - 1;
  }
  shapeSentence(events.slice(sentenceStart).filter(event => event.kind === 'vowel'), '');
  const hasActivity = events.some(event => event.duration > 0);
  const hasVowels = events.some(event => event.kind === 'vowel');
  let cursor = hasActivity ? 0.012 : 0;
  for (const event of events) { event.start = cursor; cursor += event.duration; }
  const duration = cursor + (hasVowels ? 0.045 : 0);
  if (duration > MAX_DURATION) throw new RangeError(`Mumble speech exceeds ${MAX_DURATION} seconds. Shorten the text or increase speed.`);
  return { text, options: voice, events, duration };
}

// Three resonant regions of a vocal tract. Values are design controls, not a
// language pronunciation dictionary. Harmonic tables are generated from scratch.
const FORMANTS = [
  [760, 1250, 2650], [520, 1800, 2550], [310, 2300, 3050],
  [500, 900, 2450], [340, 720, 2250], [520, 1300, 2550],
];

function makeVowelTable(vowel, basePitch, brightness, maximumPitch) {
  const table = new Float32Array(TABLE_SIZE + 1);
  const scale = 0.76 + brightness * 0.57;
  const formants = FORMANTS[vowel].map(value => value * scale);
  const bandwidths = [100, 165, 230];
  const weights = [1.7, 1.05, 0.62];
  // Reserve headroom for the highest planned pitch and its fine vibrato, so
  // table playback does not fold upper harmonics across the Nyquist frequency.
  const harmonics = Math.min(72, Math.floor((SAMPLE_RATE * 0.46) / maximumPitch));
  for (let harmonic = 1; harmonic <= harmonics; harmonic++) {
    const frequency = basePitch * harmonic;
    let envelope = 0.035;
    for (let formant = 0; formant < 3; formant++) {
      const distance = (frequency - formants[formant]) / bandwidths[formant];
      envelope += weights[formant] / (1 + distance * distance);
    }
    // Retain a quiet fundamental for warmth and a glottal spectral tilt.
    const amplitude = envelope / Math.pow(harmonic, 0.85) + (harmonic === 1 ? 0.09 : 0);
    const step = TAU * harmonic / TABLE_SIZE;
    for (let i = 0; i < TABLE_SIZE; i++) table[i] += Math.sin(step * i) * amplitude;
  }
  let peak = 0;
  for (let i = 0; i < TABLE_SIZE; i++) peak = Math.max(peak, Math.abs(table[i]));
  const gain = peak > 0 ? 0.82 / peak : 0;
  for (let i = 0; i < TABLE_SIZE; i++) table[i] *= gain;
  table[TABLE_SIZE] = table[0];
  return table;
}

function lookup(table, phase) {
  const position = phase * TABLE_SIZE;
  const lower = Math.floor(position);
  return table[lower] + (table[lower + 1] - table[lower]) * (position - lower);
}

/** Render mono, 24 kHz floating-point PCM without using a browser or audio device. */
export function renderSpeech(text, options = {}) {
  const plan = planSpeech(text, options);
  const voice = plan.options;
  const sampleCount = Math.ceil(plan.duration * SAMPLE_RATE);
  const samples = new Float32Array(sampleCount);
  if (!sampleCount) return { ...plan, samples, sampleRate: SAMPLE_RATE };
  const mood = moodShape(voice.mood);
  const basePitch = voice.pitch * mood.pitch;
  const maximumPitch = Math.max(basePitch, ...plan.events.flatMap(event => [event.pitchStart, event.pitchEnd])) * 1.07;
  const tables = FORMANTS.map((_, i) => makeVowelTable(i, basePitch, voice.brightness, maximumPitch));
  const random = randomGenerator((speechHash(text) ^ voice.seed ^ 0x95c43a) >>> 0);
  const grit = clamp(voice.roughness + mood.grit, 0, 1);
  const blipWeight = Math.max(0, 1 - voice.voiceType * 2);
  const robotWeight = Math.max(0, voice.voiceType * 2 - 1);
  const mumbleWeight = 1 - blipWeight - robotWeight;
  let phase = 0;
  let robotPhase = 0;
  let subPhase = 0;
  let lastNoise = 0;
  let previousVowel = -1;

  for (const event of plan.events) {
    if (event.kind !== 'vowel') {
      if (event.duration > 0.08) previousVowel = -1;
      continue;
    }
    const start = Math.round(event.start * SAMPLE_RATE);
    const count = Math.max(1, Math.round(event.duration * SAMPLE_RATE));
    const table = tables[event.vowel];
    const previousTable = previousVowel < 0 ? table : tables[previousVowel];
    const vibratoPhase = random() * TAU;
    const pitchJitter = (random() - 0.5) * voice.variation * 0.02;

    for (let j = 0; j < count && start + j < samples.length; j++) {
      const progress = j / Math.max(1, count - 1);
      const seconds = j / SAMPLE_RATE;
      const glide = progress * progress * (3 - 2 * progress);
      let frequency = event.pitchStart + (event.pitchEnd - event.pitchStart) * glide;
      frequency *= 1 + Math.sin(seconds * TAU * 5.2 + vibratoPhase) * voice.variation * 0.012 + pitchJitter;
      phase += frequency / SAMPLE_RATE;
      phase -= Math.floor(phase);
      const robotFrequency = 55 * 2 ** (Math.round(12 * Math.log2(frequency / 55)) / 12);
      robotPhase += robotFrequency / SAMPLE_RATE;
      robotPhase -= Math.floor(robotPhase);
      subPhase += frequency / (SAMPLE_RATE * 2);
      subPhase -= Math.floor(subPhase);
      const noise = random() * 2 - 1;
      const highNoise = (noise - lastNoise) * 0.5;
      lastNoise = noise;
      const blend = Math.min(1, progress * 4.5);
      const subharmonic = Math.sin(subPhase * TAU);
      const textureGain = 1 - grit * 0.22 + subharmonic * grit * 0.22;
      const breath = highNoise * voice.breathiness * 0.18 * (0.45 + Math.abs(Math.sin(phase * TAU)));
      const blip = Math.sin(phase * TAU) * 0.57 + Math.sin(phase * TAU * 2) * 0.12 * voice.brightness;
      const vowel = lookup(previousTable, phase) * (1 - blend) + lookup(table, phase) * blend;
      const mumble = (vowel + subharmonic * grit * 0.18) * textureGain + breath;
      let robot = (lookup(previousTable, robotPhase) * (1 - blend) + lookup(table, robotPhase) * blend + subharmonic * grit * 0.18) * textureGain + breath;
      const levels = 20 + 30 * (1 - grit);
      robot = Math.round(robot * levels) / levels;
      robot *= 0.78 + Math.sin((start + j) / SAMPLE_RATE * TAU * 38) * 0.22;
      // A continuous, linear crossfade: no thresholds or categorical jumps.
      const signal = blip * blipWeight + mumble * mumbleWeight + robot * robotWeight;
      // Short raised-cosine edges prevent hard discontinuities between syllables.
      const attack = Math.min(1, seconds / 0.006);
      const release = Math.min(1, ((count - 1 - j) / SAMPLE_RATE) / 0.01);
      const envelope = Math.sin(attack * Math.PI / 2) ** 2 * Math.sin(Math.max(0, release) * Math.PI / 2) ** 2;
      samples[start + j] = signal * envelope;
    }
    previousVowel = event.vowel;
  }

  // Fixed headroom with peak limiting only when necessary. Volume stays meaningful.
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const gain = voice.volume * 0.9 / Math.max(1, peak);
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return { ...plan, duration: samples.length / SAMPLE_RATE, samples, sampleRate: SAMPLE_RATE };
}

/** Encode a rendered utterance as a mono, 16-bit PCM RIFF/WAV file. */
export function encodeWav(rendered) {
  if (!rendered || !(rendered.samples instanceof Float32Array) || !Number.isInteger(rendered.sampleRate) || rendered.sampleRate < 8000 || rendered.sampleRate > 192000) {
    throw new TypeError('encodeWav expects a rendered utterance with Float32Array samples and a valid sampleRate.');
  }
  if (rendered.samples.length > 192000 * MAX_DURATION) throw new RangeError('The WAV buffer is too large.');
  const bytes = new Uint8Array(44 + rendered.samples.length * 2);
  const view = new DataView(bytes.buffer);
  const write = (offset, value) => { for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i); };
  write(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); write(8, 'WAVE');
  write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rendered.sampleRate, true); view.setUint32(28, rendered.sampleRate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, rendered.samples.length * 2, true);
  for (let i = 0; i < rendered.samples.length; i++) {
    const sample = rendered.samples[i];
    if (!Number.isFinite(sample)) throw new TypeError('WAV samples must contain only finite numbers.');
    const bounded = clamp(sample, -1, 1);
    view.setInt16(44 + i * 2, Math.round(bounded * (bounded < 0 ? 32768 : 32767)), true);
  }
  return bytes;
}

function abortError() {
  const error = new Error('Mumble playback was cancelled before it started.');
  error.name = 'AbortError';
  return error;
}

/** Browser playback engine. Call speak from a click/tap to unlock browser audio. */
export class Mumble {
  constructor(defaultOptions = {}, { context = null } = {}) {
    this.options = normalizeOptions(defaultOptions);
    this._context = context;
    this._ownsContext = !context;
    this._generation = 0;
    this._active = null;
    this._disposed = false;
  }

  setOptions(options = {}) {
    this.options = this._mergeOptions(options);
    return this;
  }

  _mergeOptions(options) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Mumble options must be an object.');
    const merged = { ...this.options, ...options };
    // A legacy override must replace the inherited numeric value, while an
    // explicitly supplied new numeric value always wins over its alias.
    if (options.emotion !== undefined && options.mood === undefined) delete merged.mood;
    if (options.style !== undefined && options.voiceType === undefined) delete merged.voiceType;
    return normalizeOptions(merged);
  }

  render(text, options = {}) { return renderSpeech(text, this._mergeOptions(options)); }
  toWav(text, options = {}) { return encodeWav(this.render(text, options)); }

  _getContext() {
    if (!this._context) {
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) throw new Error('Web Audio playback is unavailable. Use renderSpeech() or encodeWav() for offline audio.');
      this._context = new AudioContextClass();
    }
    if (this._context.state === 'closed') throw new Error('The AudioContext is closed. Create a new Mumble instance.');
    return this._context;
  }

  async speak(text, options = {}) {
    if (this._disposed) throw new Error('This Mumble instance has been disposed.');
    const combined = this._mergeOptions(options);
    // All work before the first await is still within the initiating gesture.
    // Validate/render first so a bad utterance never opens an audio device.
    const rendered = renderSpeech(text, combined);
    const request = ++this._generation;
    if (this._active) this._active.stop();
    this._active = null;
    const context = this._getContext();
    // Resume is requested synchronously, while the initiating gesture is active.
    const resumed = context.state === 'suspended' ? context.resume() : Promise.resolve();
    await resumed;
    if (request !== this._generation || this._disposed) throw abortError();
    if (context.state !== 'running') throw new Error('Audio could not start. Tap the play button again to enable browser audio.');
    const startTime = context.currentTime + 0.008;
    let source = null;
    let done = false;
    let stoppedTime = null;
    let resolveEnded;
    const ended = new Promise(resolve => { resolveEnded = resolve; });
    const finish = natural => {
      if (done) return;
      done = true;
      stoppedTime = natural ? rendered.duration : Math.min(rendered.duration, Math.max(0, context.currentTime - startTime));
      if (source) {
        source.onended = null;
        try { source.disconnect(); } catch { /* Already disconnected. */ }
      }
      if (this._active === handle) this._active = null;
      resolveEnded();
    };
    const handle = {
      rendered, context, startTime, ended,
      get currentTime() { return stoppedTime ?? Math.min(rendered.duration, Math.max(0, context.currentTime - startTime)); },
      stop() {
        if (done) return;
        if (source) { try { source.stop(); } catch { /* A completed source cannot be stopped twice. */ } }
        finish(false);
      },
    };
    this._active = handle;
    if (!rendered.samples.length) { finish(true); return handle; }
    const buffer = context.createBuffer(1, rendered.samples.length, rendered.sampleRate);
    buffer.copyToChannel(rendered.samples, 0);
    source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => finish(true);
    source.start(startTime);
    return handle;
  }

  stop() {
    this._generation++;
    if (this._active) this._active.stop();
    this._active = null;
  }

  async dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.stop();
    if (this._context && this._ownsContext && this._context.state !== 'closed') await this._context.close();
  }
}

export default Mumble;
