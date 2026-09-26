import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MessageDocument } from '../../db/schema';

const SCROLL_FAB_THRESHOLD_PX = 300;

interface UseChatScrollOptions {
  messages: MessageDocument[];
  isSearching: boolean;
}

interface UseChatScrollReturn {
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
  showScrollButton: boolean;
  hasUnreadBelow: boolean;
  scrollToBottom: () => void;
}

export function useChatScroll({
  messages,
  isSearching,
}: UseChatScrollOptions): UseChatScrollReturn {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const lastMsgId = messages[messages.length - 1]?.id ?? null;

  const scrollToLatest = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  }, []);

  useLayoutEffect(() => {
    if (isSearching || !lastMsgId) return;

    // The message list can grow after the React commit (font/image layout,
    // reply previews, or the keyboard changing the available viewport). A
    // single scrollTop assignment can therefore land before the final
    // scrollHeight exists.
    scrollToLatest();

    let frame = 0;
    frame = requestAnimationFrame(() => {
      scrollToLatest();
    });

    return () => cancelAnimationFrame(frame);
  }, [lastMsgId, isSearching, scrollToLatest]);

  useEffect(() => {
    if (isSearching) return;

    const content = contentRef.current;
    if (!content) return;

    let frame = 0;
    const handleResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        scrollToLatest();
      });
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(content);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [isSearching, lastMsgId, scrollToLatest]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollButton(distanceFromBottom > SCROLL_FAB_THRESHOLD_PX);
    };

    handleScroll();
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
    contentRef,
    showScrollButton,
    hasUnreadBelow,
    scrollToBottom,
  };
}
