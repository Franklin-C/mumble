# Mumble API

Version **0.3.0**. [Playground](https://franklin-c.github.io/mumble/) · [Quick start](README.md) · [TypeScript declarations](lib/mumble.d.ts)

Mumble synthesizes vowel-based character chatter. Pure rendering works in browsers and Node.js; playback uses the browser’s Web Audio API. The engine has no network calls or runtime dependencies.

## Contents

- [Installation and exports](#installation-and-exports)
- [Voice options](#voice-options)
- [Vowels, punctuation, and timing](#vowels-punctuation-and-timing)
- [Pure functions](#pure-functions)
- [Playback with Mumble](#playback-with-mumble)
- [Timeline and subtitles](#timeline-and-subtitles)
- [WAV examples](#wav-examples)
- [Validation and limits](#validation-and-limits)
- [Testing](#testing)

## Installation and exports

Copy `lib/mumble.js` and its adjacent `mumble.d.ts` into your project, or install the repository:

```sh
npm install github:Franklin-C/mumble
```

The package is not published to the npm registry. For a fixed revision, use `github:Franklin-C/mumble#COMMIT_SHA` with a real commit SHA from the repository.

```js
// Direct module import from the repository root:
import {
  Mumble,
  PRESETS,
  normalizeOptions,
  planSpeech,
  renderSpeech,
  encodeWav,
  VERSION,
  SAMPLE_RATE,
  MAX_CHARACTERS,
  MAX_DURATION,
} from './lib/mumble.js';

```

After installing from GitHub, use the package name instead:

```js
import { Mumble, PRESETS } from '@franklin-ai/mumble';
```

`Mumble` is also the default export.

| Constant | Value |
| --- | --- |
| `VERSION` | `'0.3.0'` |
| `SAMPLE_RATE` | `24000` Hz |
| `MAX_CHARACTERS` | `500` Unicode code points |
| `MAX_DURATION` | `60` seconds |

TypeScript exports include `VoiceOptions`, `VoiceInput`, `LegacyVoiceOptions`, `Emotion`, `VoiceStyle`, `VoicePreset`, `PresetName`, `SpeechEvent`, `SpeechPlan`, `RenderedSpeech`, and `Playback`.

## Voice options

All options are optional on input. `normalizeOptions()` supplies the defaults below. Presets may override them.

| Option | Default | Range | Effect |
| --- | --- | --- | --- |
| `pitch` | `270` | 60–700 Hz | Base fundamental frequency. Expression can move individual vowels above or below it. |
| `speed` | `1` | 0.35–2.5 | Timing multiplier; higher values speak faster. |
| `variation` | `0.42` | 0–1 | Seeded pitch/timing variation and fine vibrato. |
| `brightness` | `0.55` | 0–1 | Vowel color and upper-frequency emphasis. |
| `breathiness` | `0.12` | 0–1 | Air/noise mixed into audible vowels. |
| `roughness` | `0.06` | 0–1 | Subharmonic and irregular vocal texture. |
| `volume` | `0.7` | 0–1 | Output level; zero produces silent samples. |
| `mood` | `0` | −1–1 | Subdued at −1, neutral at 0, animated at 1. Smoothly changes pitch, pace, and variation. |
| `voiceType` | `0.5` | 0–1 | Blip at 0, vowel mumble at 0.5, robot at 1. Intermediate values continuously crossfade. |
| `seed` | `42` | Finite integer | Converted to an unsigned 32-bit integer for repeatable variation. |

Finite numeric controls outside their ranges are clamped. Numeric strings, `NaN`, infinities, and fractional seeds throw `TypeError`. Seed conversion wraps modulo 2³²; for example, `-1` becomes `4294967295`. Unknown option keys are ignored.

### Presets

`PRESETS` is a frozen object with these keys:

| Key | Character |
| --- | --- |
| `sprout` | Curious forest voice. |
| `pip` | Small, fast, excitable voice. |
| `byte` | Digital robot. |
| `grumble` | Low, rough voice. |
| `wisp` | Soft, airy voice. |
| `orbit` | Expressive alien voice. |
| `ember` | Bold, raspy voice. |
| `sage` | Warm, measured voice. |

Each entry contains `{ name, description, options }`. Spread the preset’s options to customize it:

```js
const options = normalizeOptions({
  ...PRESETS.sage.options,
  mood: 0.35,
  voiceType: 0.6,
  seed: 2026,
});

const voice = new Mumble(options);
```

Save the normalized object as JSON with your character data. Normalized options contain numeric `mood` and `voiceType`, not the legacy aliases.

### Compatibility aliases

Older inputs remain accepted:

| Legacy option | Mapping |
| --- | --- |
| `emotion` | `sad → −1`, `neutral → 0`, `curious → 0.35`, `angry → 0.65`, `happy → 1` for `mood`. |
| `style` | `beep → 0`, `mumble → 0.5`, `robot → 1` for `voiceType`. |

An explicitly provided numeric option takes precedence over its alias in the same call. An alias passed to `setOptions()`, `speak()`, `render()`, or `toWav()` replaces the inherited numeric default when that call does not also provide the numeric option. Unknown alias values throw `TypeError`.

## Vowels, punctuation, and timing

Only **A, E, I, O, and U** produce sound. Characters are lowercased and normalized with Unicode NFD accent folding, so forms such as `à`, `é`, `î`, `ö`, and `ū` use their base vowel. This is a stylized vowel system, not a pronunciation dictionary; `y`, consonants, digits, and characters that do not fold to one of those five vowels are silent.

Silent characters remain in the timeline with zero duration. Spaces and punctuation create pauses. This preserves the original text for subtitles without synthesizing consonants.

### Strong punctuation in 0.3

The factors below are relative to the same unpunctuated delivery before the punctuation is applied.

| Ending | Vocal change | Base pause |
| --- | --- | --- |
| `.` | Holds the final vowel for **1.9×** its normal duration and adds a **4-semitone settling drop** at its end. | 0.08 s |
| `?` | Rises by up to **8 semitones** across the final **two vowels** and holds the final vowel for **1.85×**. A single vowel receives its own rising ramp. | 0.09 s |
| `!` | Launches up to **7 semitones** higher, tapering across the first **three vowels**, and holds the first vowel for **1.55×**. | 0.09 s |
| `..`, `...`, or `…` | Creates one hesitation pause. It does not apply a period’s vowel hold. | **0.88 s** |
| `,`, `;`, or `:` | Adds a phrase pause. | 0.12 s |
| Space or other whitespace | Adds a short gap. | 0.055 s |
| Newline | Adds a longer gap and ends the current sentence scope. | 0.30 s |

Pause values are for `speed: 1` and `mood: 0`. They are divided by `sqrt(speed × moodPace)`, where `moodPace` is `1 + 0.18 × mood` for negative moods and `1 + 0.15 × mood` otherwise. Vowel durations also follow speed and mood.

Punctuation pitch ramps are rendered within each vowel. `pitchStart` and `pitchEnd` expose their planned values; these are bounded to 45–1100 Hz, so very high or low base pitches can limit the full interval. Fine variation is applied during synthesis. Punctuation changes pitch and timing, not the `volume` control.

An ellipsis inside a sentence preserves the sentence scope: an eventual `!` can still emphasize the beginning before that hesitation. Repeated dots and the Unicode ellipsis use the same pause. Mixed endings such as `?!` combine question and exclamation shaping; the period hold applies only to a standalone `.` ending.

Try `Hello there`, `Hello there.`, `Hello there?`, `Hello there!`, and `Hello… there` with the same seed. Set `variation: 0` to isolate punctuation contours.

### Determinism

The same text, normalized settings, seed, and engine version produce repeatable synthesis. Punctuation and whitespace do not reseed the underlying vowel performance; their timing and expression rules still change the result. Use a fixed commit or version when preserving generated assets, because synthesis can change between releases.

## Pure functions

Pure functions do not create an audio context and work in Node.js.

### `normalizeOptions(options = {}) → VoiceOptions`

Validates and fills a partial option object. Returns a fresh complete object. Null, arrays, invalid option values, and unsupported aliases throw `TypeError`.

```js
const options = normalizeOptions({ pitch: 220, mood: 0.4, voiceType: 0.65 });
```

### `planSpeech(text, options = {}) → SpeechPlan`

Plans timing and pitch without allocating PCM samples:

```ts
interface SpeechPlan {
  text: string;
  options: VoiceOptions;
  events: SpeechEvent[];
  duration: number; // Seconds.
}
```

It validates the text and the 60-second limit. Empty or whitespace-only input returns an empty event list and zero duration.

### `renderSpeech(text, options = {}) → RenderedSpeech`

Synchronously renders mono floating-point PCM:

```ts
interface RenderedSpeech extends SpeechPlan {
  samples: Float32Array;
  sampleRate: 24000;
}
```

The returned duration is `samples.length / sampleRate`, rounded to the allocated sample boundary. Samples have peak headroom and scale with `volume`. A line containing only silent characters may produce no samples; punctuation and spaces can produce a nonzero silent buffer.

### `encodeWav(rendered) → Uint8Array`

Encodes mono, signed 16-bit, little-endian PCM in a RIFF/WAV container. Accepts an object containing `{ samples: Float32Array, sampleRate: number }`; the other render fields are optional.

The sample rate must be an integer between 8,000 and 192,000 Hz. Samples must be finite; values outside −1–1 are clamped before conversion. Invalid input throws `TypeError`, and a buffer larger than 11,520,000 samples throws `RangeError`. Normal Mumble rendering always uses 24,000 Hz and stays within the library’s 60-second limit.

## Playback with Mumble

### `new Mumble(defaultOptions = {}, { context = null } = {})`

Creates an instance with validated defaults. `voice.options` exposes its normalized settings; use `setOptions()` to change them.

The instance creates its own `AudioContext` lazily when `speak()` needs it. To share your application’s context:

```js
const context = new AudioContext();
const voice = new Mumble(PRESETS.byte.options, { context });
```

Playback connects to that context’s destination. Mumble never closes an externally supplied context.

### `voice.setOptions(options = {}) → Mumble`

Merges and validates new defaults and returns the same instance. It affects future calls, not a line already playing. Per-call overrides do not modify the stored defaults.

### `await voice.speak(text, options = {}) → Playback`

Renders the line, resumes a suspended context, and starts playback. Invoke it directly from a user action such as a click or tap. Browsers may block unattended audio.

A new call replaces active playback on the same instance. The promise resolves once playback starts, not when it finishes:

```js
const first = await voice.speak('Welcome!');
await first.ended;
const second = await voice.speak('Would you like a map?');
await second.ended;
```

| Playback member | Meaning |
| --- | --- |
| `rendered` | The complete `RenderedSpeech` result. |
| `context` | The `AudioContext` used for this line. |
| `startTime` | Scheduled start in audio-context seconds. |
| `currentTime` | Getter for elapsed seconds, clamped to duration and frozen on completion or stop. |
| `stop()` | Stops this playback handle. Safe after completion. |
| `ended` | `Promise<void>` that resolves on natural completion or stop. |

`ended` does not distinguish completion from cancellation. Track that distinction in your app when it matters.

### `voice.stop() → void`

Stops current playback and cancels a pending start. The instance remains available for another line.

If a pending `speak()` is superseded while the context is resuming, it rejects with an error whose `name` is `'AbortError'`. The same applies when `stop()` or `dispose()` cancels that pending start. Treat this as expected cancellation:

```js
try {
  const playback = await voice.speak('Hello?');
  await playback.ended;
} catch (error) {
  if (error.name !== 'AbortError') throw error;
}
```

Other failures include unsupported Web Audio, a closed context, or a context that cannot enter the running state. Report those errors and let the user retry with a click.

### `voice.render(text, options = {}) → RenderedSpeech`

Equivalent to `renderSpeech()` with the instance’s defaults merged with the supplied overrides. It does not play or stop audio.

### `voice.toWav(text, options = {}) → Uint8Array`

Renders with the instance’s defaults and returns WAV bytes. It does not need an audio device.

### `await voice.dispose() → void`

Stops playback and closes a context only if the instance owns it. It is safe to call more than once. A disposed instance cannot start new playback; create another instance when needed. Pure rendering functions remain available independently.

## Timeline and subtitles

All times are in seconds. String indices are **UTF-16 offsets**, compatible with JavaScript `slice()`. The 500-character input limit, however, counts Unicode code points.

```ts
interface SpeechEvent {
  char: string;
  index: number;
  start: number;
  duration: number;
  phoneme: string;
  wordIndex: number;
  kind: 'vowel' | 'silent' | 'pause';
  vowel: number;
  pitch: number;
  pitchStart: number;
  pitchEnd: number;
}
```

| Field | Detail |
| --- | --- |
| `char`, `index` | Original text character and its UTF-16 offset. |
| `start`, `duration` | Planned event position and length. Silent letters have zero duration. |
| `phoneme` | `ah`, `eh`, `ee`, `oh`, `oo`, `silent`, or `pause`. |
| `wordIndex` | Zero-based word grouping used by the planner. Leading separators use 0. |
| `kind` | Distinguishes audible vowels, silent letters/symbols, and pauses. |
| `vowel` | `0–4` for A/E/I/O/U; `-1` otherwise. |
| `pitchStart`, `pitchEnd` | Planned fundamental frequency at vowel boundaries, before fine vibrato. Zero for non-vowels. |
| `pitch` | Geometric midpoint of the boundary frequencies. Zero for non-vowels. |

Multiple events can share a start time. Reveal **all** due events so silent consonants and punctuation remain visible. Only open the character’s mouth during an event with `kind === 'vowel'` while its duration is active.

Given an existing `voice` and a DOM element named `subtitle`:

```js
let frame;
let generation = 0;

async function showLine(text) {
  const current = ++generation;
  cancelAnimationFrame(frame);
  voice.stop();
  subtitle.textContent = '';

  try {
    const playback = await voice.speak(text);
    if (current !== generation) {
      playback.stop();
      return;
    }
    let next = 0;

    function update() {
      if (current !== generation) return;
      const events = playback.rendered.events;
      while (next < events.length &&
             events[next].start <= playback.currentTime) {
        const event = events[next++];
        subtitle.textContent = text.slice(0, event.index + event.char.length);
      }
      frame = requestAnimationFrame(update);
    }

    update();
    await playback.ended;
    if (current !== generation) return;
    cancelAnimationFrame(frame);
    subtitle.textContent = text;
  } catch (error) {
    if (error.name !== 'AbortError') throw error;
  }
}

function stopLine() {
  generation++;
  cancelAnimationFrame(frame);
  voice.stop();
}
```

Call `showLine()` from a user gesture. Use the audio clock instead of character-count timers, because vowel holds, silent characters, speed, and punctuation change the timing.

## WAV examples

### Generate an asset in Node.js

Save as an `.mjs` file at the repository root:

```js
import { writeFile } from 'node:fs/promises';
import { renderSpeech, encodeWav, PRESETS } from './lib/mumble.js';

const result = renderSpeech('Do you come in peace?', {
  ...PRESETS.orbit.options,
  mood: 0.3,
  voiceType: 0.75,
  seed: 77,
});

await writeFile('orbit.wav', encodeWav(result));
console.log(`${result.duration.toFixed(2)} seconds`);
```

### Download in the browser

```js
const bytes = voice.toWav('A new adventure awaits!');
const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
const link = document.createElement('a');
link.href = url;
link.download = 'character-line.wav';
document.body.append(link);
link.click();
link.remove();
setTimeout(() => URL.revokeObjectURL(url), 1000);
```

WAV export does not require microphone permission or browser audio playback.

## Validation and limits

- Text must be a string with at most **500 Unicode code points**. Invalid text types throw `TypeError`; excessive length throws `RangeError`.
- A planned line longer than **60 seconds** throws `RangeError`. Split the dialogue or increase its speed.
- Empty or whitespace-only text returns empty audio. A consonant-only line is silent.
- Rendering is synchronous. For large batches, pre-render in Node or move the pure functions into a Web Worker.
- The library produces stylized vowels, not intelligible speech, multilingual pronunciation, or voice cloning.
- Serve browser modules over HTTP. The repository’s playground and example require no compilation or dependency installation.

## Testing

From the repository root, with Node.js 20 or later:

```sh
npm test
```

The suite covers waveform validity, reproducible seeds, vowel-only output, punctuation behavior, continuous controls, WAV structure, validation, and playback lifecycle rules. No browser or network is needed for the unit tests.
