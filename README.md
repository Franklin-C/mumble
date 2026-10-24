# Mumble

A dependency-free JavaScript library for procedural NPC voices, with a browser playground for designing and exporting them.

**[Try the playground](https://franklin-c.github.io/mumble/) · [API reference](API.md) · [Minimal example](examples/minimal.html)**

Mumble turns the vowels in dialogue into expressive game chatter. It runs locally, uses no recordings or models, and exports ordinary WAV files. It produces stylized sounds rather than intelligible text-to-speech.

## What it does

- Eight editable character presets, from soft forest voices to robots.
- Continuous **voice type** and **mood** controls, plus pitch, pace, texture, and volume.
- Audible **A / E / I / O / U**, including accent folding; silent consonants remain in the dialogue timeline.
- Strong punctuation cues: held sentence endings, rising questions, emphatic openings, and hesitation pauses.
- Repeatable seeded synthesis, synchronized text events, and mono WAV export.
- Web Audio playback in browsers and pure JavaScript rendering in Node.js.

## Use the library

Copy [`lib/mumble.js`](lib/mumble.js) and [`lib/mumble.d.ts`](lib/mumble.d.ts) into your project. This example works from the repository root:

```html
<button id="talk">Talk</button>
<script type="module">
  import { Mumble, PRESETS } from './lib/mumble.js';

  const voice = new Mumble({
    ...PRESETS.sprout.options,
    mood: 0.25,
    voiceType: 0.5,
    seed: 42,
  });

  document.querySelector('#talk').addEventListener('click', async () => {
    try {
      const playback = await voice.speak('Welcome, traveler!');
      await playback.ended;
    } catch (error) {
      if (error.name !== 'AbortError') console.error(error);
    }
  });
</script>
```

Start playback from a click or tap so the browser can enable audio. A new `speak()` call replaces the previous line on that instance. See the [API reference](API.md) for sequencing, stopping, subtitle timing, and exporting audio.

For an existing npm project, install directly from GitHub:

```sh
npm install github:Franklin-C/mumble
```

```js
import { Mumble, PRESETS } from '@franklin-ai/mumble';
```

The package is not published to the npm registry. Pin a Git commit in your dependency when you need a fixed version.

## Run locally

```sh
git clone https://github.com/Franklin-C/mumble.git
cd mumble
python3 -m http.server 8000
```

Open **http://localhost:8000/** for the playground or **http://localhost:8000/examples/minimal.html** for the small integration example. On Windows, `py -m http.server 8000` also works with the Python launcher.

No dependency install or build step is required. Serve the files over HTTP; opening the HTML with `file://` can block module imports.

## Test

With Node.js 20 or later:

```sh
npm test
```

The suite checks vowel-only output, punctuation contours and timing, deterministic rendering, continuous voice controls, valid audio/WAV data, input validation, and playback lifecycle behavior.

## Project layout

| Path | Purpose |
| --- | --- |
| `lib/mumble.js` | Standalone ES module. |
| `lib/mumble.d.ts` | TypeScript API declarations. |
| `index.html`, `app.js`, `styles.css` | Buildless playground. |
| `examples/minimal.html` | Small integration example. |
| `API.md` | Full API and synthesis rules. |
| `tests/core.test.mjs` | Node tests. |
| `.nojekyll` | Serve the repository as plain static files on GitHub Pages. |

GitHub Pages serves the `main` branch from **`/ (root)`**. No custom Actions workflow or application build is required. Documentation lives in Markdown alongside the source.

