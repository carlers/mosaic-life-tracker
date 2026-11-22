import { act, render, screen } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useImageLoadGate } from '../../src/hooks/useImageLoadGate';

interface ObserverRecord {
  callback: IntersectionObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
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
        unobserve: this.unobserve,
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
        [{ target: screen.getByText('waiting'), isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(screen.getByText('ready')).toBeInTheDocument();
    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it('shares one observer across photo gates and releases each image independently', () => {
    render(<><Probe /><Probe /></>);
    expect(observers).toHaveLength(1);
    expect(observers[0].observe).toHaveBeenCalledTimes(2);
    const [first, second] = observers[0].observe.mock.calls.map(([target]) => target as Element);

    act(() => {
      observers[0].callback([{ target: first, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(screen.getAllByText('ready')).toHaveLength(1);
    expect(screen.getAllByText('waiting')).toHaveLength(1);
    expect(observers[0].unobserve).toHaveBeenCalledWith(first);
    expect(observers[0].disconnect).not.toHaveBeenCalled();

    act(() => {
      observers[0].callback([{ target: second, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    expect(screen.getAllByText('ready')).toHaveLength(2);
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it('defers visible calendar photos until the swipe settles', () => {
    const calendar = document.createElement('div');
    calendar.dataset.routeSwipeHorizontalOwner = 'true';
    calendar.dataset.calendarMediaPaused = 'true';
    document.body.append(calendar);
    const { getByText } = render(<Probe />, { container: calendar });
    const image = getByText('waiting');
    act(() => {
      observers[0].callback(
        [{ target: image, isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(getByText('waiting')).toBeInTheDocument();
    expect(observers[0].unobserve).not.toHaveBeenCalled();

    act(() => {
      delete calendar.dataset.calendarMediaPaused;
      calendar.dispatchEvent(new Event('mosaic-calendar-media-resume'));
    });
    // Resume invalidates stale intersection samples; only a *new* visible
    // observation starts an image after the user's swipe settles.
    expect(getByText('waiting')).toBeInTheDocument();
    expect(observers[0].observe).toHaveBeenCalledTimes(2);
    act(() => observers[0].callback(
      [{ target: image, isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    ));
    expect(getByText('ready')).toBeInTheDocument();
    expect(observers[0].unobserve).toHaveBeenCalledWith(image);
    calendar.remove();
  });

  it('does not start an image for a month that leaves the viewport before release', () => {
    const calendar = document.createElement('div');
    calendar.dataset.routeSwipeHorizontalOwner = 'true';
    calendar.dataset.calendarMediaPaused = 'true';
    document.body.append(calendar);
    const { getByText } = render(<Probe />, { container: calendar });
    const image = getByText('waiting');
    act(() => {
      observers[0].callback([
        { target: image, isIntersecting: true } as IntersectionObserverEntry,
        { target: image, isIntersecting: false } as IntersectionObserverEntry,
      ], {} as IntersectionObserver);
    });
    act(() => {
      delete calendar.dataset.calendarMediaPaused;
      calendar.dispatchEvent(new Event('mosaic-calendar-media-resume'));
    });
    expect(getByText('waiting')).toBeInTheDocument();
    act(() => {
      observers[0].callback(
        [{ target: image, isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    expect(getByText('ready')).toBeInTheDocument();
    calendar.remove();
  });

  it('does not fetch a photo after resuming into a different offscreen month', () => {
    const calendar = document.createElement('div');
    calendar.dataset.routeSwipeHorizontalOwner = 'true';
    calendar.dataset.calendarMediaPaused = 'true';
    document.body.append(calendar);
    const { getByText } = render(<Probe />, { container: calendar });
    const image = getByText('waiting');
    act(() => observers[0].callback(
      [{ target: image, isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    ));
    act(() => {
      delete calendar.dataset.calendarMediaPaused;
      calendar.dispatchEvent(new Event('mosaic-calendar-media-resume'));
    });
    act(() => observers[0].callback(
      [{ target: image, isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver
    ));
    expect(getByText('waiting')).toBeInTheDocument();
    act(() => observers[0].callback(
      [{ target: image, isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    ));
    expect(getByText('ready')).toBeInTheDocument();
    calendar.remove();
  });

  it('cleans pending calendar photo work on unmount', () => {
    const calendar = document.createElement('div');
    calendar.dataset.routeSwipeHorizontalOwner = 'true';
    calendar.dataset.calendarMediaPaused = 'true';
    document.body.append(calendar);
    const { getByText, unmount } = render(<Probe />, { container: calendar });
    act(() => {
      observers[0].callback(
        [{ target: getByText('waiting'), isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });
    unmount();
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
    calendar.dispatchEvent(new Event('mosaic-calendar-media-resume'));
    calendar.remove();
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
