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
  anchor.getBoundingClientRect = () => ({
    left: 10, top: 20, width: 20, height: 20, right: 30, bottom: 40, x: 10, y: 20,
    toJSON: () => ({}),
  });
  document.body.appendChild(anchor);
  return anchor;
}

beforeEach(() => {
  state.userId = 'owner';
  state.settings = { animation: 'celebrate', soundEnabled: false, volume: .3, soundStyle: 'pop' };
  state.reducedMotion = false;
});
afterEach(() => { cleanup(); document.querySelectorAll('[data-task-completion-id]').forEach(n => n.remove()); });

describe('user-scoped completion celebration overlay', () => {
  it('renders one temporary pointer-transparent overlay following a prepared local action', () => {
    const anchor = attachAnchor();
    const { unmount } = mountFeedback();
    act(() => {
      publishCompletionFeedback('prepare', 'owner', 'task');
      publishCompletionFeedback('complete', 'owner', 'task');
    });
    expect(document.querySelectorAll('.mosaic-completion-feedback-burst')).toHaveLength(1);
    expect(document.querySelectorAll('.mosaic-completion-feedback-particle')).toHaveLength(8);
    unmount();
    anchor.remove();
    expect(document.querySelector('.mosaic-completion-feedback-burst')).toBeNull();
  });

  it('rejects unprepared, foreign-account and reduced-motion celebrations', () => {
    attachAnchor();
    const { rerender } = mountFeedback();
    act(() => publishCompletionFeedback('complete', 'owner', 'task'));
    expect(document.querySelector('.mosaic-completion-feedback-burst')).toBeNull();
    act(() => {
      publishCompletionFeedback('prepare', 'other', 'task');
      publishCompletionFeedback('complete', 'other', 'task');
    });
    expect(document.querySelector('.mosaic-completion-feedback-burst')).toBeNull();
    state.reducedMotion = true;
    rerender(<MemoryRouter><CompletionFeedbackLayer /></MemoryRouter>);
    act(() => {
      publishCompletionFeedback('prepare', 'owner', 'task');
      publishCompletionFeedback('complete', 'owner', 'task');
    });
    expect(document.querySelector('.mosaic-completion-feedback-burst')).toBeNull();
  });
});
