import { describe, expect, it } from 'vitest';
import { COMPLETION_SOUND_OPTIONS } from '../../src/lib/completionFeedback';
import { COMPLETION_SOUND_VOICES, completionSoundPeak } from '../../src/lib/completionAudio';

describe('locally synthesized task-completion sounds', () => {
  it('supplies a bounded, audible sound design for every selectable preset', () => {
    for (const { value: style } of COMPLETION_SOUND_OPTIONS) {
      const voices = COMPLETION_SOUND_VOICES[style];
      expect(voices.length).toBeGreaterThan(0);
      for (const note of voices) {
        expect(note.frequency).toBeGreaterThan(0);
        expect(note.duration).toBeGreaterThanOrEqual(.07);
        expect(note.offset).toBeGreaterThanOrEqual(0);
        expect(note.offset + note.duration).toBeLessThan(.8);
        expect(note.strength).toBeGreaterThan(0);
        expect(note.strength).toBeLessThanOrEqual(1);
        expect(completionSoundPeak(1, note.strength, voices.length)).toBeLessThanOrEqual(.74);
      }
    }
  });

  it('makes the previously inaudible Click longer, higher pitched and louder', () => {
    const click = COMPLETION_SOUND_VOICES.click;
    expect(click.length).toBeGreaterThanOrEqual(2);
    expect(click.every(note => note.frequency >= 800)).toBe(true);
    expect(click.every(note => note.duration >= .08)).toBe(true);
    expect(completionSoundPeak(1, click[0].strength, click.length)).toBeGreaterThan(.3);
    expect(completionSoundPeak(0, 1, 2)).toBe(0);
    expect(completionSoundPeak(Number.NaN, 1, 2)).toBe(0);
  });
});
