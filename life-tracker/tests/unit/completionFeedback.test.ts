import { describe, expect, it, vi } from 'vitest';
import {
  COMPLETION_FEEDBACK_SETTING_KEY,
  DEFAULT_COMPLETION_FEEDBACK,
  publishCompletionFeedback,
  resolveCompletionFeedbackSettings,
  subscribeCompletionFeedback,
} from '../../src/lib/completionFeedback';

describe('completion feedback preferences and user-event contract', () => {
  it('defaults to silent subtle feedback and clamps malformed synced values', () => {
    expect(COMPLETION_FEEDBACK_SETTING_KEY).toBe('taskCompletionFeedback');
    expect(resolveCompletionFeedbackSettings(undefined)).toEqual(DEFAULT_COMPLETION_FEEDBACK);
    expect(resolveCompletionFeedbackSettings('corrupt')).toEqual(DEFAULT_COMPLETION_FEEDBACK);
    expect(resolveCompletionFeedbackSettings({
      animation: 'celebrate', soundEnabled: true, soundStyle: 'chime', volume: 9,
    })).toEqual({ animation: 'celebrate', soundEnabled: true, soundStyle: 'chime', volume: 1 });
    expect(resolveCompletionFeedbackSettings({
      animation: 'unknown', soundEnabled: 'true', soundStyle: 'unknown', volume: Number.NaN,
    })).toEqual(DEFAULT_COMPLETION_FEEDBACK);
    expect(resolveCompletionFeedbackSettings({ animation: 'off', volume: -5 }).volume).toBe(0);
  });

  it('delivers only explicit nonempty ephemeral events and safely isolates subscribers', () => {
    const first = vi.fn(() => { throw Error('broken optional effect'); });
    const second = vi.fn();
    const unsubscribeFirst = subscribeCompletionFeedback(first);
    const unsubscribeSecond = subscribeCompletionFeedback(second);
    publishCompletionFeedback('prepare', 'owner', 'task');
    publishCompletionFeedback('complete', 'owner', 'task');
    publishCompletionFeedback('complete', '', 'task');
    expect(second).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenNthCalledWith(2, { phase: 'complete', userId: 'owner', taskId: 'task' });
    unsubscribeFirst();
    unsubscribeSecond();
    publishCompletionFeedback('complete', 'owner', 'task');
    expect(second).toHaveBeenCalledTimes(2);
  });
});
