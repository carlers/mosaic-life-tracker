import React, {
  useEffect,
  useImperativeHandle,
  useId,
  useRef,
  useState,
  forwardRef,
} from 'react';
import { motion } from 'framer-motion';
import { Send } from 'lucide-react';
import { ReplyPreview } from './ReplyPreview';

interface ReplyToContext {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
}

interface MessageComposerProps {
  onSend: (content: string) => void;
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
      disabled = false,
      placeholder = 'Message…',
      replyTo = null,
      onCancelReply,
    },
    ref
  ) => {
    const [value, setValue] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const counterId = useId();

    useEffect(() => {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }, []);

    useEffect(() => {
      if (replyTo) {
        setTimeout(() => inputRef.current?.focus(), 30);
      }
    }, [replyTo]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          inputRef.current?.focus();
        },
      }),
      []
    );

    const handleSend = () => {
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      onSend(trimmed);
      setValue('');
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
      <div className="flex flex-col px-3 py-2 border-t border-[#333333] bg-[#111111] flex-shrink-0">
        {replyTo && (
          <ReplyPreview
            senderName={replyTo.senderName}
            content={replyTo.content}
            onCancel={onCancelReply}
            variant="composer"
          />
        )}
        <div className="flex items-end gap-2">
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
