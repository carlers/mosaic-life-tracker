import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { canUseKeyboardShortcut } from '../lib/keyboardShortcuts';

export const PRIMARY_KEYBOARD_DESTINATIONS: Readonly<Record<string, string>> = {
  e: '/explore',
  a: '/notifications',
  c: '/messages',
  m: '/account',
};

/** Authenticated primary-page shortcuts. Native browser/editor and dialog
 * ownership always takes precedence over single-key navigation. */
export function usePrimaryNavigationShortcuts(enabled: boolean): void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'h' && event.key.length === 1) {
        if (!canUseKeyboardShortcut(event) || pathname === '/home') return;
        event.preventDefault();
        navigate('/home');
        return;
      }
      if (!canUseKeyboardShortcut(event)) return;
      const destination = PRIMARY_KEYBOARD_DESTINATIONS[event.key.toLowerCase()];
      if (!destination || event.key.length !== 1 || pathname === destination) return;
      event.preventDefault();
      navigate(destination);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled, navigate, pathname]);
}
