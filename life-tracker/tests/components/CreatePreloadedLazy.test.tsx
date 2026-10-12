import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { createPreloadedLazy } from '../../src/lib/createPreloadedLazy';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

function mount() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  return {
    container,
    render: (element: React.ReactNode) => act(() => {
      flushSync(() => root.render(element));
    }),
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

it('renders a preloaded sheet on the first synchronous React commit', async () => {
  const Sheet = () => <div role="dialog" aria-label="Friend sheet" />;
  const loader = vi.fn(async () => Sheet);
  const { Component, preload } = createPreloadedLazy(loader);
  await preload();
  const view = mount();
  try {
    view.render(<Component />);
    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(loader).toHaveBeenCalledTimes(1);
  } finally {
    view.cleanup();
  }
});

it('preserves the cold fallback and never remounts an in-flight sheet', async () => {
  let resolve!: (value: React.FC) => void;
  const load = vi.fn(() => new Promise<React.FC>((done) => { resolve = done; }));
  const mounted = vi.fn();
  const Sheet: React.FC = () => {
    React.useEffect(() => { mounted(); }, []);
    return <div role="dialog" aria-label="Sticker sheet" />;
  };
  const { Component, preload } = createPreloadedLazy(load);
  const view = mount();
  try {
    view.render(<Component />);
    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
    const promise = preload();
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(Sheet); await promise; });
    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();
    view.render(<Component />);
    expect(mounted).toHaveBeenCalledTimes(1);
  } finally {
    view.cleanup();
  }
});

it('does not permanently poison a later warmup after a failed import', async () => {
  const Sheet = () => <div role="dialog" />;
  const load = vi.fn()
    .mockRejectedValueOnce(new Error('chunk unavailable'))
    .mockResolvedValue(Sheet);
  const { Component, preload } = createPreloadedLazy(load);
  await expect(preload()).rejects.toThrow('chunk unavailable');
  await expect(preload()).resolves.toBe(Sheet);
  const view = mount();
  try {
    view.render(<Component />);
    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  } finally {
    view.cleanup();
  }
});

