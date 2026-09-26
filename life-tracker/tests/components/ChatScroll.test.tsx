import { render, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useChatScroll } from '../../src/components/messages/useChatScroll';
import type { MessageDocument } from '../../src/db/schema';

const observers: Array<() => void> = [];
let reportedScrollHeight = 1200;

function message(id: string): MessageDocument {
  return { id } as MessageDocument;
}

function Harness({ messages }: { messages: MessageDocument[] }) {
  const { scrollRef, contentRef } = useChatScroll({
    messages,
    isSearching: false,
  });

  return (
    <div
      ref={(node) => {
        scrollRef.current = node;
        if (node) {
          Object.defineProperties(node, {
            scrollHeight: {
              configurable: true,
              get: () => reportedScrollHeight,
            },
            clientHeight: { configurable: true, get: () => 600 },
            scrollTop: { configurable: true, writable: true, value: 0 },
          });
        }
      }}
      data-testid="scroll"
    >
      <div ref={contentRef} data-testid="content">
        {messages.map((m) => (
          <div key={m.id}>{m.id}</div>
        ))}
      </div>
    </div>
  );
}

describe('useChatScroll', () => {
  beforeEach(() => {
    observers.length = 0;
    reportedScrollHeight = 1200;
    vi.stubGlobal(
      'requestAnimationFrame',
      (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      }
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal(
      'ResizeObserver',
      class {
        private callback: () => void;

        constructor(callback: () => void) {
          this.callback = callback;
          observers.push(() => this.callback());
        }

        observe() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('scrolls to the latest message when a chat mounts with messages', () => {
    const view = render(<Harness messages={[message('m1')]} />);
    const el = view.getByTestId('scroll');

    expect(el.scrollTop).toBe(600);
  });

  it('re-pins after message content grows after the React commit', () => {
    reportedScrollHeight = 800;
    const view = render(<Harness messages={[message('m1')]} />);
    const el = view.getByTestId('scroll');

    expect(el.scrollTop).toBe(200);

    reportedScrollHeight = 1100;
    act(() => {
      observers.at(-1)?.();
    });

    expect(el.scrollTop).toBe(500);
  });
});
