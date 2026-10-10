import React, {
  useEffect,
  useCallback,
  useImperativeHandle,
  useId,
  useRef,
  useState,
  forwardRef,
} from 'react';
import { motion } from 'framer-motion';
import { Send, Sticker } from 'lucide-react';
import { ReplyPreview } from './ReplyPreview';

interface ReplyToContext {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
}

interface MessageComposerProps {
  onSend: (content: string) => void;
  onOpenStickers?: () => void;
  onSendImage?: (file: File) => void;
  disabled?: boolean;
  placeholder?: string;
  replyTo?: ReplyToContext | null;
  onCancelReply?: () => void;
}

export interface MessageComposerHandle {
  focus: () => void;
}

const MAX_LENGTH = 4000;
const CHAR_COUNT_THRESHOLD = 200;

export const MessageComposer = forwardRef<
  MessageComposerHandle,
  MessageComposerProps
>(
  (
    {
      onSend,
      onOpenStickers,
      onSendImage,
      disabled = false,
      placeholder = 'Message…',
      replyTo = null,
      onCancelReply,
    },
    ref
  ) => {
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const richInputRef = useRef<HTMLDivElement>(null);
    // A contenteditable editor gives Android Chrome's rich IME insertion a
    // chance to expose image/*; normal textareas do not advertise that route.
    const richEditor = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
    const handledInputRef = useRef<File | null>(null);
    const composingRef = useRef(false);
    const focusInput = useCallback(() => {
      (richEditor ? richInputRef.current : inputRef.current)?.focus({ preventScroll: true });
    }, [richEditor]);
    const sendImage = (file: File) => {
      if (disabled || !onSendImage) return;
      if (handledInputRef.current === file) return;
      handledInputRef.current = file;
      queueMicrotask(() => {
        if (handledInputRef.current === file) handledInputRef.current = null;
      });
      onSendImage(file);
    };
    const counterId = useId();

    useEffect(() => {
      if (replyTo) {
        const timer = setTimeout(focusInput, 30);
        return () => clearTimeout(timer);
      }
    }, [replyTo, focusInput]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          focusInput();
        },
      }),
      [focusInput]
    );

    const handleSend = () => {
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      onSend(trimmed);
      setValue('');
      if (richInputRef.current) richInputRef.current.textContent = '';
      focusInput();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !composingRef.current) {
        e.preventDefault();
        handleSend();
      }
    };

    const imageFromTransfer = (transfer: DataTransfer | null | undefined): File | null => {
      if (!transfer) return null;
      const supported = ['image/png', 'image/webp', 'image/jpeg', 'image/gif'];
      const fromFiles = Array.from(transfer.files ?? []).find(file => supported.includes(file.type));
      if (fromFiles) return fromFiles;
      for (const item of Array.from(transfer.items ?? [])) {
        if (item.kind === 'file' && supported.includes(item.type)) {
          const candidate = item.getAsFile();
          if (candidate) return candidate;
        }
      }
      return null;
    };

    const receiveImage = (file: File | null, event: { preventDefault(): void }) => {
      if (!file || !onSendImage || disabled) return false;
      event.preventDefault();
      sendImage(file);
      return true;
    };

    const richInput = () => {
      const el = richInputRef.current;
      if (!el) return;
      // Chrome may insert an <img> rather than report an image File in
      // beforeinput/paste. Accept *only* local data/blob images, never remote
      // URLs. Remove injected image nodes regardless of their source.
      const images = Array.from(el.querySelectorAll('img'));
      for (const image of images) {
        const src = image.getAttribute('src') ?? '';
        if (onSendImage && !disabled &&
            (/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(src) && src.length < 14_000_000 ||
             src.startsWith('blob:'))) {
          void fetch(src).then(response => response.blob()).then(blob => {
            if (blob.size > 0 && blob.size <= 10 * 1024 * 1024 &&
                ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(blob.type)) {
              sendImage(new File([blob], 'keyboard-sticker', { type: blob.type }));
            }
          }).catch(() => {});
        }
        image.remove();
      }
      const text = el.textContent ?? '';
      if (!composingRef.current && text.length > MAX_LENGTH) {
        el.textContent = text.slice(0, MAX_LENGTH);
        setValue(text.slice(0, MAX_LENGTH));
      } else {
        setValue(text.slice(0, MAX_LENGTH));
      }
    };

    const remaining = MAX_LENGTH - value.length;
    const showCounter = remaining < CHAR_COUNT_THRESHOLD;

    return (
      <div
        className="relative z-30 flex w-full flex-col px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] border-t border-[#333333] bg-[#111111] pointer-events-auto"
      >
        {replyTo && (
          <ReplyPreview
            senderName={replyTo.senderName}
            content={replyTo.content}
            onCancel={onCancelReply}
            variant="composer"
          />
        )}
        <div className="flex items-end gap-2">
          {onOpenStickers && (
            <button type="button" onClick={onOpenStickers} disabled={disabled}
              onPointerDown={event => event.preventDefault()}
              aria-label="Open stickers"
              className="flex shrink-0 h-10 w-10 items-center justify-center rounded-full text-gray-300 hover:bg-surfaceHighlight focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50">
              <Sticker size={21} aria-hidden="true" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            {richEditor ? (
              <div
                ref={richInputRef}
                role="textbox"
                aria-label="Message"
                aria-multiline="true"
                aria-describedby={showCounter ? counterId : undefined}
                contentEditable={!disabled}
                suppressContentEditableWarning
                data-placeholder={placeholder}
                onCompositionStart={() => { composingRef.current = true; }}
                onCompositionEnd={() => { composingRef.current = false; richInput(); }}
                onKeyDown={handleKeyDown}
                onBeforeInput={event => {
                  const data = (event.nativeEvent as InputEvent).dataTransfer;
                  receiveImage(imageFromTransfer(data), event);
                }}
                onPaste={event => {
                  if (receiveImage(imageFromTransfer(event.clipboardData), event)) return;
                  // Never let remote HTML/images be pasted as active DOM nodes.
                  event.preventDefault();
                  document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
                }}
                onInput={richInput}
                className="w-full min-h-[42px] max-h-32 overflow-y-auto bg-[#1E1E1E] text-white text-sm rounded-2xl px-4 py-2.5 border border-[#333333] focus:border-[#555555] focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus:outline-none break-words whitespace-pre-wrap empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
              />
            ) : (
              <textarea
                ref={inputRef}
                value={value}
                onChange={e => setValue(e.target.value.slice(0, MAX_LENGTH))}
                onBeforeInput={event => {
                  receiveImage(imageFromTransfer((event.nativeEvent as InputEvent).dataTransfer), event);
                }}
                onPaste={event => { receiveImage(imageFromTransfer(event.clipboardData), event); }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={1}
                aria-label="Message"
                aria-describedby={showCounter ? counterId : undefined}
                className="w-full bg-[#1E1E1E] text-white text-sm rounded-2xl px-4 py-2.5 border border-[#333333] focus:border-[#555555] focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus:outline-none transition-colors placeholder-gray-400 resize-none max-h-32"
                style={{ minHeight: '42px' }}
              />
            )}
            {showCounter && (
              <p
                id={counterId}
                className="text-[10px] text-gray-400 text-right mt-0.5 mr-2"
                aria-live="polite"
              >
                {remaining} left
              </p>
            )}
          </div>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleSend}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            disabled={!value.trim() || disabled}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]"
            aria-label="Send"
          >
            <Send size={18} className="text-black" aria-hidden="true" />
          </motion.button>
        </div>
      </div>
    );
  }
);
MessageComposer.displayName = 'MessageComposer';
