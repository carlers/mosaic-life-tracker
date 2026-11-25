import React from 'react';
import { CategorySection, type CategorySectionProps } from './CategorySection';

/** Identity-preserving bail-out for unchanged category rows.
 * Newly projected task lists may be different array instances even when each
 * task object and its order are identical. All other props are still compared
 * strictly, so editor state, notes, shared actions, gaps, and selection update.
 * React.memo itself does not block context/state-driven updates inside rows.
 */
export function equalCategoryProps(a: CategorySectionProps, b: CategorySectionProps): boolean {
  const aKeys = Object.keys(a) as (keyof CategorySectionProps)[];
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (key === 'tasks') {
      if (a.tasks.length !== b.tasks.length ||
          a.tasks.some((task, index) => task !== b.tasks[index])) return false;
    } else if (!Object.is(a[key], b[key])) {
      return false;
    }
  }
  return true;
}

export const MemoCategorySection = React.memo(CategorySection, equalCategoryProps);
MemoCategorySection.displayName = 'MemoCategorySection';
