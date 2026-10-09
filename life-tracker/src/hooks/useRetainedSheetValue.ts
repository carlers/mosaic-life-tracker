import { useCallback, useEffect, useState } from 'react';

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

  useEffect(() => {
    if (!isOpen || !value) return;
    // Avoid render loops when a domain hook returns an equivalent new object.
    setLastOpenValue((previous) => previous?.id === value.id ? previous : value);
  }, [isOpen, value]);

  const onExitComplete = useCallback(() => setLastOpenValue(null), []);
  return { value: value ?? lastOpenValue, onExitComplete };
}
