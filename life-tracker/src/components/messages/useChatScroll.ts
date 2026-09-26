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
  const isPinnedToBottomRef = useRef(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [lastAcknowledgedId, setLastAcknowledgedId] = useState<string | null>(
    null
  );

  const lastMsg = messages[messages.length - 1];
  const lastMsgId = lastMsg?.id ?? null;

  useLayoutEffect(() => {
    if (isSearching) return;
    const el = scrollRef.current;
    if (!el) return;
    if (!isPinnedToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
    setLastAcknowledgedId(lastMsgId);
  }, [lastMsgId, isSearching, messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      const pinned = distanceFromBottom < 80;
      isPinnedToBottomRef.current = pinned;
      setShowScrollButton(distanceFromBottom > SCROLL_FAB_THRESHOLD_PX);
      if (pinned) {
        setLastAcknowledgedId(lastMsgId);
      }
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [lastMsgId]);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    isPinnedToBottomRef.current = true;
    setLastAcknowledgedId(lastMsgId);
  }, [lastMsgId]);

  const hasUnreadBelow = !!lastMsgId && lastMsgId !== lastAcknowledgedId;

  return {
    scrollRef,
    showScrollButton,
    hasUnreadBelow,
    scrollToBottom,
  };
}
