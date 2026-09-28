import { useCallback } from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useChatScroll } from '../../src/components/messages/useChatScroll';
import type { MessageDocument } from '../../src/db/schema';

let height = 1200;
let viewportHeight = 600;
let nextFrame = 0;
const frames = new Map<number, FrameRequestCallback>();
const observers = new Set<ResizeObserverCallback>();
const message = (id: string, direction = 'incoming') => ({ id, direction }) as MessageDocument;
function flush() { act(() => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(0)); }); }
function resize() { act(() => observers.forEach(fn => fn([], {} as ResizeObserver))); }
function attach(node: HTMLDivElement | null) {
  if (!node) return;
  let top = 0;
  Object.defineProperties(node, {
    scrollHeight: { configurable: true, get: () => height },
    clientHeight: { configurable: true, get: () => viewportHeight },
    scrollTop: { configurable: true, get: () => top, set: value => { top = Math.max(0, Math.min(value, height - viewportHeight)); } },
  });
}
function Harness({ messages = [message('a')], conversationKey = 'one', isLoading = false, isSearching = false }: { messages?: MessageDocument[]; conversationKey?: string; isLoading?: boolean; isSearching?: boolean }) {
  const { scrollRef, contentRef, scrollToBottom, captureSearchPosition, suspendFollowing, showScrollButton, hasUnreadBelow } = useChatScroll({ messages, conversationKey, isLoading, isSearching });
  const setNode = useCallback((node: HTMLDivElement | null) => { attach(node); scrollRef.current = node; }, [scrollRef]);
  return <>
    <div ref={setNode} data-testid="scroll">
      <div ref={contentRef}>{messages.map(m => <div id={`msg-${m.id}`} key={m.id}>{m.id}</div>)}</div>
    </div>
    <button onClick={scrollToBottom}>Bottom</button>
    <button onClick={captureSearchPosition}>Save search</button>
    <button onClick={suspendFollowing}>Quote</button>
    <output data-testid="fab">{String(showScrollButton)}</output>
    <output data-testid="unread">{String(hasUnreadBelow)}</output>
  </>;
}
function up(el: HTMLElement, top = 200) { act(() => { el.scrollTop = top; fireEvent.scroll(el); }); }

describe('chat scroll intent with mounted elements', () => {
  beforeEach(() => {
    height = 1200; viewportHeight = 600; frames.clear(); observers.clear();
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { frames.set(++nextFrame, fn); return nextFrame; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    vi.stubGlobal('ResizeObserver', class { constructor(private fn: ResizeObserverCallback) {} observe() { observers.add(this.fn); } disconnect() { observers.delete(this.fn); } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('opens at bottom and follows late layout only while pinned', () => {
    const view = render(<Harness />); const el = view.getByTestId('scroll');
    expect(el.scrollTop).toBe(600);
    height = 1500; resize(); flush(); expect(el.scrollTop).toBe(900);
    up(el); height = 1700; resize(); flush(); expect(el.scrollTop).toBe(200);
  });
  it('does not execute a stale resize pin after upward scrolling', () => {
    const view = render(<Harness />); const el = view.getByTestId('scroll');
    resize(); up(el); flush(); expect(el.scrollTop).toBe(200);
  });
  it('follows incoming at bottom, preserves history on incoming, always follows outgoing', () => {
    const messages = [message('a')]; const view = render(<Harness messages={messages} />); const el = view.getByTestId('scroll');
    height = 1300; messages.push(message('b')); view.rerender(<Harness messages={[...messages]} />); flush(); expect(el.scrollTop).toBe(700);
    up(el); height = 1400; messages.push(message('c')); view.rerender(<Harness messages={[...messages]} />); flush();
    expect(el.scrollTop).toBe(200); expect(view.getByTestId('unread')).toHaveTextContent('true');
    height = 1500; messages.push(message('d', 'outgoing')); view.rerender(<Harness messages={[...messages]} />); flush();
    expect(el.scrollTop).toBe(900); expect(view.getByTestId('unread')).toHaveTextContent('false');
  });
  it('ignores edits and deleting the last message while reading history', () => {
    const view = render(<Harness messages={[message('a', 'outgoing'), message('b')]} />); const el = view.getByTestId('scroll'); up(el);
    view.rerender(<Harness messages={[{ ...message('a', 'outgoing'), content: 'edited' }]} />); resize(); flush(); expect(el.scrollTop).toBe(200);
  });
  it('initializes delayed and empty conversations and resets thread state', () => {
    const view = render(<Harness messages={[]} isLoading />); const el = view.getByTestId('scroll'); expect(el.scrollTop).toBe(0);
    height = 600; view.rerender(<Harness messages={[]} />); flush();
    height = 1200; view.rerender(<Harness messages={[message('a')]} />); flush(); expect(el.scrollTop).toBe(600);
    up(el); view.rerender(<Harness conversationKey="two" messages={[message('b')]} />); flush(); expect(el.scrollTop).toBe(600);
  });
  it('suspends in search and restores prior reading position', () => {
    const view = render(<Harness />); const el = view.getByTestId('scroll'); up(el);
    fireEvent.click(view.getByText('Save search')); view.rerender(<Harness isSearching />);
    height = 1600; resize(); flush(); expect(el.scrollTop).toBe(200); expect(view.getByTestId('fab')).toHaveTextContent('false');
    view.rerender(<Harness />); flush(); expect(el.scrollTop).toBe(200);
  });
  it('FAB resumes following; quote navigation suspends resize following', () => {
    const view = render(<Harness />); const el = view.getByTestId('scroll'); up(el);
    fireEvent.click(view.getByText('Bottom')); expect(el.scrollTop).toBe(600);
    fireEvent.click(view.getByText('Quote')); height = 1600; resize(); flush(); expect(el.scrollTop).toBe(600);
  });
  it('keeps pin across viewport shrink but leaves an unpinned reader alone', () => {
    const view = render(<Harness />); const el = view.getByTestId('scroll'); viewportHeight = 300; resize(); flush(); expect(el.scrollTop).toBe(900);
    up(el); viewportHeight = 500; resize(); flush(); expect(el.scrollTop).toBe(200);
  });
  it('keeps following when upward input cannot scroll a short conversation', () => {
    height = 600;
    const view = render(<Harness />);
    const el = view.getByTestId('scroll');
    fireEvent.wheel(el, { deltaY: -100 });
    height = 900;
    view.rerender(<Harness messages={[message('a'), message('b')]} />);
    flush();
    expect(el.scrollTop).toBe(300);
  });
  it('cancels pending callbacks on unmount', () => {
    const view = render(<Harness />); resize(); view.unmount(); expect(frames.size).toBe(0); expect(observers.size).toBe(0);
  });
});
