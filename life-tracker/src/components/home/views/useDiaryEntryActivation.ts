import { useEffect, useRef } from 'react';

/** A mouse double-click must not open the reading sheet on its first click:
 * the dialog unmounts the target before a browser can deliver dblclick. */
export function useDiaryEntryActivation<T>(
  onRead: (entry: T) => void,
  onEdit?: (entry: T) => void,
) {
  const pointerType = useRef('mouse');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);
  const rememberPointer = (type: string) => { pointerType.current = type; };
  const activate = (entry: T, clickCount: number) => {
    if (clickCount >= 2 && onEdit) { clear(); return; }
    if (timer.current) clear();
    // Touch and keyboard retain instant single-tap navigation. A mouse
    // single-click waits for a possible second click before mounting a sheet.
    if (!onEdit || pointerType.current !== 'mouse' || clickCount === 0) {
      onRead(entry);
      return;
    }
    timer.current = setTimeout(() => { timer.current = null; onRead(entry); }, 240);
  };
  const doubleClick = (entry: T) => {
    clear();
    (onEdit ?? onRead)(entry);
  };
  return { rememberPointer, activate, doubleClick, cancel: clear };
}
