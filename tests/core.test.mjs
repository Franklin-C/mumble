import test from 'node:test';
import assert from 'node:assert/strict';
import { VERSION, Mumble, PRESETS, normalizeOptions, planSpeech, renderSpeech, encodeWav } from '../lib/mumble.js';

const vowels = plan => plan.events.filter(event => event.kind === 'vowel');
const nearlyEqual = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);

test('seeded synthesis is reproducible and changes with another seed', () => {
  const first = renderSpeech('Hello, little traveler!', { seed: 100 });
  const second = renderSpeech('Hello, little traveler!', { seed: 100 });
  const other = renderSpeech('Hello, little traveler!', { seed: 101 });
  assert.deepEqual(first.samples, second.samples);
  assert.notDeepEqual(first.samples, other.samples);
});

test('all eight voices and five morph positions produce finite, audible PCM with headroom', () => {
  assert.equal(VERSION, '0.3.0');
  for (const [name, preset] of Object.entries(PRESETS)) {
    for (const voiceType of [0, 0.25, 0.5, 0.75, 1]) {
      const audio = renderSpeech('Fresh potions! Any questions?', { ...preset.options, voiceType });
      let sum = 0;
      let peak = 0;
      for (const sample of audio.samples) {
        assert.ok(Number.isFinite(sample), name);
        peak = Math.max(peak, Math.abs(sample));
        sum += sample * sample;
      }
      assert.ok(peak < 1, `${name} clips`);
      assert.ok(Math.sqrt(sum / audio.samples.length) > 0.01, `${name} is silent`);
      assert.equal(audio.duration, audio.samples.length / audio.sampleRate);
    }
  }
});

test('only A/E/I/O/U and accented variants vocalize; all other letters are silent', () => {
  const text = 'bcdfghjklmnpqrstvwxyz 123! Á é î Ö ù';
  const plan = planSpeech(text);
  assert.equal(vowels(plan).map(event => event.char).join(''), 'ÁéîÖù');
  for (const event of plan.events.filter(event => event.kind === 'silent')) {
    assert.equal(event.duration, 0);
    assert.equal(event.phoneme, 'silent');
    assert.equal(event.pitch, 0);
    assert.equal(event.vowel, -1);
  }
  const consonants = renderSpeech('bcdfghjklmnpqrstvwxyz');
  assert.equal(consonants.samples.length, 0);
  assert.equal(consonants.events.length, 21);
  const noVowels = renderSpeech('Y, 123... 🌱');
  assert.ok(noVowels.samples.every(sample => sample === 0));
  assert.equal(vowels(planSpeech('a\u0301e\u0301')).length, 2);
});

test('punctuation leaves actual silent intervals and every UTF-16 index is preserved', () => {
  const rendered = renderSpeech('Hi, 🌱 café?... Later!');
  assert.equal(rendered.events.map(event => event.char).join(''), rendered.text);
  for (const event of rendered.events) {
    assert.equal(rendered.text.slice(event.index, event.index + event.char.length), event.char);
    if (event.phoneme === 'pause') {
      const interval = rendered.samples.subarray(Math.ceil((event.start + 0.002) * rendered.sampleRate), Math.floor((event.start + event.duration - 0.002) * rendered.sampleRate));
      assert.ok(interval.every(sample => sample === 0));
    }
  }
});

test('a period gives the final vowel a long, settled falling tail', () => {
  const plain = planSpeech('Good friends', { variation: 0.7 });
  const stopped = planSpeech('Good friends.', { variation: 0.7 });
  const a = vowels(plain);
  const b = vowels(stopped);
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) {
    nearlyEqual(b[i].duration, a[i].duration * (i === a.length - 1 ? 1.9 : 1));
    nearlyEqual(b[i].pitchStart, a[i].pitchStart);
    nearlyEqual(b[i].pitchEnd, a[i].pitchEnd * (i === a.length - 1 ? 2 ** (-4 / 12) : 1));
  }
  assert.ok(stopped.events.at(-1).duration > 0);
  assert.ok(stopped.events.at(-1).duration < 0.15);
});

