import { useCallback, useState } from 'react';

/**
 * Keep the last opened entity alive until BottomSheet finishes its exit.
 *
 * A sheet whose parent clears task/message/friend state in onClose must not
 * return null at that moment: doing so unmounts the portal and cuts its
 * downward dismiss animation short. The current entity always wins on open,
 * while the retained snapshot is used only as closing content.
 */
export function useRetainedSheetValue<T extends { id: string }>(
  value: T | null,
  isOpen: boolean
) {
  const [lastOpenValue, setLastOpenValue] = useState<T | null>(null);

  // React's guarded render-time adjustment guarantees the last record is
  // captured before any Back/drag dismissal, without a setState-in-effect loop.
  if (isOpen && value && lastOpenValue?.id !== value.id) {
    setLastOpenValue(value);
  }

  const onExitComplete = useCallback(() => setLastOpenValue(null), []);
  return { value: value ?? lastOpenValue, onExitComplete };
}
