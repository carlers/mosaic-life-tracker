import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MessageComposer } from '../../src/components/messages/MessageComposer';

describe('chat sticker import entry', () => {
  it('offers the phone/clipboard image to the sticker importer instead of inserting binary content into the text draft', () => {
    const onPasteSticker = vi.fn();
    render(<MessageComposer onSend={vi.fn()} onPasteSticker={onPasteSticker} onOpenStickers={vi.fn()} />);
    const textarea = screen.getByRole('textbox', { name: 'Message' });
    const image = new File(['webp bytes'], 'sticker.webp', { type: 'image/webp' });
    const event = fireEvent.paste(textarea, { clipboardData: { files: [image] } });
    expect(event).toBe(false); // paste was intercepted, preventing raw text entry
    expect(onPasteSticker).toHaveBeenCalledWith(image);
    expect(textarea).toHaveValue('');
  });

  it('leaves ordinary text paste unchanged and exposes a named picker control', () => {
    const onPasteSticker = vi.fn();
    const onOpenStickers = vi.fn();
    render(<MessageComposer onSend={vi.fn()} onPasteSticker={onPasteSticker} onOpenStickers={onOpenStickers} />);
    fireEvent.paste(screen.getByRole('textbox', { name: 'Message' }), { clipboardData: { files: [] } });
    expect(onPasteSticker).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Open stickers' }));
    expect(onOpenStickers).toHaveBeenCalledOnce();
  });
});