test('question marks raise the ending; exclamation marks raise the beginning', () => {
  const plain = vowels(planSpeech('aeiou', { variation: 0.6 }));
  const question = vowels(planSpeech('aeiou?', { variation: 0.6 }));
  const exclamation = vowels(planSpeech('aeiou!', { variation: 0.6 }));
  nearlyEqual(question[0].pitchStart, plain[0].pitchStart);
  nearlyEqual(exclamation.at(-1).pitchEnd, plain.at(-1).pitchEnd);
  nearlyEqual(question.at(-1).pitchEnd / plain.at(-1).pitchEnd, 2 ** (8 / 12));
  nearlyEqual(exclamation[0].pitchStart / plain[0].pitchStart, 2 ** (7 / 12));
  nearlyEqual(question.at(-1).duration / plain.at(-1).duration, 1.85);
  nearlyEqual(exclamation[0].duration / plain[0].duration, 1.55);
  const singleQuestion = vowels(planSpeech('Hi?', { variation: 0 }))[0];
  const singleExclamation = vowels(planSpeech('Hi!', { variation: 0 }))[0];
  assert.ok(singleQuestion.pitchEnd > singleQuestion.pitchStart * 1.5);
  assert.ok(singleExclamation.pitchStart > singleExclamation.pitchEnd * 1.5);
  assert.notDeepEqual(renderSpeech('Hi?', { variation: 0 }).samples, renderSpeech('Hi!', { variation: 0 }).samples);
});

test('each sentence receives its own punctuation contour', () => {
  const combined = vowels(planSpeech('a? e! i.', { variation: 0 }));
  assert.ok(combined[0].pitchEnd > combined[0].pitchStart);
  assert.ok(combined[1].pitchStart > combined[1].pitchEnd);
  nearlyEqual(combined[2].duration / vowels(planSpeech('i', { variation: 0 }))[0].duration, 1.9);
});

test('ASCII dot runs and Unicode ellipsis produce one equivalent pause, without a period hold', () => {
  const double = renderSpeech('a..e', { variation: 0.3 });
  const triple = renderSpeech('a...e', { variation: 0.3 });
  const unicode = renderSpeech('a…e', { variation: 0.3 });
  assert.deepEqual(double.samples, triple.samples);
  assert.deepEqual(triple.samples, unicode.samples);
  const positivePauses = triple.events.filter(event => event.kind === 'pause' && event.duration > 0);
  assert.equal(positivePauses.length, 1);
  nearlyEqual(positivePauses[0].duration, 0.88);
  nearlyEqual(vowels(triple)[0].duration, vowels(planSpeech('ae', { variation: 0.3 }))[0].duration);
  assert.equal(triple.events.map(event => event.char).join(''), 'a...e');
  assert.equal(unicode.events.map(event => event.char).join(''), 'a…e');
});

test('ellipses preserve sentence-wide ! beginning and ? ending contours', () => {
  const options = { variation: 0, mood: 0, pitch: 270 };
  for (const pause of ['..', '...', '…']) {
    for (const ending of ['!', '?']) {
      const withPause = vowels(planSpeech(`A${pause} e${ending}`, options));
      const withoutPause = vowels(planSpeech(`A e${ending}`, options));
      assert.equal(withPause.length, 2);
      for (let i = 0; i < withPause.length; i++) {
        nearlyEqual(withPause[i].pitchStart, withoutPause[i].pitchStart);
        nearlyEqual(withPause[i].pitchEnd, withoutPause[i].pitchEnd);
      }
      if (ending === '!') assert.ok(withPause[0].pitchStart > withPause[1].pitchStart);
      if (ending === '?') assert.ok(withPause[1].pitchEnd > withPause[0].pitchEnd);
    }
    // Explicit ?/! attached to a hesitation still ends the sentence.
    const mixed = vowels(planSpeech(`A${pause}! e?`, options));
    const separate = vowels(planSpeech('A! e?', options));
    for (let i = 0; i < mixed.length; i++) {
      nearlyEqual(mixed[i].pitchStart, separate[i].pitchStart);
      nearlyEqual(mixed[i].pitchEnd, separate[i].pitchEnd);
    }
  }
});

test('punctuation preserves seeded identity outside the affected expression', () => {
  const options = { seed: 901, variation: 0.93 };
  const plain = planSpeech('Hello dear universe', options);
  const reference = vowels(plain);
  for (const mark of ['.', '?', '!', '…']) {
    const marked = planSpeech(`Hello dear universe${mark}`, options);
    const current = vowels(marked);
    assert.deepEqual(current.map(event => event.char), reference.map(event => event.char));
    assert.deepEqual(marked.options, plain.options);
    // This middle vowel falls outside the opening/end contours. Its random
    // pitch and duration must not be reseeded by the punctuation change.
    nearlyEqual(current[3].pitchStart, reference[3].pitchStart);
    nearlyEqual(current[3].pitchEnd, reference[3].pitchEnd);
    nearlyEqual(current[3].duration, reference[3].duration);
  }
  const unchanged = renderSpeech('Hello there', options);
  const hesitation = renderSpeech('Hello there…', options);
  assert.deepEqual(hesitation.samples.subarray(0, unchanged.samples.length), unchanged.samples);
  assert.notEqual(vowels(planSpeech('Hello dear universe', { ...options, seed: 902 }))[3].pitchStart, reference[3].pitchStart);
});

