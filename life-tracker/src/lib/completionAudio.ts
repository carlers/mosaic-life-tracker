import type { CompletionSoundStyle } from './completionFeedback';

let audio: AudioContext | null = null;
let lastSoundAt = 0;

export interface CompletionSoundVoice {
  frequency: number;
  offset: number;
  duration: number;
  waveform: OscillatorType;
  strength: number;
  endFrequency?: number;
}

/** All sounds are original, locally synthesized and require no downloaded assets.
 * The click is a clearly pitched two-layer transient instead of an inaudible
 * 35 ms low-frequency tap. Intensities are normalized across layered presets. */
export const COMPLETION_SOUND_VOICES: Readonly<Record<CompletionSoundStyle, readonly CompletionSoundVoice[]>> = {
  pop: [
    { frequency: 640, endFrequency: 360, offset: 0, duration: .13, waveform: 'triangle', strength: 1 },
    { frequency: 1040, endFrequency: 620, offset: .012, duration: .09, waveform: 'sine', strength: .43 },
  ],
  click: [
    { frequency: 1050, endFrequency: 820, offset: 0, duration: .11, waveform: 'square', strength: 1 },
    { frequency: 1650, offset: .008, duration: .085, waveform: 'triangle', strength: .65 },
  ],
  chime: [
    { frequency: 784, offset: 0, duration: .24, waveform: 'sine', strength: 1 },
    { frequency: 1175, offset: .085, duration: .29, waveform: 'sine', strength: .9 },
  ],
  sparkle: [
    { frequency: 880, offset: 0, duration: .11, waveform: 'sine', strength: .8 },
    { frequency: 1175, offset: .08, duration: .12, waveform: 'sine', strength: .8 },
    { frequency: 1568, offset: .16, duration: .22, waveform: 'sine', strength: 1 },
  ],
  ding: [
    { frequency: 988, offset: 0, duration: .37, waveform: 'sine', strength: 1 },
    { frequency: 1976, offset: 0, duration: .21, waveform: 'sine', strength: .33 },
  ],
  bubble: [
    { frequency: 460, endFrequency: 830, offset: 0, duration: .16, waveform: 'sine', strength: 1 },
    { frequency: 690, endFrequency: 1060, offset: .11, duration: .17, waveform: 'sine', strength: .75 },
  ],
  arcade: [
    { frequency: 659, offset: 0, duration: .11, waveform: 'square', strength: .7 },
    { frequency: 988, offset: .115, duration: .11, waveform: 'square', strength: .7 },
    { frequency: 1319, offset: .23, duration: .18, waveform: 'triangle', strength: 1 },
  ],
  tada: [
    { frequency: 523, offset: 0, duration: .18, waveform: 'triangle', strength: .75 },
    { frequency: 659, offset: .095, duration: .18, waveform: 'triangle', strength: .8 },
    { frequency: 784, offset: .19, duration: .22, waveform: 'triangle', strength: .85 },
    { frequency: 1047, offset: .3, duration: .32, waveform: 'sine', strength: 1 },
  ],
};

export function completionSoundPeak(volume: number, strength: number, voices: number): number {
  if (!Number.isFinite(volume) || volume <= 0) return 0;
  // ~6× the old peak at full volume, with normalized layered amplitude.
  return Math.min(1, volume) * 0.74 * strength / Math.sqrt(Math.max(1, voices));
}

/** Must be invoked synchronously from the original user activation. */
export function prepareCompletionSound(): void {
  if (typeof window === 'undefined' || document.visibilityState !== 'visible') return;
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) return;
  try {
    audio ??= new AudioContextConstructor();
    if (audio.state === 'suspended') void audio.resume().catch(() => {});
  } catch { /* Browsers without audio output silently skip optional feedback. */ }
}

export function playCompletionSound(style: CompletionSoundStyle, volume: number): void {
  const ctx = audio;
  if (!ctx || ctx.state !== 'running' || document.visibilityState !== 'visible' ||
      !Number.isFinite(volume) || volume <= 0) return;
  const now = performance.now();
  if (now - lastSoundAt < 135) return;
  lastSoundAt = now;
  const notes = COMPLETION_SOUND_VOICES[style];
  try {
    for (const note of notes) {
      const start = ctx.currentTime + note.offset;
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      const peak = Math.max(.0001, completionSoundPeak(volume, note.strength, notes.length));
      oscillator.type = note.waveform;
      oscillator.frequency.setValueAtTime(note.frequency, start);
      if (note.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(note.endFrequency, start + note.duration);
      envelope.gain.setValueAtTime(.0001, start);
      envelope.gain.exponentialRampToValueAtTime(peak, start + .006);
      envelope.gain.exponentialRampToValueAtTime(.0001, start + note.duration);
      oscillator.connect(envelope);
      envelope.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + note.duration + .006);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    }
  } catch { /* Audio permission/output changes cannot interrupt task completion. */ }
}

export async function previewCompletionSound(style: CompletionSoundStyle, volume: number): Promise<void> {
  prepareCompletionSound();
  if (audio?.state === 'suspended') {
    try { await audio.resume(); } catch { return; }
  }
  playCompletionSound(style, volume);
}

export function closeCompletionSound(): void {
  const previous = audio;
  audio = null;
  lastSoundAt = 0;
  if (previous) void previous.close().catch(() => {});
}
