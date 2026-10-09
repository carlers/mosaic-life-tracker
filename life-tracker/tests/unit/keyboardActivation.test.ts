import { describe, expect, it, vi } from 'vitest';
import { activateOnEnterOrSpace } from '../../src/lib/keyboardActivation';

describe('custom interactive-row keyboard activation', () => {
  it.each(['Enter', ' '])('activates exactly once for %j and suppresses native default', (key) => {
    const preventDefault = vi.fn();
    const activate = vi.fn();
    activateOnEnterOrSpace({ key, preventDefault }, activate);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(activate).toHaveBeenCalledOnce();
  });

  it.each(['Escape', 'Tab', 'ArrowLeft', 'Spacebar'])('leaves %j for its real owner', (key) => {
    const preventDefault = vi.fn();
    const activate = vi.fn();
    activateOnEnterOrSpace({ key, preventDefault }, activate);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });
});
