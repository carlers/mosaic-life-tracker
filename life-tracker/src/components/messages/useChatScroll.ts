import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MessageDocument } from '../../db/schema';

const SCROLL_FAB_THRESHOLD_PX = 300;

interface UseChatScrollOptions {
  messages: MessageDocument[];
  isSearching: boolean;
}

interface UseChatScrollReturn {
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
  showScrollButton: boolean;
  hasUnreadBelow: boolean;
  scrollToBottom: () => void;
}

export function useChatScroll({
  messages,
  isSearching,
}: UseChatScrollOptions): UseChatScrollReturn {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const lastMsg = messages[messages.length - 1];
  const lastMsgId = lastMsg?.id ?? null;

  useLayoutEffect(() => {
    if (isSearching) return;
    const el = scrollRef.current;
    if (!el) return;
    if (!lastMsgId) return;

    // Every newly appended message (outgoing or incoming) keeps the conversation
    // anchored to the latest message. This is the chat route's explicit product contract.
    el.scrollTop = el.scrollHeight;
  }, [lastMsgId, isSearching]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      const pinned = distanceFromBottom < 80;
      setShowScrollButton(distanceFromBottom > SCROLL_FAB_THRESHOLD_PX);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [lastMsgId]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  const hasUnreadBelow = false;

  return {
    scrollRef,
    showScrollButton,
    hasUnreadBelow,
    scrollToBottom,
  };
}
