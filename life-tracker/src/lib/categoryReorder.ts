/** Move a category in the account-wide order, without changing any tasks. */
export const moveCategoryId = (
  ids: readonly string[], id: string, delta: -1 | 1
): string[] => {
  const index = ids.indexOf(id);
  const nextIndex = index + delta;
  if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return [...ids];
  const next = [...ids];
  next.splice(index, 1);
  next.splice(nextIndex, 0, id);
  return next;
};

/** Compare the same complete category set, optionally requiring the same order. */
export const sameCategoryIds = (
  a: readonly string[], b: readonly string[], exactOrder = false
): boolean => {
  if (a.length !== b.length) return false;
  if (exactOrder) return a.every((id, index) => id === b[index]);
  const unique = new Set(a);
  return unique.size === a.length && b.every(id => unique.has(id));
};
