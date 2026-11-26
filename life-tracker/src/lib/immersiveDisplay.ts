import { useSyncExternalStore } from 'react';

const PREFIX = 'mosaic_edge_to_edge_';
const CHANGE = 'mosaic-edge-to-edge-change';
const sessionValues = new Map<string, boolean>();

export function readDeviceEdgeToEdge(ownerId?: string): boolean {
  if (!ownerId || typeof window === 'undefined') return false;
  try {
    const stored = window.localStorage.getItem(PREFIX + ownerId);
    return stored === null ? (sessionValues.get(ownerId) ?? false) : stored === 'true';
  } catch {
    return sessionValues.get(ownerId) ?? false;
  }
}

export function setDeviceEdgeToEdge(ownerId: string | undefined, enabled: boolean): void {
  if (!ownerId || typeof window === 'undefined') return;
  sessionValues.set(ownerId, enabled);
  try { window.localStorage.setItem(PREFIX + ownerId, String(enabled)); } catch { /* session fallback */ }
  window.dispatchEvent(new Event(CHANGE));
}

function subscribeDisplay(callback: () => void) {
  window.addEventListener(CHANGE, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CHANGE, callback);
    window.removeEventListener('storage', callback);
  };
}

export function useDeviceEdgeToEdge(ownerId?: string): boolean {
  return useSyncExternalStore(subscribeDisplay, () => readDeviceEdgeToEdge(ownerId), () => false);
}

type FullscreenState = 'active' | 'available' | 'unsupported';

export function fullscreenState(): FullscreenState {
  if (typeof document === 'undefined') return 'unsupported';
  if (document.fullscreenElement) return 'active';
  return document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function'
    ? 'available' : 'unsupported';
}

function subscribeFullscreen(callback: () => void) {
  document.addEventListener('fullscreenchange', callback);
  document.addEventListener('fullscreenerror', callback);
  return () => {
    document.removeEventListener('fullscreenchange', callback);
    document.removeEventListener('fullscreenerror', callback);
  };
}

export function useFullscreenState() {
  return useSyncExternalStore(subscribeFullscreen, fullscreenState, () => 'unsupported' as const);
}

/** Must be called directly from a trusted user activation. */
export async function toggleImmersiveFullscreen(): Promise<void> {
  const state = fullscreenState();
  if (state === 'active') await document.exitFullscreen();
  else if (state === 'available') await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
  else throw new Error('Fullscreen is unavailable in this browser.');
}
