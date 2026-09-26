import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { MessageDocument } from '../../db/schema';

const BOTTOM_TOLERANCE_PX = 8;
interface UseChatScrollOptions {
  messages: MessageDocument[];
  isSearching: boolean;
  conversationKey: string;
  isLoading: boolean;
}
interface SearchPosition {
  id?: string;
  offset: number;
  top: number;
  following: boolean;
}

export function useChatScroll({
  messages,
  isSearching,
  conversationKey,
  isLoading,
}: UseChatScrollOptions) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const following = useRef(true);
  const searching = useRef(isSearching);
  const ready = useRef(false);
  const knownIds = useRef(new Set<string>());
  const previousTop = useRef(0);
  const frame = useRef(0);
  const savedSearch = useRef<SearchPosition | null>(null);
  const wasSearching = useRef(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const unread = useRef(false);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);

  const updateControls = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.clientHeight - el.scrollTop <= BOTTOM_TOLERANCE_PX;
    setShowScrollButton(!searching.current && !atBottom);
    if (!searching.current && atBottom) unread.current = false;
    setHasUnreadBelow(unread.current);
  }, []);

  const pin = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !ready.current || searching.current || !following.current) return;
    el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
    previousTop.current = el.scrollTop;
    updateControls();
  }, [updateControls]);

  const schedulePin = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      pin(); // Intent is checked at execution time, not when the resize occurred.
      updateControls();
    });
  }, [pin, updateControls]);

  const suspendFollowing = useCallback(() => {
    following.current = false;
    cancelAnimationFrame(frame.current);
  }, []);

  const captureSearchPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el || searching.current) return;
    const top = el.getBoundingClientRect().top;
    const anchor = Array.from(el.querySelectorAll<HTMLElement>('[id^="msg-"]'))
      .find(node => node.getBoundingClientRect().bottom > top);
    savedSearch.current = {
      id: anchor?.id,
      offset: anchor ? anchor.getBoundingClientRect().top - top : 0,
      top: el.scrollTop,
      following: following.current,
    };
  }, []);

  // Reset before processing a new thread; StrictMode setup/cleanup is safe.
  useLayoutEffect(() => {
    following.current = true;
    ready.current = false;
    knownIds.current = new Set();
    savedSearch.current = null;
    wasSearching.current = false;
    previousTop.current = 0;
    unread.current = false;
    return () => cancelAnimationFrame(frame.current);
  }, [conversationKey]);

  useLayoutEffect(() => {
    searching.current = isSearching;
    if (isLoading) return;
    const additions = messages.filter(message => !knownIds.current.has(message.id));
    const initial = !ready.current;
    ready.current = true;
    knownIds.current = new Set(messages.map(message => message.id));

    if (wasSearching.current && !isSearching && savedSearch.current) {
      const saved = savedSearch.current;
      following.current = saved.following;
      const el = scrollRef.current;
      const anchor = saved.id ? document.getElementById(saved.id) : null;
      if (el && !saved.following) {
        el.scrollTop = anchor
          ? el.scrollTop + anchor.getBoundingClientRect().top - el.getBoundingClientRect().top - saved.offset
          : saved.top;
        previousTop.current = el.scrollTop;
      }
      savedSearch.current = null;
    }
    wasSearching.current = isSearching;
    if (!isSearching && (initial || additions.some(message => message.direction === 'outgoing'))) {
      following.current = true;
    }
    if (!initial && additions.some(message => message.direction === 'incoming') && (isSearching || !following.current)) {
      unread.current = true;
    }
    pin();
    schedulePin();
    updateControls();
  }, [messages, isSearching, isLoading, conversationKey, pin, schedulePin, updateControls]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (!el || !content) return;
    const onScroll = () => {
      if (searching.current) return;
      const atBottom = el.scrollHeight - el.clientHeight - el.scrollTop <= BOTTOM_TOLERANCE_PX;
      // Geometry changes can emit scroll events too. Only movement upward away
      // from the bottom cancels an existing pin; growth alone never does.
      if (atBottom) following.current = true;
      else if (el.scrollTop < previousTop.current - 0.5) suspendFollowing();
      previousTop.current = el.scrollTop;
      updateControls();
    };
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY < 0 && el.scrollTop > 0) suspendFollowing();
    };
    let touchY = 0;
    const onTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? touchY;
      if (y > touchY && el.scrollTop > 0) suspendFollowing();
      touchY = y;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    const observer = new ResizeObserver(schedulePin);
    observer.observe(el);
    observer.observe(content);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [conversationKey, schedulePin, suspendFollowing, updateControls]);

  const scrollToBottom = useCallback(() => {
    following.current = true;
    pin();
    schedulePin();
  }, [pin, schedulePin]);

  return {
    scrollRef,
    contentRef,
    showScrollButton: !isLoading && !isSearching && showScrollButton,
    hasUnreadBelow,
    scrollToBottom,
    suspendFollowing,
    captureSearchPosition,
  };
}
