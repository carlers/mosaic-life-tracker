import React, {
  useEffect,
  useImperativeHandle,
  useId,
  useRef,
  useState,
  forwardRef,
} from 'react';
import { motion } from 'framer-motion';
import { Send, Sticker, ImagePlus, X } from 'lucide-react';
import { ReplyPreview } from './ReplyPreview';

interface ReplyToContext {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
}

interface MessageComposerProps {
  onSend: (content: string) => void | Promise<void>;
  onSendPhoto?: (file: File, caption: string) => void | Promise<void>;
  onSendError?: () => void;
  onOpenStickers?: () => void;
  onPrepareStickers?: () => void;
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
      onSendPhoto,
      onSendError,
      onOpenStickers,
      onPrepareStickers,
      disabled = false,
      placeholder = 'Message…',
      replyTo = null,
      onCancelReply,
    },
    ref
  ) => {
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    useEffect(() => {
      if (!photo) { setPhotoPreview(null); return; }
      const url = URL.createObjectURL(photo);
      setPhotoPreview(url);
      return () => URL.revokeObjectURL(url);
    }, [photo]);
    const counterId = useId();
    const sendingRef = useRef(false);

    // Reply intent, not merely opening a chat, focuses the field by default.
    // A reply chosen from a BottomSheet is also refocused after the sheet exits.
    useEffect(() => {
      if (replyTo && !disabled) inputRef.current?.focus({ preventScroll: true });
    }, [replyTo, disabled]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          inputRef.current?.focus();
        },
      }),
      []
    );

    const handleSend = async () => {
      const trimmed = value.trim();
      if ((!trimmed && !photo) || disabled || sendingRef.current) return;
      sendingRef.current = true;
      try {
        // Do not discard the draft before its durable local insert succeeds.
        if (photo && onSendPhoto) await onSendPhoto(photo, trimmed);
        else await onSend(trimmed);
        setPhoto(null);
        if (photoInputRef.current) photoInputRef.current.value = '';
        setValue((current) => current === value ? '' : current);
      } catch {
        onSendError?.();
      } finally {
        sendingRef.current = false;
      }
      inputRef.current?.focus({ preventScroll: true });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
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
        {photoPreview && (
          <div className="mb-2 flex items-start gap-2" aria-label="Selected chat photo">
            <img src={photoPreview} alt="Photo to send" className="max-h-28 max-w-36 rounded-lg object-contain" />
            <button type="button" aria-label="Remove photo" onClick={() => { setPhoto(null); if (photoInputRef.current) photoInputRef.current.value = ''; }}
              className="rounded-full p-2 text-gray-300 focus-visible:ring-2 focus-visible:ring-emerald-500"><X size={18} /></button>
          </div>
        )}
        <div className="flex items-end gap-2">
          {onSendPhoto && (
            <>
              <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
                aria-label="Choose chat photo" onChange={event => setPhoto(event.target.files?.[0] || null)} />
              <button type="button" aria-label="Attach photo" disabled={disabled}
                onClick={() => photoInputRef.current?.click()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-300 hover:bg-surfaceHighlight focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50">
                <ImagePlus size={21} aria-hidden="true" />
              </button>
            </>
          )}
          {onOpenStickers && (
            <button type="button" aria-label="Open stickers" disabled={disabled}
              onClick={onOpenStickers}
              onPointerDown={event => {
                event.preventDefault();
                if (!disabled) onPrepareStickers?.();
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-300 hover:bg-surfaceHighlight focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50">
              <Sticker size={21} aria-hidden="true" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              rows={1}
              aria-label="Message"
              aria-describedby={showCounter ? counterId : undefined}
              className="w-full bg-[#1E1E1E] text-white text-sm rounded-2xl px-4 py-2.5 border border-[#333333] focus:border-[#555555] focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus:outline-none transition-colors placeholder-gray-400 resize-none max-h-32"
              style={{ minHeight: '42px' }}
            />
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
            disabled={(!value.trim() && !photo) || disabled}
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
