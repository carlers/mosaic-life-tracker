import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CompletionFeedbackLayer } from '../../src/components/layout/CompletionFeedbackLayer';
import { publishCompletionFeedback } from '../../src/lib/completionFeedback';

const state = vi.hoisted(() => ({
  userId: 'owner',
  settings: undefined as unknown,
  reducedMotion: false,
}));
vi.mock('../../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: state.userId ? { $id: state.userId } : null }),
}));
vi.mock('../../src/hooks/useSettings', () => ({
  useSettings: () => ({ getSetting: () => state.settings }),
}));
vi.mock('../../src/hooks/useAppearance', () => ({
  useAppearance: () => ({ effectiveReducedMotion: state.reducedMotion }),
}));
vi.mock('../../src/lib/completionAudio', () => ({
  prepareCompletionSound: vi.fn(),
  playCompletionSound: vi.fn(),
  closeCompletionSound: vi.fn(),
}));

function mountFeedback() {
  return render(<MemoryRouter><CompletionFeedbackLayer /></MemoryRouter>);
}
function attachAnchor(taskId = 'task') {
  const anchor = document.createElement('button');
  anchor.dataset.taskCompletionId = taskId;
  anchor.dataset.taskCompletionColor = '#ff8800';
  anchor.getBoundingClientRect = () => ({
    left: 10, top: 20, width: 20, height: 20, right: 30, bottom: 40, x: 10, y: 20,
    toJSON: () => ({}),
  });
  document.body.appendChild(anchor);
  return anchor;
}

beforeEach(() => {
  state.userId = 'owner';
  state.settings = { animation: 'celebrate', soundEnabled: false, volume: .6,
    soundStyle: 'pop', dayConfettiEnabled: false };
  state.reducedMotion = false;
});
afterEach(() => {
  cleanup();
  document.querySelectorAll('[data-task-completion-id]').forEach(n => n.remove());
});

describe('user-scoped completion celebration overlay', () => {
  it('renders a richer checkbox burst that survives the completed row unmounting', () => {
    const anchor = attachAnchor();
    const { unmount } = mountFeedback();
    act(() => {
      publishCompletionFeedback('prepare', 'owner', 'task');
      anchor.remove();
      publishCompletionFeedback('complete', 'owner', 'task');
    });
    expect(document.querySelector('[data-celebration="celebrate"]')).not.toBeNull();
    expect(document.querySelectorAll('.mosaic-completion-feedback-particle').length).toBeGreaterThan(8);
    unmount();
    expect(document.querySelector('[data-celebration="celebrate"]')).toBeNull();
  });

  it('plays full-day confetti only for a matching foreground completion, once per day', () => {
    attachAnchor();
    state.settings = { ...state.settings as object, animation: 'off', dayConfettiEnabled: true };
    mountFeedback();
    act(() => publishCompletionFeedback('day-complete', 'owner', 'task', '2026-11-04'));
    expect(document.querySelector('[data-completed-day]')).toBeNull();
    act(() => {
      publishCompletionFeedback('prepare', 'owner', 'task');
      publishCompletionFeedback('complete', 'owner', 'task');
      publishCompletionFeedback('day-complete', 'owner', 'task', '2026-11-04');
    });
    expect(document.querySelector('[data-celebration]')).toBeNull();
    expect(document.querySelector('[data-completed-day="2026-11-04"]')).not.toBeNull();
    expect(document.querySelectorAll('.mosaic-completion-day-piece').length).toBeGreaterThan(24);
    act(() => {
      publishCompletionFeedback('prepare', 'owner', 'task');
      publishCompletionFeedback('complete', 'owner', 'task');
      publishCompletionFeedback('day-complete', 'owner', 'task', '2026-11-04');
    });
    expect(document.querySelectorAll('[data-completed-day="2026-11-04"]')).toHaveLength(1);
  });

  it('rejects unprepared, foreign-account, disabled and reduced-motion celebrations', () => {
    attachAnchor();
    const { rerender } = mountFeedback();
    act(() => publishCompletionFeedback('complete', 'owner', 'task'));
    expect(document.querySelector('[data-celebration]')).toBeNull();
    act(() => {
      publishCompletionFeedback('prepare', 'other', 'task');
      publishCompletionFeedback('complete', 'other', 'task');
      publishCompletionFeedback('day-complete', 'other', 'task', '2026-11-04');
    });
    expect(document.querySelector('[data-celebration]')).toBeNull();
    expect(document.querySelector('[data-completed-day]')).toBeNull();
    state.reducedMotion = true;
    state.settings = { ...state.settings as object, dayConfettiEnabled: true };
    rerender(<MemoryRouter><CompletionFeedbackLayer /></MemoryRouter>);
    act(() => {
      publishCompletionFeedback('prepare', 'owner', 'task');
      publishCompletionFeedback('complete', 'owner', 'task');
      publishCompletionFeedback('day-complete', 'owner', 'task', '2026-11-04');
    });
    expect(document.querySelector('[data-celebration]')).toBeNull();
    expect(document.querySelector('[data-completed-day]')).toBeNull();
  });
});
