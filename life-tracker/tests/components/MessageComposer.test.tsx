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

describe('optional chat text initiation', () => {
  it('pauses plain-text input without hiding photo/sticker entry points', () => {
    const props = { onSend: vi.fn(), onSendPhoto: vi.fn(), onOpenStickers: vi.fn(), textEnabled: false };
    const { rerender } = render(<MessageComposer {...props} />);
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Attach photo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Open stickers' })).toBeEnabled();
    rerender(<MessageComposer {...props} textEnabled />);
    expect(screen.getByRole('textbox', { name: 'Message' })).toBeEnabled();
  });
});

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

  it('automatically focuses the composer when a reply starts, but never on plain chat entry', () => {
    const { rerender } = render(<MessageComposer onSend={vi.fn()} />);
    const textarea = screen.getByRole('textbox', { name: 'Message' });
    expect(document.activeElement).not.toBe(textarea);

    rerender(<MessageComposer onSend={vi.fn()} replyTo={{
      id: 'first', senderId: 'friend', senderName: 'Friend', content: 'Hello',
    }} />);
    expect(document.activeElement).toBe(textarea);

    // Replying to a different message also returns focus after another control
    // has been used, without a fragile setTimeout guess.
    textarea.blur();
    rerender(<MessageComposer onSend={vi.fn()} replyTo={{
      id: 'second', senderId: 'friend', senderName: 'Friend', content: 'Hi',
    }} />);
    expect(document.activeElement).toBe(textarea);
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

  it('warms sticker code on intent without stealing composer focus, but not when disabled', () => {
    const onPrepareStickers = vi.fn();
    const onOpenStickers = vi.fn();
    const { rerender } = render(<MessageComposer onSend={vi.fn()}
      onOpenStickers={onOpenStickers} onPrepareStickers={onPrepareStickers} />);
    const textarea = screen.getByRole('textbox', { name: 'Message' });
    const stickers = screen.getByRole('button', { name: 'Open stickers' });
    textarea.focus();
    fireEvent.pointerDown(stickers);
    expect(document.activeElement).toBe(textarea);
    expect(onPrepareStickers).toHaveBeenCalledTimes(1);
    fireEvent.click(stickers);
    expect(onOpenStickers).toHaveBeenCalledTimes(1);

    rerender(<MessageComposer onSend={vi.fn()} disabled
      onOpenStickers={onOpenStickers} onPrepareStickers={onPrepareStickers} />);
    fireEvent.pointerDown(stickers);
    fireEvent.click(stickers);
    expect(onPrepareStickers).toHaveBeenCalledTimes(1);
    expect(onOpenStickers).toHaveBeenCalledTimes(1);
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

  it('preserves the draft and reports an error if local message insertion rejects', async () => {
    const onSend = vi.fn().mockRejectedValue(new Error('Storage full'));
    const onSendError = vi.fn();
    render(<MessageComposer onSend={onSend} onSendError={onSendError} />);
    const textarea = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Do not lose this message' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    await waitFor(() => expect(onSendError).toHaveBeenCalledTimes(1));
    expect(textarea.value).toBe('Do not lose this message');
  });

  it('does not duplicate a send while the preceding insert is still pending', async () => {
    let resolveSend: (() => void) | undefined;
    const onSend = vi.fn(() => new Promise<void>((resolve) => { resolveSend = resolve; }));
    render(<MessageComposer onSend={onSend} />);
    const textarea = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Only one copy' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledTimes(1);
    await act(async () => { resolveSend?.(); });
    expect(textarea.value).toBe('');
  });

});

describe('photo composer opt-in', () => {
  it('does not surface a photo picker without an authorized photo action', () => {
    render(<MessageComposer onSend={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Attach photo' })).not.toBeInTheDocument();
  });
  it('retains the caption and selected photo until the local send resolves', async () => {
    const onSendPhoto = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:photo-preview') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    render(<MessageComposer onSend={vi.fn()} onSendPhoto={onSendPhoto} />);
    const input = screen.getByLabelText('Choose chat photo') as HTMLInputElement;
    const file = new File(['photo'], 'example.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    const textarea = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '  caption  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(onSendPhoto).toHaveBeenCalledWith(file, 'caption'));
    await waitFor(() => expect(textarea).toHaveValue(''));
  });
});
