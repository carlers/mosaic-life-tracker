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

    expect(scroller.scrollTop).toBe(600);
  });

  it('autoscrolls when a new outgoing or incoming message arrives', () => {
    const { result, rerender } = renderHook(
      ({ messages }: { messages: MessageDocument[] }) =>
        useChatScroll({ messages, isSearching: false }),
      { initialProps: { messages: [message] } }
    );
    const scroller = document.createElement('div');
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 1200 });
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 600 });
    scroller.scrollTop = 500;
    result.current.scrollRef.current = scroller;
    scroller.dispatchEvent(new Event('scroll'));

    act(() => {
      rerender({
        messages: [
          message,
          { id: 'message_2', direction: 'outgoing' } as MessageDocument,
        ],
      });
    });
    expect(scroller.scrollTop).toBe(600);

    scroller.scrollTop = 300;
    act(() => {
      rerender({
        messages: [
          message,
          { id: 'message_2', direction: 'outgoing' } as MessageDocument,
          { id: 'message_3', direction: 'incoming' } as MessageDocument,
        ],
      });
    });
    expect(scroller.scrollTop).toBe(1200);
  });
});