test('rendered audio contains clearly different rising, launching and settling ramps', () => {
  const measurePitch = (audio, start, end) => {
    const crossings = [];
    const lo = Math.max(1, Math.ceil(start * audio.sampleRate));
    const hi = Math.min(audio.samples.length, Math.floor(end * audio.sampleRate));
    for (let i = lo; i < hi; i++) {
      const before = audio.samples[i - 1];
      const after = audio.samples[i];
      if (before <= 0 && after > 0) crossings.push(i - 1 - before / (after - before));
    }
    assert.ok(crossings.length >= 3);
    return (crossings.length - 1) * audio.sampleRate / (crossings.at(-1) - crossings[0]);
  };
  const ratios = {};
  for (const mark of ['.', '?', '!']) {
    const audio = renderSpeech(`a${mark}`, { pitch: 270, variation: 0, voiceType: 0, mood: 0 });
    const event = vowels(audio)[0];
    const early = measurePitch(audio, event.start + event.duration * 0.12, event.start + event.duration * 0.32);
    const late = measurePitch(audio, event.start + event.duration * 0.68, event.start + event.duration * 0.88);
    ratios[mark] = late / early;
  }
  assert.ok(ratios['?'] > 1.3, 'Question audio must rise noticeably.');
  assert.ok(ratios['!'] < 0.78, 'Exclamation audio must launch high and fall.');
  assert.ok(ratios['.'] < 0.87, 'Period audio must settle audibly.');
});

test('strong punctuation stays finite and below clipping at extreme controls', () => {
  for (const pitch of [60, 700]) {
    for (const mood of [-1, 1]) {
      for (const speed of [0.35, 2.5]) {
        for (const voiceType of [0, 0.5, 1]) {
          const audio = renderSpeech('A! E? I. O... U?!', {
            pitch, mood, speed, voiceType, variation: 1, brightness: 1,
            breathiness: 1, roughness: 1, volume: 1, seed: 12345,
          });
          let peak = 0;
          for (const sample of audio.samples) {
            assert.ok(Number.isFinite(sample));
            peak = Math.max(peak, Math.abs(sample));
          }
          assert.ok(peak > 0.05 && peak < 0.901);
          for (const event of vowels(audio)) {
            assert.ok(event.pitchStart >= 45 && event.pitchStart <= 1100);
            assert.ok(event.pitchEnd >= 45 && event.pitchEnd <= 1100);
            assert.ok(Number.isFinite(event.duration) && event.duration > 0);
          }
        }
      }
    }
  }
});

test('speed, volume and continuous mood have material effects', () => {
  const slow = renderSpeech('Adventure awaits.', { speed: 0.6 });
  const fast = renderSpeech('Adventure awaits.', { speed: 1.8 });
  assert.ok(slow.duration > fast.duration * 2);
  assert.ok(renderSpeech('Quiet now.', { volume: 0 }).samples.every(sample => sample === 0));
  const subdued = planSpeech('Do you know?', { mood: -1, variation: 0 });
  const neutral = planSpeech('Do you know?', { mood: 0, variation: 0 });
  const animated = planSpeech('Do you know?', { mood: 1, variation: 0 });
  assert.ok(subdued.duration > neutral.duration && neutral.duration > animated.duration);
  assert.ok(vowels(subdued)[0].pitch < vowels(neutral)[0].pitch);
  assert.ok(vowels(neutral)[0].pitch < vowels(animated)[0].pitch);
  const nearA = vowels(planSpeech('ae', { mood: 0.499, variation: 0 }))[0].pitch;
  const nearB = vowels(planSpeech('ae', { mood: 0.501, variation: 0 }))[0].pitch;
  assert.ok(Math.abs(nearA - nearB) < 0.1);
});

test('voice type is a continuous audio blend with distinct endpoints', () => {
  const blip = renderSpeech('Hello!', { voiceType: 0 });
  const quarter = renderSpeech('Hello!', { voiceType: 0.25 });
  const mumble = renderSpeech('Hello!', { voiceType: 0.5 });
  const robot = renderSpeech('Hello!', { voiceType: 1 });
  assert.equal(blip.samples.length, robot.samples.length);
  assert.notDeepEqual(blip.samples, mumble.samples);
  assert.notDeepEqual(robot.samples, mumble.samples);
  // At .25, samples are the linear midpoint of blip and mumble (float tolerance).
  for (let i = 0; i < quarter.samples.length; i++) {
    nearlyEqual(quarter.samples[i], (blip.samples[i] + mumble.samples[i]) / 2, 1e-7);
  }
  const left = renderSpeech('Hello!', { voiceType: 0.499 });
  const right = renderSpeech('Hello!', { voiceType: 0.501 });
  let meanDifference = 0;
  for (let i = 0; i < left.samples.length; i++) meanDifference += Math.abs(left.samples[i] - right.samples[i]);
  assert.ok(meanDifference / left.samples.length < 0.002);
});

