import { useEffect } from 'react';
import { useShortcutGesture } from '../../hooks/useShortcutGesture';
import type { ShortcutGestureOptions } from '../../lib/shortcutGestureEngine';
import type { ShortcutGestureHandlers } from '../../lib/shortcutGestureHandlers';

/**
 * The recognizer hooks and touch event adapters belong to an opt-in chunk.
 * The owner surface remains mounted with the same DOM node throughout loading.
 */
export default function ShortcutGestureBridge({
  primary, secondary, onHandlers,
}: {
  primary: ShortcutGestureOptions;
  secondary?: ShortcutGestureOptions;
  onHandlers: (handlers: ShortcutGestureHandlers | null) => void;
}) {
  const handlers = useShortcutGesture(primary, secondary);
  useEffect(() => {
    onHandlers(handlers);
    return () => onHandlers(null);
  }, [handlers, onHandlers]);
  return null;
}
