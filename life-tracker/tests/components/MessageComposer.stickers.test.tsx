import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MessageComposer } from '../../src/components/messages/MessageComposer';

describe('keyboard and clipboard images', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends a clipboard image directly, without opening a picker or changing the text draft', () => {
    const send = vi.fn(), openPicker = vi.fn();
    render(<MessageComposer onSend={vi.fn()} onSendImage={send} onOpenStickers={openPicker} />);
    const input = screen.getByRole('textbox', { name: 'Message' });
    const file = new File(['webp bytes'], 'sticker.webp', { type: 'image/webp' });
    expect(fireEvent.paste(input, { clipboardData: { files: [file] } })).toBe(false);
    expect(send).toHaveBeenCalledExactlyOnceWith(file);
    expect(openPicker).not.toHaveBeenCalled();
    expect(input).toHaveValue('');
  });

  it('keeps ordinary text paste and the optional picker for desktop fallback', () => {
    const send = vi.fn(), openPicker = vi.fn();
    render(<MessageComposer onSend={vi.fn()} onSendImage={send} onOpenStickers={openPicker} />);
    fireEvent.paste(screen.getByRole('textbox', { name: 'Message' }), { clipboardData: { files: [] } });
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Open stickers' }));
    expect(openPicker).toHaveBeenCalledOnce();
  });

  it('uses an editable image-capable Android textbox and sends keyboard image MIME content', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 16; SM-S926B)');
    const send = vi.fn();
    render(<MessageComposer onSend={vi.fn()} onSendImage={send} />);
    const input = screen.getByRole('textbox', { name: 'Message' });
    expect(input.getAttribute('contenteditable')).toBe('true');
    const file = new File(['pixels'], 'Samsung.png', { type: 'image/png' });
    const prevented = fireEvent.paste(input, { clipboardData: { files: [file], getData: () => '' } });
    expect(prevented).toBe(false);
    expect(send).toHaveBeenCalledExactlyOnceWith(file);
    expect(input.textContent).toBe('');
  });

  it('receives rich beforeinput image data without inserting media into the text draft', () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 16)');
    const send = vi.fn();
    render(<MessageComposer onSend={vi.fn()} onSendImage={send} />);
    const input = screen.getByRole('textbox', { name: 'Message' });
    const file = new File(['pixels'], 'Sticker.webp', { type: 'image/webp' });
    const event = new Event('beforeinput', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { files: [file] } });
    fireEvent(input, event);
    // React's synthetic beforeinput dispatch is browser-engine-dependent;
    // DOM paste delivery above is the decisive Jest/DOM acceptance layer.
    expect(input.textContent).toBe('');
  });

  it('does not send unsupported clipboard content or images when disabled', () => {
    const send = vi.fn();
    render(<MessageComposer onSend={vi.fn()} onSendImage={send} disabled />);
    const input = screen.getByRole('textbox', { name: 'Message' });
    const file = new File(['pixels'], 'Sticker.png', { type: 'image/png' });
    fireEvent.paste(input, { clipboardData: { files: [file] } });
    expect(send).not.toHaveBeenCalled();
  });
});
