import { act, render, waitFor } from '@testing-library/react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeferredAvatar } from '../../src/components/ui/DeferredAvatar';
import { resetTaskImageCacheForTests } from '../../src/hooks/useTaskImage';

const getLocalImageUrl = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/storage', () => ({ getLocalImageUrl }));

interface ObserverRecord {
  callback: IntersectionObserverCallback;
  disconnect: ReturnType<typeof vi.fn>;
}

const originalObserver = globalThis.IntersectionObserver;
const originalRevoke = globalThis.URL.revokeObjectURL;
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

    constructor(readonly callback: IntersectionObserverCallback) {
      observers.push({ callback, disconnect: this.disconnect });
    }
  }
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
}

function intersect(record: ObserverRecord): void {
  act(() => {
    record.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
  });
}

describe('DeferredAvatar', () => {
  beforeEach(() => {
    resetTaskImageCacheForTests();
    observers = [];
    installObserver();
    getLocalImageUrl.mockReset();
    getLocalImageUrl.mockImplementation(
      async (fileId: string) => `blob:avatar-${fileId}`
    );
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterAll(() => {
    if (originalObserver) {
      globalThis.IntersectionObserver = originalObserver;
    } else {
      delete (globalThis as Record<string, unknown>).IntersectionObserver;
    }
    if (originalRevoke) {
      globalThis.URL.revokeObjectURL = originalRevoke;
    } else {
      delete (globalThis.URL as unknown as Record<string, unknown>)
        .revokeObjectURL;
    }
  });

  it('acquires only avatars that enter the preload margin', async () => {
    render(
      <>
        <DeferredAvatar fileId="first" alt="First" />
        <DeferredAvatar fileId="second" alt="Second" />
      </>
    );
    expect(observers).toHaveLength(2);
    expect(getLocalImageUrl).not.toHaveBeenCalled();

    intersect(observers[0]);
    await waitFor(() => expect(getLocalImageUrl).toHaveBeenCalledWith('first'));
    expect(getLocalImageUrl).toHaveBeenCalledTimes(1);

    intersect(observers[1]);
    await waitFor(() => expect(getLocalImageUrl).toHaveBeenCalledWith('second'));
    expect(getLocalImageUrl).toHaveBeenCalledTimes(2);
  });

  it('shares one acquisition when visible avatars use the same file', async () => {
    render(
      <>
        <DeferredAvatar fileId="shared" alt="First" />
        <DeferredAvatar fileId="shared" alt="Second" />
      </>
    );
    intersect(observers[0]);
    intersect(observers[1]);

    await waitFor(() => expect(getLocalImageUrl).toHaveBeenCalledTimes(1));
    expect(getLocalImageUrl).toHaveBeenCalledWith('shared');
  });

  it('acquires an eager visible avatar immediately', async () => {
    render(<DeferredAvatar fileId="header" alt="Header" eager />);
    await waitFor(() => expect(getLocalImageUrl).toHaveBeenCalledWith('header'));
    expect(observers).toHaveLength(0);
  });
});
