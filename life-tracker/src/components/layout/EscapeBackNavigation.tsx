import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSettings } from '../../hooks/useSettings';
import { ESCAPE_AS_BACK_SETTING_KEY } from '../../lib/preferences';
import { hasExpectedRouteParent, resolveRouteParent } from '../../lib/primarySwipeNavigation';

/**
 * Route-level Escape owns only keys left unhandled by sheets, searches and editors.
 * It never handles Android Back itself; BottomSheet already owns that history stack.
 */
export function EscapeBackNavigation() {
  const { getSetting } = useSettings();
  const enabled = getSetting(ESCAPE_AS_BACK_SETTING_KEY, false) === true;
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.repeat || event.defaultPrevented ||
        event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

      const active = document.activeElement;
      const editableSelector = 'input, textarea, select, [contenteditable="true"]';
      if ((event.target instanceof Element && event.target.closest(editableSelector)) ||
        (active instanceof Element && active.closest(editableSelector))) return;

      // The existing sheet history handler and inline selection/chat handlers
      // are allowed to run before route-level navigation is considered.
      queueMicrotask(() => {
        if (event.defaultPrevented || document.getElementById('root')?.inert ||
          document.querySelector('[aria-modal="true"]:not([aria-hidden="true"]), .pswp--open')) return;

        if (window.history.state?.mosaicHomeSearch === true) {
          window.history.back();
          return;
        }

        const parent = resolveRouteParent(location.pathname, location.state);
        if (parent) {
          if (hasExpectedRouteParent(location.key, location.state, parent) &&
            window.history.state?.idx > 0) {
            navigate(-1);
          } else {
            navigate(parent, { replace: true });
          }
          return;
        }
        // Escape must not leave the application from its root route.
        if (location.pathname === '/home') return;
        if (typeof window.history.state?.idx === 'number' &&
          window.history.state.idx > 0) {
          navigate(-1);
        } else {
          navigate('/home', { replace: true });
        }
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, location.key, location.pathname, location.state, navigate]);

  return null;
}