test('legacy inputs migrate to numeric options and instance overrides remain compatible', () => {
  const migrated = normalizeOptions({ emotion: 'happy', style: 'robot' });
  assert.equal(migrated.mood, 1);
  assert.equal(migrated.voiceType, 1);
  assert.equal('emotion' in migrated, false);
  assert.equal('style' in migrated, false);
  const numericWins = normalizeOptions({ emotion: 'happy', mood: -0.4, style: 'robot', voiceType: 0.2 });
  assert.equal(numericWins.mood, -0.4);
  assert.equal(numericWins.voiceType, 0.2);
  const engine = new Mumble({ mood: 0.7, voiceType: 0.8 });
  engine.setOptions({ emotion: 'sad', style: 'beep' });
  assert.equal(engine.options.mood, -1);
  assert.equal(engine.options.voiceType, 0);
  const overridden = engine.render('Hello', { emotion: 'curious', style: 'robot' });
  assert.equal(overridden.options.mood, 0.35);
  assert.equal(overridden.options.voiceType, 1);
  assert.equal(engine.options.voiceType, 0);
});

test('WAV headers describe exactly the exported PCM payload', () => {
  const audio = renderSpeech('Hello.');
  const wav = encodeWav(audio);
  const view = new DataView(wav.buffer);
  const decode = (start, length) => new TextDecoder().decode(wav.subarray(start, start + length));
  assert.equal(decode(0, 4), 'RIFF');
  assert.equal(decode(8, 4), 'WAVE');
  assert.equal(decode(36, 4), 'data');
  assert.equal(view.getUint32(4, true), wav.length - 8);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 24000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), audio.samples.length * 2);
  assert.equal(wav.length, 44 + audio.samples.length * 2);
});

test('empty input, invalid options and oversized input are handled deliberately', () => {
  const empty = renderSpeech('   ');
  assert.equal(empty.samples.length, 0);
  assert.equal(encodeWav(empty).length, 44);
  assert.throws(() => renderSpeech(null), TypeError);
  assert.throws(() => renderSpeech('a'.repeat(501)), RangeError);
  assert.throws(() => renderSpeech('a'.repeat(500), { speed: 0.35 }), RangeError);
  assert.throws(() => normalizeOptions({ pitch: NaN }), TypeError);
  assert.throws(() => normalizeOptions({ seed: 1.4 }), TypeError);
  assert.throws(() => normalizeOptions({ emotion: 'unknown' }), TypeError);
  assert.throws(() => normalizeOptions({ mood: Infinity }), TypeError);
  assert.throws(() => normalizeOptions({ voiceType: 'mumble' }), TypeError);
  assert.throws(() => encodeWav({ samples: new Float32Array([NaN]), sampleRate: 24000 }), TypeError);
  assert.equal(normalizeOptions({ pitch: 10000 }).pitch, 700);
  assert.equal(normalizeOptions({ speed: -1 }).speed, 0.35);
  assert.equal(normalizeOptions({ mood: 8 }).mood, 1);
  assert.equal(normalizeOptions({ voiceType: -2 }).voiceType, 0);
});

class MockAudioContext {
  constructor() { this.state = 'running'; this.currentTime = 10; this.destination = {}; this.sources = []; this.closed = false; }
  createBuffer(channels, length, sampleRate) { return { channels, length, sampleRate, copyToChannel() {} }; }
  createBufferSource() {
    const source = { connect() {}, disconnect() {}, start(time) { this.startedAt = time; }, stop() { this.stopped = true; } };
    this.sources.push(source); return source;
  }
  async close() { this.closed = true; this.state = 'closed'; }
  async resume() { this.state = 'running'; }
}

test('playback replacement stops the old source and external contexts survive disposal', async () => {
  const context = new MockAudioContext();
  const engine = new Mumble({}, { context });
  const first = await engine.speak('First');
  context.currentTime += 0.1;
  const second = await engine.speak('Second');
  await first.ended;
  assert.equal(context.sources[0].stopped, true);
  assert.ok(first.currentTime > 0);
  engine.stop();
  await second.ended;
  assert.equal(context.sources[1].stopped, true);
  await engine.dispose();
  assert.equal(context.closed, false);
  await assert.rejects(engine.speak('No'), /disposed/);
});

test('stop cancels a request while browser audio is resuming', async () => {
  const context = new MockAudioContext();
  context.state = 'suspended';
  let resume;
  context.resume = () => new Promise(resolve => { resume = () => { context.state = 'running'; resolve(); }; });
  const engine = new Mumble({}, { context });
  const pending = engine.speak('Wait');
  engine.stop();
  resume();
  await assert.rejects(pending, error => error.name === 'AbortError');
  assert.equal(context.sources.length, 0);
});
