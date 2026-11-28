import { isValidElement, type ReactNode } from 'react';

/**
 * Reuse the previous category subtree only if every semantic prop is identical.
 * React.memo on DraggableCategoryRow cannot help while an inline renderCategory
 * callback creates a new child element on every parent hover update.
 *
 * No props (including event handlers, content and visibility) are ignored:
 * changing any of them must invalidate the cached element.
 */
export function reuseEqualRenderedCategory(previous: ReactNode, next: ReactNode): ReactNode {
  if (!isValidElement(previous) || !isValidElement(next) ||
      previous.type !== next.type || previous.key !== next.key) return next;
  const before = previous.props as Record<string, unknown>;
  const after = next.props as Record<string, unknown>;
  const keys = Object.keys(before);
  if (keys.length !== Object.keys(after).length ||
      keys.some(key => !Object.prototype.hasOwnProperty.call(after, key) ||
        !Object.is(before[key], after[key]))) return next;
  return previous;
}
