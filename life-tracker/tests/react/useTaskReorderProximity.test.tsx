import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskReorderProximity } from '../../src/components/home/views/useTaskReorderProximity';

type MockRecord = {
  callback: IntersectionObserverCallback;
  nodes: Set<Element>;
  observe: ReturnType<typeof vi.fn>;
  unobserve: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  options?: IntersectionObserverInit;
};
const nativeObserver = globalThis.IntersectionObserver;
const records: MockRecord[] = [];

function installIntersectionObserver() {
  class FakeObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [0];
    readonly takeRecords = vi.fn(() => []);
    readonly observe = vi.fn((node: Element) => { this.nodes.add(node); });
    readonly unobserve = vi.fn((node: Element) => { this.nodes.delete(node); });
    readonly disconnect = vi.fn(() => { this.nodes.clear(); });
    readonly nodes = new Set<Element>();
    constructor(readonly callback: IntersectionObserverCallback,
      readonly options?: IntersectionObserverInit) {
      records.push(this);
    }
  }
  globalThis.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver;
}

function Probe({ label, eager = false }: { label: string; eager?: boolean }) {
  const { ref, registered } = useTaskReorderProximity(eager);
  return <div ref={ref} data-testid={label} data-registered={String(registered)} />;
}

describe('nearby Todo drag registration', () => {
  beforeEach(() => { records.length = 0; installIntersectionObserver(); });
  afterEach(() => cleanup());
  afterAll(() => {
    if (nativeObserver) globalThis.IntersectionObserver = nativeObserver;
    else delete (globalThis as Record<string, unknown>).IntersectionObserver;
  });

  it('shares one observer, registers only near rows, and unregisters on departure', () => {
    const { unmount } = render(<><Probe label="a" /><Probe label="b" /></>);
    expect(records).toHaveLength(1);
    expect(records[0].nodes.size).toBe(2);
    expect(records[0].options?.rootMargin).toBe('800px 0px 800px 0px');
    expect(screen.getByTestId('a')).toHaveAttribute('data-registered', 'false');
    expect(screen.getByTestId('b')).toHaveAttribute('data-registered', 'false');
    act(() => records[0].callback([
      { target: screen.getByTestId('a'), isIntersecting: true } as unknown as IntersectionObserverEntry,
    ], {} as IntersectionObserver));
    expect(screen.getByTestId('a')).toHaveAttribute('data-registered', 'true');
    expect(screen.getByTestId('b')).toHaveAttribute('data-registered', 'false');
    act(() => records[0].callback([
      { target: screen.getByTestId('a'), isIntersecting: false } as unknown as IntersectionObserverEntry,
    ], {} as IntersectionObserver));
    expect(screen.getByTestId('a')).toHaveAttribute('data-registered', 'false');
    unmount();
    expect(records[0].unobserve).toHaveBeenCalledTimes(2);
    expect(records[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it('registers eager first rows without observing them', () => {
    render(<Probe label="eager" eager />);
    expect(screen.getByTestId('eager')).toHaveAttribute('data-registered', 'true');
    expect(records).toHaveLength(0);
  });

  it('fails open for drag correctness when IntersectionObserver is unavailable', () => {
    delete (globalThis as Record<string, unknown>).IntersectionObserver;
    render(<Probe label="fallback" />);
    expect(screen.getByTestId('fallback')).toHaveAttribute('data-registered', 'true');
  });
});
