import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MessageDocument } from '../../src/db/schema';
import { useChatScroll } from '../../src/components/messages/useChatScroll';

const message = { id: 'message_1' } as MessageDocument;

describe('useChatScroll', () => {
  it('pins a newly opened chat to the bottom before paint', () => {
    const { result, rerender } = renderHook(
      ({ messages }: { messages: MessageDocument[] }) =>
        useChatScroll({ messages, isSearching: false }),
      { initialProps: { messages: [] } }
    );
    const scroller = document.createElement('div');
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1200 });
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 600 });
    scroller.scrollTop = 0;
    result.current.scrollRef.current = scroller;

    act(() => {
      rerender({ messages: [message] });
    });

    expect(scroller.scrollTop).toBe(1200);
  });
});
