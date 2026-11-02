import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ enabled: true }));
vi.mock('../../src/lib/featureControls', () => ({ isFeatureEnabled: () => state.enabled }));
import { useChatReactions } from '../../src/components/messages/useChatReactions';
describe('new chat reaction initiation', () => {
  beforeEach(() => { state.enabled = true; });
  it('rejects stale action while paused, and restores outgoing reaction without affecting history', async () => {
    const toggleReaction = vi.fn().mockResolvedValue('ok');
    const setFeedback = vi.fn();
    const { result } = renderHook(() => useChatReactions({ toggleReaction, setFeedback }));
    state.enabled = false;
    act(() => result.current.reactToMessage('msg', '👍'));
    expect(toggleReaction).not.toHaveBeenCalled();
    state.enabled = true;
    act(() => result.current.reactToMessage('msg', '👍'));
    expect(toggleReaction).toHaveBeenCalledExactlyOnceWith('msg', '👍');
  });
});
