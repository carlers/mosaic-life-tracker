import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import ReactDOM from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  height?: 'auto' | 'full';
  isLocked?: boolean;
  suspendInteraction?: boolean;
  backdropBlur?: boolean;
}

let openSheetCount = 0;

type SheetStackEntry = {
  id: string;
  onClose: () => void;
};

const sheetStack: SheetStackEntry[] = [];
const HISTORY_GUARD_KEY = '__mosaicBottomSheetGuard';
let historyGuardToken: string | null = null;
let historyGuardSequence = 0;
let historyBackHandlerInstalled = false;
let historyGuardReleaseTimer: number | null = null;

function readHistoryGuardToken(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    return null;
  }
  const value = (state as Record<string, unknown>)[HISTORY_GUARD_KEY];
  return typeof value === 'string' ? value : null;
}

function ensureHistoryGuard(): void {
  if (typeof window === 'undefined') return;

  if (
    historyGuardToken &&
    readHistoryGuardToken(window.history.state) === historyGuardToken
  ) {
    return;
  }

  const currentState =
    typeof window.history.state === 'object' &&
    window.history.state !== null &&
    !Array.isArray(window.history.state)
      ? (window.history.state as Record<string, unknown>)
      : {};
  const token = `mosaic-sheet-${++historyGuardSequence}`;

  window.history.pushState(
    { ...currentState, [HISTORY_GUARD_KEY]: token },
    '',
    window.location.href
  );
  historyGuardToken = token;
}

function cancelScheduledHistoryGuardRelease(): void {
  if (typeof window === 'undefined' || historyGuardReleaseTimer === null) return;
  window.clearTimeout(historyGuardReleaseTimer);
  historyGuardReleaseTimer = null;
}

function releaseHistoryGuardIfCurrent(): void {
  if (typeof window === 'undefined') return;

  const token = historyGuardToken;
  historyGuardToken = null;
  if (token && readHistoryGuardToken(window.history.state) === token) {
    window.history.back();
  }
}

function scheduleHistoryGuardRelease(): void {
  if (typeof window === 'undefined') return;
  cancelScheduledHistoryGuardRelease();
  historyGuardReleaseTimer = window.setTimeout(() => {
    historyGuardReleaseTimer = null;
    if (sheetStack.length === 0) {
      releaseHistoryGuardIfCurrent();
    }
  }, 0);
}

function handleBottomSheetPopState(event: PopStateEvent): void {
  const token = historyGuardToken;

  if (!token) {
    // A stale same-URL sheet guard can remain if the app route changed while a
    // sheet was mounted. Skip that inert entry rather than making Back appear
    // to do nothing on a later visit.
    if (sheetStack.length === 0 && readHistoryGuardToken(event.state)) {
      window.history.back();
    }
    return;
  }

  // Forward navigation onto the current guard is not a dismissal.
  if (readHistoryGuardToken(event.state) === token) return;

  historyGuardToken = null;
  const top = sheetStack.pop();
  if (!top) return;

  // One same-URL guard is enough for any stack depth. After Back consumes it,
  // immediately re-arm when an underlying sheet remains so the next Back
  // closes that sheet instead of leaving the current route.
  if (sheetStack.length > 0) {
    ensureHistoryGuard();
  }

  top.onClose();
}

function ensureHistoryBackHandler(): void {
  if (typeof window === 'undefined' || historyBackHandlerInstalled) return;
  window.addEventListener('popstate', handleBottomSheetPopState);
  historyBackHandlerInstalled = true;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  title,
  height = 'auto',
  isLocked = false,
  suspendInteraction = false,
  backdropBlur = false,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dragControls = useDragControls();
  const sheetId = React.useId();
  const titleId = React.useId();

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useFocusTrap(sheetRef, isOpen && !suspendInteraction);

  useEffect(() => {
    if (!isOpen) return;
    openSheetCount++;
    document.body.style.overflow = 'hidden';
    return () => {
      openSheetCount = Math.max(0, openSheetCount - 1);
      if (openSheetCount === 0) {
        document.body.style.overflow = 'unset';
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const entry: SheetStackEntry = {
      id: sheetId,
      onClose: () => onCloseRef.current(),
    };
    sheetStack.push(entry);
    cancelScheduledHistoryGuardRelease();
    ensureHistoryBackHandler();
    if (sheetStack.length === 1) {
      ensureHistoryGuard();
    }

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const top = sheetStack[sheetStack.length - 1];
      if (top && top.id === sheetId) {
        top.onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
      const idx = sheetStack.findIndex((sheet) => sheet.id === sheetId);
      if (idx > -1) sheetStack.splice(idx, 1);
      if (sheetStack.length === 0) {
        // Defer by one tick so React StrictMode's setup→cleanup→setup probe
        // and same-commit sheet handoffs do not consume browser history.
        scheduleHistoryGuardRelease();
      }
    };
  }, [isOpen, sheetId]);

  const heightClass =
    height === 'full'
      ? 'h-[100dvh] rounded-t-3xl'
      : 'max-h-[90vh] rounded-t-3xl';

  const sheetContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/*
            Backdrop. `aria-hidden` is correct — a modal backdrop is
            decorative and must not be reachable by keyboard or
            announced by a screen reader. Dismissal is via Escape, via
            the drag handle (pointer), or via a close button in the
            sheet content.
          */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={suspendInteraction ? undefined : onClose}
            aria-hidden="true"
            className={`fixed inset-0 z-[50] bg-black/60 ${backdropBlur ? 'backdrop-blur-sm' : ''} ${suspendInteraction ? 'pointer-events-none' : ''}`}
          />
          <motion.div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-hidden={suspendInteraction ? true : undefined}
            aria-labelledby={title ? titleId : undefined}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            dragSnapToOrigin
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) onClose();
            }}
            className={`fixed bottom-0 left-0 right-0 z-[60] bg-[#1E1E1E] text-white shadow-2xl flex flex-col overflow-hidden ${heightClass} ${suspendInteraction ? 'pointer-events-none select-none' : ''}`}
          >
            <div
              className={`flex-shrink-0 pt-3 pb-2 px-4 flex flex-col items-center transition-all duration-300 ${
                isLocked
                  ? 'cursor-default opacity-50 blur-sm pointer-events-none'
                  : 'cursor-grab active:cursor-grabbing touch-none'
              }`}
              onPointerDown={(e) => {
                if (!isLocked) {
                  dragControls.start(e);
                }
              }}
            >
              <div
                className="w-10 h-1.5 bg-[#444444] rounded-full mb-3"
                aria-hidden="true"
              />
              {title && (
                <h3
                  id={titleId}
                  className="text-lg font-semibold w-full text-center"
                >
                  {title}
                </h3>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-8 overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return ReactDOM.createPortal(sheetContent, document.body);
};
