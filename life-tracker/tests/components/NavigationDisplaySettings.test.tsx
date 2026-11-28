import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NavigationDisplaySettings } from '../../src/components/settings/NavigationDisplaySettings';
import { readDeviceEdgeToEdge, setDeviceEdgeToEdge } from '../../src/lib/immersiveDisplay';

describe('NavigationDisplaySettings', () => {
  it('keeps Classic by default and saves the edge preference only for this device owner', () => {
    const onFloatingChange = vi.fn();
    const ownerId = 'navigation-display-test-a';
    const otherId = 'navigation-display-test-b';
    setDeviceEdgeToEdge(ownerId, false);
    setDeviceEdgeToEdge(otherId, false);
    try {
      const { rerender } = render(<NavigationDisplaySettings ownerId={ownerId} floating={false} onFloatingChange={onFloatingChange} />);
      const nav = screen.getByRole('switch', { name: 'Floating bottom navigation' });
      expect(nav).toHaveAttribute('aria-checked', 'false');
      fireEvent.click(nav);
      expect(onFloatingChange).toHaveBeenCalledWith(true);
      const edge = screen.getByRole('switch', { name: 'Edge-to-edge display' });
      expect(edge).toHaveAttribute('aria-checked', 'false');
      fireEvent.click(edge);
      expect(edge).toHaveAttribute('aria-checked', 'true');
      expect(readDeviceEdgeToEdge(ownerId)).toBe(true);
      expect(readDeviceEdgeToEdge(otherId)).toBe(false);
      rerender(<NavigationDisplaySettings ownerId={otherId} floating={false} onFloatingChange={onFloatingChange} />);
      expect(screen.getByRole('switch', { name: 'Edge-to-edge display' })).toHaveAttribute('aria-checked', 'false');
    } finally { setDeviceEdgeToEdge(ownerId, false); setDeviceEdgeToEdge(otherId, false); }
  });

  it('reflects browser fullscreen events and reports rejected activation without claiming success', async () => {
    const restorers: (() => void)[] = [];
    const replace = (object: object, key: string, value: unknown) => {
      const previous = Object.getOwnPropertyDescriptor(object, key);
      Object.defineProperty(object, key, { configurable: true, value });
      restorers.push(() => {
        if (previous) Object.defineProperty(object, key, previous);
        else Reflect.deleteProperty(object, key);
      });
    };
    const request = vi.fn().mockRejectedValue(new Error('denied'));
    const exit = vi.fn().mockResolvedValue(undefined);
    replace(document, 'fullscreenEnabled', true);
    replace(document, 'fullscreenElement', null);
    replace(document.documentElement, 'requestFullscreen', request);
    replace(document, 'exitFullscreen', exit);
    try {
      const { unmount } = render(<NavigationDisplaySettings ownerId="display" floating={false} onFloatingChange={() => {}} />);
      const row = screen.getByRole('button', { name: /Immersive fullscreen/ });
      expect(row).toHaveTextContent('Enter');
      fireEvent.click(row);
      expect(request).toHaveBeenCalledOnce();
      expect(await screen.findByRole('status')).toHaveTextContent('Fullscreen could not be changed');
      act(() => {
        Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: document.documentElement });
        document.dispatchEvent(new Event('fullscreenchange'));
      });
      expect(row).toHaveTextContent('Exit');
      fireEvent.click(row);
      expect(exit).toHaveBeenCalledOnce();
      act(() => {
        Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
        document.dispatchEvent(new Event('fullscreenchange'));
      });
      await waitFor(() => expect(row).toHaveTextContent('Enter'));
      unmount();
    } finally { for (const restore of restorers.reverse()) restore(); }
  });
});
