import { describe, expect, it, vi } from 'vitest';
import {
  COMPLETION_ANIMATION_OPTIONS,
  COMPLETION_FEEDBACK_SETTING_KEY,
  COMPLETION_SOUND_OPTIONS,
  DEFAULT_COMPLETION_FEEDBACK,
  isCompletedDayAfterTaskChange,
  isCompletionAnimation,
  isCompletionSoundStyle,
  isScheduledCompletionDay,
  publishCompletionFeedback,
  resolveCompletionFeedbackSettings,
  subscribeCompletionFeedback,
} from '../../src/lib/completionFeedback';

describe('completion feedback preferences and user-event contract', () => {
  it('defaults to silent subtle feedback and clamps malformed account-synced values', () => {
    expect(COMPLETION_FEEDBACK_SETTING_KEY).toBe('taskCompletionFeedback');
    expect(resolveCompletionFeedbackSettings(undefined)).toEqual(DEFAULT_COMPLETION_FEEDBACK);
    expect(resolveCompletionFeedbackSettings('corrupt')).toEqual(DEFAULT_COMPLETION_FEEDBACK);
    expect(resolveCompletionFeedbackSettings({
      animation: 'celebrate', soundEnabled: true, soundStyle: 'bubble', volume: 9, dayConfettiEnabled: true,
    })).toEqual({
      animation: 'celebrate', soundEnabled: true, soundStyle: 'bubble', volume: 1, dayConfettiEnabled: true,
    });
    expect(resolveCompletionFeedbackSettings({
      animation: 'unknown', soundEnabled: 'true', soundStyle: 'unknown',
      volume: Number.NaN, dayConfettiEnabled: 'true',
    })).toEqual(DEFAULT_COMPLETION_FEEDBACK);
    expect(resolveCompletionFeedbackSettings({ animation: 'off', volume: -5 }).volume).toBe(0);
    // Old v0.86.0 preferences migrate without resetting the user's saved volume.
    expect(resolveCompletionFeedbackSettings({ volume: .2, soundStyle: 'click' })).toMatchObject({
      volume: .2, soundStyle: 'click', dayConfettiEnabled: false,
    });
  });

  it('preserves existing animation choices and accepts the restored Rejoice mode', () => {
    expect(COMPLETION_ANIMATION_OPTIONS.map(option => option.value)).toEqual([
      'off', 'subtle', 'rejoice', 'celebrate',
    ]);
    for (const option of COMPLETION_ANIMATION_OPTIONS) {
      expect(isCompletionAnimation(option.value)).toBe(true);
      expect(resolveCompletionFeedbackSettings({ animation: option.value }).animation).toBe(option.value);
    }
    expect(resolveCompletionFeedbackSettings({ animation: 'celebrate' }).animation).toBe('celebrate');
    expect(resolveCompletionFeedbackSettings({ animation: 'rejoice' }).animation).toBe('rejoice');
    expect(isCompletionAnimation('confetti')).toBe(false);
    expect(resolveCompletionFeedbackSettings({ animation: 'confetti' }).animation).toBe('subtle');
  });

  it('exposes eight unique, valid presets without losing existing choices', () => {
    expect(COMPLETION_SOUND_OPTIONS.map(option => option.value)).toEqual([
      'pop', 'chime', 'click', 'sparkle', 'ding', 'bubble', 'arcade', 'tada',
    ]);
    expect(new Set(COMPLETION_SOUND_OPTIONS.map(option => option.value)).size).toBe(8);
    for (const option of COMPLETION_SOUND_OPTIONS) {
      expect(isCompletionSoundStyle(option.value)).toBe(true);
      expect(resolveCompletionFeedbackSettings({ soundStyle: option.value }).soundStyle).toBe(option.value);
    }
    expect(isCompletionSoundStyle('other')).toBe(false);
  });

  it('checks only real scheduled owner tasks, excluding backlog and other dates', () => {
    expect(isScheduledCompletionDay('2026-11-04')).toBe(true);
    expect(isScheduledCompletionDay('')).toBe(false);
    expect(isScheduledCompletionDay('2026-02-30')).toBe(false);
    const own = { userId: 'owner', date: '2026-11-04', isDeleted: false };
    const tasks = [
      { ...own, id: 'last', completed: true },
      { ...own, id: 'earlier', completed: true },
      { ...own, id: 'pending', completed: false, isDeleted: true },
      { ...own, id: 'foreign', completed: false, userId: 'another' },
      { ...own, id: 'tomorrow', completed: false, date: '2026-11-05' },
    ];
    expect(isCompletedDayAfterTaskChange(tasks, 'owner', '2026-11-04', 'last')).toBe(true);
    expect(isCompletedDayAfterTaskChange([...tasks, { ...own, id: 'incomplete', completed: false }],
      'owner', '2026-11-04', 'last')).toBe(false);
    expect(isCompletedDayAfterTaskChange(tasks, 'owner', '', 'last')).toBe(false);
    expect(isCompletedDayAfterTaskChange(tasks, 'another', '2026-11-04', 'last')).toBe(false);
    expect(isCompletedDayAfterTaskChange(tasks, 'owner', '2026-11-04', 'not-found')).toBe(false);
    expect(isCompletedDayAfterTaskChange([], 'owner', '2026-11-04', 'last')).toBe(false);
  });

  it('delivers only explicit nonempty ephemeral events and isolates subscribers', () => {
    const first = vi.fn(() => { throw Error('broken optional effect'); });
    const second = vi.fn();
    const unsubscribeFirst = subscribeCompletionFeedback(first);
    const unsubscribeSecond = subscribeCompletionFeedback(second);
    publishCompletionFeedback('prepare', 'owner', 'task');
    publishCompletionFeedback('complete', 'owner', 'task');
    publishCompletionFeedback('day-complete', 'owner', 'task', '2026-11-04');
    publishCompletionFeedback('complete', '', 'task');
    expect(second).toHaveBeenCalledTimes(3);
    expect(second).toHaveBeenNthCalledWith(3, {
      phase: 'day-complete', userId: 'owner', taskId: 'task', day: '2026-11-04',
    });
    unsubscribeFirst();
    unsubscribeSecond();
    publishCompletionFeedback('complete', 'owner', 'task');
    expect(second).toHaveBeenCalledTimes(3);
  });
});
