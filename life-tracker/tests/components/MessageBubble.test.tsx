import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { MessageBubble } from '../../src/components/messages/MessageBubble';
import type { MessageDocument } from '../../src/db/schema';

// ---------------------------------------------------------------------------
// MessageBubble component tests (Layer 5).
//
// These pin the observable contracts documented in docs/PROJECT_REFERENCE.md §§7 and 21:
//   - Unsent messages render the deleted bubble; no gesture-bearing surface.
//   - Status rows dispatch on `statusKind` (read / delivered / pending).
//   - Single-tap reveals the timestamp.
//   - Double-tap fires onReact with the fixed heart emoji.
//   - Reply preview renders sender + quote; quote tap fires onQuoteTap.
//
// Deliberately NOT tested here:
//   - Swipe-to-reply firing. The gesture requires >8px horizontal, <30px
//     vertical, and >60px swipe-threshold travel on pointer-up. Reproducing
//     that faithfully in happy-dom is brittle; the alternative (bypassing the
//     hook's guards) is internals-coupled and §24.3-non-compliant.
//   - CSS class strings (bubble background, max-width). Internals-coupled.
// ---------------------------------------------------------------------------

function makeMessage(
  overrides: Partial<MessageDocument> = {}
): MessageDocument {
  const id = overrides.id ?? 'msg_test';
  return {
    id,
    userId: 'user_A',
    threadId: 'th_test',
    senderId: 'user_A',
    recipientId: 'user_B',
    direction: 'outgoing',
    content: 'hello',
    taskRefId: '',
    taskRefTitle: '',
    taskRefDate: '',
    taskRefColor: '',
    replyToId: '',
    replyToContent: '',
    replyToSenderId: '',
    isUnsent: false,
    originalMessageId: id,
    reactions: '',
    readAt: '',
    deliveryStatus: 'delivered',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    isDeleted: false,
    ...overrides,
  };
}

function getGestureSurface(container: HTMLElement): HTMLElement {
  const wrapper = container.querySelector('[data-message-id]');
  if (!wrapper) throw new Error('bubble wrapper not found');
  const bubble = wrapper.querySelector('[role="button"]');
  if (!bubble) throw new Error('gesture surface not found');
  return bubble as HTMLElement;
}

function tap(element: Element): void {
  const init = {
    pointerId: 1,
    pointerType: 'touch',
    button: 0,
    clientX: 100,
    clientY: 100,
  };
  fireEvent.pointerDown(element, init);
  fireEvent.pointerUp(element, init);
}

describe('MessageBubble', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('unsent message renders the deleted state and exposes no gesture surface', () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage({ id: 'msg_x', isUnsent: true })}
        isOutgoing
        currentUserId="user_A"
      />
    );
    expect(container.textContent).toContain('Message deleted');
    // The unsent branch returns early; no swipe/tap surface is rendered.
    // If this assertion ever fails, the branch was refactored to keep the
    // gesture handlers attached — which would let tap/long-press fire on a
    // message that has no actionable content.
    expect(container.querySelector('[data-message-id]')).toBeNull();
  });

  it('read status renders "Seen"', () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage({ readAt: '2026-01-01T01:00:00.000Z' })}
        isOutgoing
        currentUserId="user_A"
        statusKind="read"
      />
    );
    expect(container.textContent).toMatch(/Seen/);
  });

  it('delivered status renders "Delivered"', () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage()}
        isOutgoing
        currentUserId="user_A"
        statusKind="delivered"
      />
    );
    expect(container.textContent).toContain('Delivered');
  });

  it('pending status renders "Sending"', () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage({ deliveryStatus: 'pending' })}
        isOutgoing
        currentUserId="user_A"
        statusKind="pending"
      />
    );
    expect(container.textContent).toContain('Sending');
  });

  it('single-tap reveals the timestamp', () => {
    vi.useFakeTimers();
    const { container } = render(
      <MessageBubble
        message={makeMessage()}
        isOutgoing
        currentUserId="user_A"
      />
    );
    const timeRegex = /\d{1,2}:\d{2}\s?(AM|PM)/i;
    // Pre-tap: no timestamp text. This is the "before" half of the contract.
    expect(container.textContent ?? '').not.toMatch(timeRegex);
    const surface = getGestureSurface(container);
    tap(surface);
    // Advance past the 300ms double-tap window so the single-tap timer fires.
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(container.textContent ?? '').toMatch(timeRegex);
  });

  it('keyboard activation reveals the timestamp', () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage()}
        isOutgoing
        currentUserId="user_A"
      />
    );
    const timeRegex = /\d{1,2}:\d{2}\s?(AM|PM)/i;
    const surface = getGestureSurface(container);
    expect(surface.getAttribute('role')).toBe('button');
    expect(surface.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(surface, { key: 'Enter' });
    expect(container.textContent ?? '').toMatch(timeRegex);
  });

  it('double-tap fires onReact with the fixed heart emoji', () => {
    vi.useFakeTimers();
    const onReact = vi.fn();
    const message = makeMessage();
    const { container } = render(
      <MessageBubble
        message={message}
        isOutgoing
        currentUserId="user_A"
        onReact={onReact}
      />
    );
    const surface = getGestureSurface(container);
    tap(surface);
    // Second tap inside the 300ms double-tap window. `Date.now()` is faked
    // alongside the timers, so advancing 100ms puts the second tap well
    // within the window.
    act(() => {
      vi.advanceTimersByTime(100);
    });
    tap(surface);
    expect(onReact).toHaveBeenCalledTimes(1);
    expect(onReact).toHaveBeenCalledWith(message.id, '❤️');
  });

  it('reply preview renders sender + quote and quote tap fires onQuoteTap', () => {
    const onQuoteTap = vi.fn();
    const resolveSenderName = (id: string): string =>
      id === 'user_B' ? 'Friend B' : 'Unknown';
    const { container } = render(
      <MessageBubble
        message={makeMessage({
          id: 'msg_reply',
          direction: 'incoming',
          senderId: 'user_B',
          recipientId: 'user_A',
          replyToId: 'msg_prev',
          replyToContent: 'quoted text',
          replyToSenderId: 'user_B',
        })}
        isOutgoing={false}
        currentUserId="user_A"
        resolveSenderName={resolveSenderName}
        onQuoteTap={onQuoteTap}
      />
    );
    expect(container.textContent).toContain('Friend B');
    expect(container.textContent).toContain('quoted text');
    const replyButton = container.querySelector(
      '[data-message-id] > [role="button"] > button'
    );
    expect(replyButton).not.toBeNull();
    fireEvent.click(replyButton as Element);
    expect(onQuoteTap).toHaveBeenCalledWith('msg_prev');
  });
});
