import { act, render, screen } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useImageLoadGate } from '../../src/hooks/useImageLoadGate';

interface ObserverRecord {
  callback: IntersectionObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
  options?: IntersectionObserverInit;
}

const originalObserver = globalThis.IntersectionObserver;
let observers: ObserverRecord[] = [];

function installObserver(): void {
  class MockIntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [0.01];
    readonly disconnect = vi.fn();
    readonly observe = vi.fn();
    readonly takeRecords = vi.fn(() => []);
    readonly unobserve = vi.fn();

    constructor(
      readonly callback: IntersectionObserverCallback,
      readonly options?: IntersectionObserverInit
    ) {
      observers.push({
        callback,
        disconnect: this.disconnect,
        observe: this.observe,
        options,
      });
    }
  }
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
}

function Probe({ eager = false }: { eager?: boolean }) {
  const { targetRef, shouldLoad } = useImageLoadGate<HTMLDivElement>({ eager });
  return <div ref={targetRef}>{shouldLoad ? 'ready' : 'waiting'}</div>;
}

describe('useImageLoadGate', () => {
  beforeEach(() => {
    observers = [];
    installObserver();
  });

  afterAll(() => {
    if (originalObserver) {
      globalThis.IntersectionObserver = originalObserver;
    } else {
      delete (globalThis as Record<string, unknown>).IntersectionObserver;
    }
  });

  it('waits for proximity, then stays enabled', () => {
    render(<Probe />);
    expect(screen.getByText('waiting')).toBeInTheDocument();
    expect(observers).toHaveLength(1);
    expect(observers[0].options).toEqual({ rootMargin: '200px', threshold: 0.01 });

    act(() => {
      observers[0].callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it('loads eager content without creating an observer', () => {
    render(<Probe eager />);
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(observers).toHaveLength(0);
  });

  it('latches enabled after content becomes eager', () => {
    const { rerender } = render(<Probe />);
    expect(screen.getByText('waiting')).toBeInTheDocument();

    rerender(<Probe eager />);
    expect(screen.getByText('ready')).toBeInTheDocument();
    rerender(<Probe />);
    expect(screen.getByText('ready')).toBeInTheDocument();
  });

  it('loads immediately when IntersectionObserver is unavailable', () => {
    delete (globalThis as Record<string, unknown>).IntersectionObserver;
    render(<Probe />);
    expect(screen.getByText('ready')).toBeInTheDocument();
  });
});
