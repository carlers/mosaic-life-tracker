import type { CompletionSoundStyle } from './completionFeedback';

let audio: AudioContext | null = null;
let lastSoundAt = 0;

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
  const time = performance.now();
  if (time - lastSoundAt < 120) return;
  lastSoundAt = time;
  const notes: Record<CompletionSoundStyle, readonly [number, number, number][]> = {
    pop: [[480, 0, 0.09]],
    click: [[240, 0, 0.035]],
    chime: [[880, 0, 0.14], [1175, 0.09, 0.17]],
    sparkle: [[784, 0, 0.08], [1047, 0.075, 0.08], [1568, 0.15, 0.13]],
  };
  try {
    for (const [frequency, offset, duration] of notes[style]) {
      const start = ctx.currentTime + offset;
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = style === 'click' || style === 'pop' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, Math.min(1, volume) * 0.12), start + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(envelope);
      envelope.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.005);
      oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
    }
  } catch { /* A denied or removed audio output is non-fatal. */ }
}

export async function previewCompletionSound(style: CompletionSoundStyle, volume: number): Promise<void> {
  prepareCompletionSound();
  if (audio?.state === 'suspended') {
    try { await audio.resume(); } catch { return; }
  }
  // A settings preview is a user action and does not publish a completion event.
  playCompletionSound(style, volume);
}

export function closeCompletionSound(): void {
  const previous = audio;
  audio = null;
  lastSoundAt = 0;
  if (previous) void previous.close().catch(() => {});
}
