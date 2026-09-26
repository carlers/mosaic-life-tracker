import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, fireEvent, screen, waitFor } from '@testing-library/react';
import { MessageComposer } from '../../src/components/messages/MessageComposer';

// ---------------------------------------------------------------------------
// MessageComposer component tests (Layer 5).
//
// Pins the observable contracts documented in docs/PROJECT_REFERENCE.md §21:
//   - Send button is disabled while the input is empty.
//   - Enter with non-whitespace text fires onSend(trimmed) and clears input.
//   - Shift+Enter does not fire onSend (falls through to newline).
//   - Reply context renders ReplyPreview; cancel fires onCancelReply.
//   - Input is capped at MAX_LENGTH (4000).
//
// Deliberately NOT tested here:
//   - Class strings on the send button or the textarea.
// ---------------------------------------------------------------------------

describe('MessageComposer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // Regression: §21 (initial chat composer stays unfocused).
  it('does not autofocus the textarea when the composer first mounts', () => {
    vi.useFakeTimers();
    render(<MessageComposer onSend={vi.fn()} />);

    const textarea = screen.getByRole('textbox', { name: 'Message' });
    expect(document.activeElement).not.toBe(textarea);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(document.activeElement).not.toBe(textarea);
  });

  it('send button is disabled when input is empty', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    const button = screen.getByLabelText('Send');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('Enter with text fires onSend(trimmed) and clears the input', async () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    const textarea = screen.getByPlaceholderText(
      'Message…'
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '  hi  ' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('hi');
    await waitFor(() => expect(textarea.value).toBe(''));
  });

  // Regression: §21 (Send preserves composer focus).
  it('prevents send pointer-down from taking focus away from the textarea', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);

    const textarea = screen.getByRole('textbox', {
      name: 'Message',
    }) as HTMLTextAreaElement;
    const button = screen.getByRole('button', { name: 'Send' });

    fireEvent.change(textarea, { target: { value: 'keep keyboard open' } });
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    const pointerDown = new Event('pointerdown', {
      bubbles: true,
      cancelable: true,
    });
    button.dispatchEvent(pointerDown);

    expect(pointerDown.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(textarea);

    fireEvent.click(button);
    expect(onSend).toHaveBeenCalledWith('keep keyboard open');
    expect(document.activeElement).toBe(textarea);
  });

  it('Shift+Enter does not fire onSend', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    const textarea = screen.getByPlaceholderText('Message…');
    fireEvent.change(textarea, { target: { value: 'hi' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('reply context renders ReplyPreview; cancel fires onCancelReply', () => {
    const onCancelReply = vi.fn();
    render(
      <MessageComposer
        onSend={vi.fn()}
        replyTo={{
          id: 'msg_1',
          senderId: 'user_B',
          senderName: 'Friend B',
          content: 'quoted text',
        }}
        onCancelReply={onCancelReply}
      />
    );
    expect(screen.getByText('Friend B')).toBeInTheDocument();
    expect(screen.getByText('quoted text')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Cancel reply'));
    expect(onCancelReply).toHaveBeenCalledTimes(1);
  });

  it('input value is capped at MAX_LENGTH (4000)', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    const textarea = screen.getByPlaceholderText(
      'Message…'
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'a'.repeat(4500) } });
    expect(textarea.value.length).toBe(4000);
  });
});
