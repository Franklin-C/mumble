/** Mumble 0.3.0. Vowel-only procedural speech, not intelligible TTS. */
export const VERSION: '0.3.0';
export const SAMPLE_RATE: 24000;
export const MAX_CHARACTERS: 500;
export const MAX_DURATION: 60;
export type Emotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'curious';
export type VoiceStyle = 'mumble' | 'beep' | 'robot';
export interface VoiceOptions {
  /** Fundamental pitch, clamped to 60–700 Hz. Default 270. */
  pitch: number;
  /** Timing multiplier, clamped to 0.35–2.5. Default 1. */
  speed: number;
  /** Pitch/timing variation, 0–1. Default 0.42. */
  variation: number;
  /** Vocal formant brightness, 0–1. Default 0.55. */
  brightness: number;
  /** Air/noise texture, 0–1. Default 0.12. */
  breathiness: number;
  /** Subharmonic/gravel texture, 0–1. Default 0.06. */
  roughness: number;
  /** Output level, 0–1. Default 0.7. */
  volume: number;
  /** Continuous expression: −1 subdued, 0 neutral, +1 animated. Default 0. */
  mood: number;
  /** Finite integer converted to unsigned 32-bit. Default 42. */
  seed: number;
  /** Continuous crossfade: 0 blip, 0.5 mumble, 1 robot. Default 0.5. */
  voiceType: number;
}
export interface LegacyVoiceOptions {
  /** @deprecated Input alias for mood: sad −1, neutral 0, curious .35, angry .65, happy 1. */
  emotion?: Emotion;
  /** @deprecated Input alias for voiceType: beep 0, mumble .5, robot 1. */
  style?: VoiceStyle;
}
/** Explicit numeric mood/voiceType take precedence over their legacy aliases. */
export type VoiceInput = Partial<VoiceOptions> & LegacyVoiceOptions;
export interface VoicePreset { readonly name: string; readonly description: string; readonly options: Readonly<VoiceOptions>; }
export type PresetName = 'sprout' | 'pip' | 'byte' | 'grumble' | 'wisp' | 'orbit' | 'ember' | 'sage';
export const PRESETS: Readonly<Record<PresetName, VoicePreset>>;
export interface SpeechEvent {
  char: string;
  /** UTF-16 string offset, suitable for text.slice(0, index + char.length). */
  index: number;
  start: number;
  duration: number;
  /** ah/eh/ee/oh/oo for A/E/I/O/U; pause or silent for everything else. */
  phoneme: string;
  wordIndex: number;
  /** Silent letters have zero duration but preserve text/UTF-16 positions. */
  kind: 'vowel' | 'silent' | 'pause';
  /** Vowel table index 0–4; −1 for non-vowels. */
  vowel: number;
  /** Geometric midpoint of the planned pitch ramp in Hz; zero for non-vowels. */
  pitch: number;
  /** Vowel-start fundamental in Hz, before fine vibrato; zero for non-vowels. */
  pitchStart: number;
  /** Vowel-end fundamental in Hz, before fine vibrato; zero for non-vowels. */
  pitchEnd: number;
}
export interface SpeechPlan { text: string; options: VoiceOptions; events: SpeechEvent[]; duration: number; }
export interface RenderedSpeech extends SpeechPlan { samples: Float32Array; sampleRate: typeof SAMPLE_RATE; }
export interface Playback {
  rendered: RenderedSpeech;
  context: AudioContext;
  /** AudioContext clock at which playback begins. */
  startTime: number;
  /** Elapsed seconds, clamped to duration and frozen when stopped. */
  readonly currentTime: number;
  /** Resolves on natural completion or stop. */
  ended: Promise<void>;
  stop(): void;
}
/** Numeric options are clamped; invalid types and unknown emotion/style values throw. */
export function normalizeOptions(options?: VoiceInput): VoiceOptions;
/**
 * At most 500 Unicode codepoints and 60 seconds. Indices are UTF-16 offsets.
 * Periods hold/fall at the end; questions hold/rise at the end; exclamations
 * hold/launch at the beginning. Ellipses add a pause within the sentence.
 */
export function planSpeech(text: string, options?: VoiceInput): SpeechPlan;
export function renderSpeech(text: string, options?: VoiceInput): RenderedSpeech;
/** Mono 16-bit PCM WAV; works without Web Audio. */
export function encodeWav(rendered: { samples: Float32Array; sampleRate: number }): Uint8Array;
export class Mumble {
  options: VoiceOptions;
  /** Externally supplied contexts are never closed by dispose(). */
  constructor(defaultOptions?: VoiceInput, environment?: { context?: AudioContext | null });
  setOptions(options?: VoiceInput): this;
  render(text: string, options?: VoiceInput): RenderedSpeech;
  toWav(text: string, options?: VoiceInput): Uint8Array;
  /** Invoke in a user gesture. Superseded pending requests reject with AbortError. */
  speak(text: string, options?: VoiceInput): Promise<Playback>;
  stop(): void;
  /** Stops audio, then closes only an internally owned AudioContext. */
  dispose(): Promise<void>;
}
export default Mumble;
