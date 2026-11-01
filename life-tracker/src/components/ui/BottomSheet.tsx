import React, { useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { animate, motion, AnimatePresence, useDragControls, useMotionValue, usePresence } from 'framer-motion';
import ReactDOM from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { AppearanceContext } from '../../hooks/appearanceContext';
import { systemRequestsReducedMotion } from '../../lib/motionPreferences';
import { publishSheetVisibility } from '../../lib/sheetVisibility';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  ariaLabel?: string;
  height?: 'auto' | 'full';
  isLocked?: boolean;
  preventDismiss?: boolean;
  suspendInteraction?: boolean;
  backdropBlur?: boolean;
  /** Keep the sheet surface at native scale beneath nested sheets with layout-sensitive rows. */
  scaleBehind?: boolean;
  contentMode?: 'scroll' | 'fixed';
  onHorizontalSwipe?: (direction: 'left' | 'right') => void;
  onAnimationComplete?: () => void;
  /** Called after the shared sheet finishes its closing transition. */
  onExitComplete?: () => void;
  deferChildrenUntilPaint?: boolean;
  /** Consume Escape/Android Back without dismissing the sheet (for transient modes). */
  onTransientDismiss?: () => boolean;
  /** Allow touch pull-down dismissal from content when its scroll containers start at the top. */
  pullDownToDismiss?: boolean;
}

type SheetStackEntry = {
  id: string;
  historyId: string;
  onClose: () => void;
  preventDismiss: () => boolean;
  onTransientDismiss: () => boolean;
};

let openSheetCount = 0;
const sheetStack: SheetStackEntry[] = [];
const issuedHistoryIds = new Set<string>();
const pendingCleanupTimers = new Map<string, number>();
const HISTORY_GUARD_KEY = '__mosaicBottomSheetGuard';
let historyGuardSequence = 0;
let historyBackHandlerInstalled = false;
/** Visible portals outlive isOpen until Framer finishes the exit animation. */
const visibleSheetIds: string[] = [];
// Exiting portals remain visible/inert, but must stop holding the parent at its
// behind-layer scale. Keep live-opening state separate from portal ownership.
const openSheetIds = new Set<string>();
const sheetLayerListeners = new Set<() => void>();
const deferredFocusReturn = new Map<string, HTMLElement>();

function queueFocusReturn(sheetId: string, target: HTMLElement) {
  deferredFocusReturn.set(sheetId, target);
}

let previousAppInert = false;

function subscribeSheetLayers(listener: () => void) {
  sheetLayerListeners.add(listener);
  return () => { sheetLayerListeners.delete(listener); };
}

function currentTopVisibleSheet(): string | null {
  return visibleSheetIds[visibleSheetIds.length - 1] ?? null;
}

function currentTopOpenSheet(): string | null {
  for (let index = visibleSheetIds.length - 1; index >= 0; index -= 1) {
    if (openSheetIds.has(visibleSheetIds[index])) return visibleSheetIds[index];
  }
  return null;
}

function updateOpenSheet(sheetId: string, isOpen: boolean) {
  if (openSheetIds.has(sheetId) === isOpen) return;
  if (isOpen) openSheetIds.add(sheetId);
  else openSheetIds.delete(sheetId);
  for (const listener of sheetLayerListeners) listener();
}

function updateVisibleSheet(sheetId: string, visible: boolean) {
  const index = visibleSheetIds.indexOf(sheetId);
  if ((index >= 0) === visible) return;
  if (visible) visibleSheetIds.push(sheetId);
  else visibleSheetIds.splice(index, 1);

  // BottomSheet is portaled to body. Only the application tree (not other
  // body-level overlays such as PhotoSwipe) becomes inert behind an open sheet.
  const appRoot = document.getElementById('root');
  if (visibleSheetIds.length === 1 && visible) {
    previousAppInert = appRoot?.inert ?? false;
  }
  if (appRoot) appRoot.inert = visibleSheetIds.length > 0 || previousAppInert;
  publishSheetVisibility(visibleSheetIds.length > 0);
  for (const listener of sheetLayerListeners) listener();
  if (!visible) {
    const target = deferredFocusReturn.get(sheetId);
    deferredFocusReturn.delete(sheetId);
    if (target) {
      // Do not return focus while the owner is still inert. A frame gives
      // the newly exposed parent sheet time to release its inert state.
      window.requestAnimationFrame(() => {
        if (!target.isConnected || target.closest('[inert]')) return;
        target.focus({ preventScroll: true });
      });
    }
  }
}

const HORIZONTAL_SWIPE_MIN_DISTANCE = 48;
const HORIZONTAL_SWIPE_AXIS_RATIO = 1.2;
const DIRECTIONAL_DRAG_MIN_DISTANCE = 8;
const DIRECTIONAL_DRAG_AXIS_RATIO = 1.15;
const PULL_DISMISS_DISTANCE = 100;
const PULL_DISMISS_VELOCITY = 0.5; // px/ms
const PULL_DISMISS_MIN_FLING_DISTANCE = 24;
const PULL_START_EXCLUSION = '[data-bottom-sheet-no-pull-dismiss], [data-bottom-sheet-drag-handle], [data-bottom-sheet-directional-drag-handle], input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="slider"], [role="spinbutton"], [data-diary-drag-source]';
// #9: hoisted so React sees a stable reference and skips re-diffing the style prop.
const SHEET_SURFACE_STYLE: React.CSSProperties = { contain: 'paint' };

type HorizontalSwipeStart = {
  pointerId: number;
  x: number;
  y: number;
};

type TouchSwipeStart = {
  identifier: number;
  x: number;
  y: number;
};

type PullTouchStart = TouchSwipeStart & {
  time: number;
  dragging: boolean;
  scrollParents: HTMLElement[];
};

/** Snapshot all scroll owners at touchstart: never convert an in-progress scroll to dismissal. */
function findVerticalScrollParents(target: Element, sheet: HTMLElement): HTMLElement[] {
  const owners: HTMLElement[] = [];
  for (let node: Element | null = target; node; node = node.parentElement) {
    if (node instanceof HTMLElement && node.scrollHeight > node.clientHeight + 2) {
      const overflow = window.getComputedStyle(node).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') owners.push(node);
    }
    if (node === sheet) break;
  }
  return owners;
}

function readHistoryGuardToken(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    return null;
  }
  const value = (state as Record<string, unknown>)[HISTORY_GUARD_KEY];
  return typeof value === 'string' ? value : null;
}

function getCurrentHistoryState(): Record<string, unknown> {
  if (
    typeof window.history.state === 'object' &&
    window.history.state !== null &&
    !Array.isArray(window.history.state)
  ) {
    return window.history.state as Record<string, unknown>;
  }
  return {};
}

function pushSheetHistory(entry: SheetStackEntry): void {
  const currentState = getCurrentHistoryState();
  window.history.pushState(
    { ...currentState, [HISTORY_GUARD_KEY]: entry.historyId },
    '',
    window.location.href
  );
  issuedHistoryIds.add(entry.historyId);
}

function cancelPendingCleanup(sheetId: string): void {
  const timer = pendingCleanupTimers.get(sheetId);
  if (timer === undefined) return;
  window.clearTimeout(timer);
  pendingCleanupTimers.delete(sheetId);
}

function registerSheet(
  sheetId: string,
  onClose: () => void,
  preventDismiss: () => boolean,
  onTransientDismiss: () => boolean
): void {
  cancelPendingCleanup(sheetId);

  const existing = sheetStack.find((sheet) => sheet.id === sheetId);
  if (existing) {
    existing.onClose = onClose;
    existing.preventDismiss = preventDismiss;
    existing.onTransientDismiss = onTransientDismiss;
    return;
  }

  const entry: SheetStackEntry = {
    id: sheetId,
    historyId: `mosaic-sheet-${++historyGuardSequence}`,
    onClose,
    preventDismiss,
    onTransientDismiss,
  };
  sheetStack.push(entry);
  pushSheetHistory(entry);
}

function scheduleSheetCleanup(sheetId: string): void {
  cancelPendingCleanup(sheetId);
  const timer = window.setTimeout(() => {
    pendingCleanupTimers.delete(sheetId);
    const index = sheetStack.findIndex((sheet) => sheet.id === sheetId);
    if (index < 0) return;

    const [entry] = sheetStack.splice(index, 1);
    if (
      entry &&
      readHistoryGuardToken(window.history.state) === entry.historyId
    ) {
      // Programmatic closes (save buttons, parent state changes, etc.) must
      // consume the sheet's browser-history slot too. Popstate then lands on
      // the next active sheet guard or the underlying route state.
      window.history.back();
    }
  }, 0);
  pendingCleanupTimers.set(sheetId, timer);
}

function handleBottomSheetPopState(event: PopStateEvent): void {
  const targetHistoryId = readHistoryGuardToken(event.state);
  const top = sheetStack[sheetStack.length - 1];

  if (top?.preventDismiss()) {
    // Browser Back has already moved below this sheet's guard. Re-arm the
    // same guard so processing/non-dismissible sheets remain the active layer.
    // pushState replaces the just-created forward path rather than adding
    // unbounded history entries across repeated Back presses.
    if (targetHistoryId !== top.historyId) {
      pushSheetHistory(top);
    }
    return;
  }

  if (top?.onTransientDismiss()) {
    // Back already consumed this sheet's guard. Restore it so the next Back
    // dismisses the still-open sheet after its transient mode has exited.
    pushSheetHistory(top);
    return;
  }

  if (sheetStack.length === 0) {
    // If a programmatic close retired a sheet while an older sheet-history
    // entry remained behind it, skip that inert entry instead of making Back
    // appear to do nothing or trapping Forward on a dead modal state.
    if (targetHistoryId && issuedHistoryIds.has(targetHistoryId)) {
      window.history.back();
    }
    return;
  }

  const targetIndex = targetHistoryId
    ? sheetStack.findIndex((sheet) => sheet.historyId === targetHistoryId)
    : -1;

  if (
    targetHistoryId &&
    targetIndex < 0 &&
    issuedHistoryIds.has(targetHistoryId)
  ) {
    // This is a stale history slot for a sheet that was closed
    // programmatically while another sheet remained. Keep traversing through
    // sheet-only history until reaching an active guard or the real route.
    window.history.back();
    return;
  }

  // The browser has already moved to the target history entry. Close every
  // sheet above that target; a route/base entry has no guard and therefore
  // closes the whole active modal stack. No pushState occurs during popstate,
  // which avoids the Samsung/PWA race seen with re-arming one shared guard.
  const firstClosingIndex = targetIndex + 1;
  if (firstClosingIndex >= sheetStack.length) return;

  const closingEntries = sheetStack.splice(firstClosingIndex);
  for (let index = closingEntries.length - 1; index >= 0; index -= 1) {
    closingEntries[index]?.onClose();
  }
}

function ensureHistoryBackHandler(): void {
  if (historyBackHandlerInstalled || typeof window === 'undefined') return;
  window.addEventListener('popstate', handleBottomSheetPopState);
  historyBackHandlerInstalled = true;
}

function requestSheetClose(sheetId: string, allowTransientDismiss = false): void {
  const entry = sheetStack.find((sheet) => sheet.id === sheetId);
  if (!entry || entry.preventDismiss()) return;
  if (allowTransientDismiss && entry.onTransientDismiss()) return;

  const top = sheetStack[sheetStack.length - 1];
  if (
    top?.id === sheetId &&
    readHistoryGuardToken(window.history.state) === entry.historyId
  ) {
    // Drive visible dismissals through browser history so pointer, Escape,
    // Android Back, and programmatic cleanup all agree on the active layer.
    window.history.back();
    return;
  }

  entry.onClose();
}

function SheetPresenceSurface({
  sheetRef,
  onAnimationComplete,
  isBehind,
  children,
  ...outerProps
}: React.ComponentProps<typeof motion.div> & {
  sheetRef: React.RefObject<HTMLDivElement | null>;
  onAnimationComplete?: () => void;
  isBehind: boolean;
}) {
  const [isPresent, safeToRemove] = usePresence();

  return (
    <motion.div
      ref={sheetRef}
      {...outerProps}
      // Shared y MotionValue for entrance, dismissal, and live touch drag.
      // A full transform-string animation would mask Framer's drag offset.
      initial={{ y: '100%' }}
      animate={{ y: isPresent ? 0 : '100%', scale: isPresent && isBehind ? 0.985 : 1 }}
      transition={{
        duration: document.documentElement.dataset.reduceMotion === 'true' ||
          systemRequestsReducedMotion() ? 0 : 0.32,
        ease: [0.32, 0.72, 0, 1],
        // Finish parent-scale restoration before the upper portal exits, not
        // in a second visible settle after the top sheet disappears.
        scale: {
          duration: document.documentElement.dataset.reduceMotion === 'true' ||
            systemRequestsReducedMotion() ? 0 : 0.24,
          ease: [0.32, 0.72, 0, 1],
        },
      }}
      onAnimationComplete={() => {
        onAnimationComplete?.();
        if (!isPresent) safeToRemove?.();
      }}
      role="dialog"
      aria-modal="true"
    >
      {children}
    </motion.div>
  );
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  title,
  ariaLabel,
  height = 'auto',
  isLocked = false,
  preventDismiss = false,
  suspendInteraction = false,
  backdropBlur = false,
  scaleBehind = true,
  contentMode = 'scroll',
  onHorizontalSwipe,
  onAnimationComplete,
  onExitComplete,
  deferChildrenUntilPaint = false,
  onTransientDismiss,
  pullDownToDismiss = true,
}) => {
  const appearance = useContext(AppearanceContext);
  const sheetWidthMode = appearance?.sheetWidthMode ?? 'full';
  const sheetRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const preventDismissRef = useRef(preventDismiss);
  const onTransientDismissRef = useRef(onTransientDismiss);
  const horizontalSwipeStartRef = useRef<HorizontalSwipeStart | null>(null);
  const directionalDragStartRef = useRef<HorizontalSwipeStart | null>(null);
  const directionalTouchStartRef = useRef<TouchSwipeStart | null>(null);
  const pullTouchRef = useRef<PullTouchStart | null>(null);
  // Framer's header drag and content touch drag share one position value.
  const sheetOffsetY = useMotionValue(0);
  const dragControls = useDragControls();
  const sheetId = React.useId();
  const titleId = React.useId();
  // useDeferredValue does not postpone the first mount of an already-open
  // sheet: its initial value is immediately true. Prepare the portal's light
  // drag/backdrop shell first, then commit expensive children after a paint.
  const [deferredChildrenReady, setDeferredChildrenReady] = useState(!deferChildrenUntilPaint);
  useEffect(() => {
    if (!isOpen || !deferChildrenUntilPaint || deferredChildrenReady) return;

    let nextFrame: number | null = null;
    const firstFrame = window.requestAnimationFrame(() => {
      // Two frames ensure the shell gets a paint opportunity before mounting
      // the Day View swiper, task rows, and drag/drop runtime.
      nextFrame = window.requestAnimationFrame(() => setDeferredChildrenReady(true));
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (nextFrame !== null) window.cancelAnimationFrame(nextFrame);
    };
  }, [isOpen, deferChildrenUntilPaint, deferredChildrenReady]);
  const [childrenMounted, setChildrenMounted] = useState(isOpen);
  // Most sheets mount closed. Arm presence synchronously when an open
  // arrives, so a subsequent Back or drag can animate instead of returning null.
  // Guarding on childrenMounted ensures at most one extra render per open.
  if (isOpen && !childrenMounted) {
    setChildrenMounted(true);
  }
  // Once shown, retain content through the exit animation and subsequent
  // opens. If dismissed before frame two, no expensive child ever mounts.
  const shouldRenderChildren =
    (isOpen || childrenMounted) && (!deferChildrenUntilPaint || deferredChildrenReady);

  useLayoutEffect(() => {
    onCloseRef.current = onClose;
    preventDismissRef.current = preventDismiss;
    onTransientDismissRef.current = onTransientDismiss;
  }, [onClose, onTransientDismiss, preventDismiss]);

  const topVisibleSheetId = useSyncExternalStore(
    subscribeSheetLayers,
    currentTopVisibleSheet,
    () => null
  );
  const topOpenSheetId = useSyncExternalStore(
    subscribeSheetLayers,
    currentTopOpenSheet,
    () => null
  );
  const isTopLayer = topVisibleSheetId === sheetId;
  // Keep exiting portals on top for Back/focus/pointer safety. For visual
  // scaling only, ignore sheets already closing so restoration overlaps exit.
  const layerIndex = visibleSheetIds.indexOf(sheetId);
  const layerDepth = Math.max(0, layerIndex);
  const isBehindLayer = layerIndex >= 0 && topOpenSheetId !== null && topOpenSheetId !== sheetId;
  const isBlockedLayer = suspendInteraction || !isTopLayer;

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || !isOpen || !pullDownToDismiss || isLocked || preventDismiss || isBlockedLayer) return;
    const settle = () => {
      const start = pullTouchRef.current;
      pullTouchRef.current = null;
      if (start?.dragging) animate(sheetOffsetY, 0, { type: 'spring', stiffness: 450, damping: 38 });
    };
    const onStart = (event: TouchEvent) => {
      pullTouchRef.current = null;
      if (event.touches.length !== 1) return;
      const target = event.target;
      if (!(target instanceof Element) || target.closest(PULL_START_EXCLUSION)) return;
      const touch = event.touches[0];
      const scrollParents = findVerticalScrollParents(target, sheet);
      if (scrollParents.some(parent => parent.scrollTop > 1)) return;
      pullTouchRef.current = {
        identifier: touch.identifier, x: touch.clientX, y: touch.clientY,
        time: performance.now(), dragging: false, scrollParents,
      };
    };
    const onMove = (event: TouchEvent) => {
      const start = pullTouchRef.current;
      if (!start) return;
      if (event.touches.length !== 1) { settle(); return; }
      const touch = event.touches[0];
      if (touch.identifier !== start.identifier) { settle(); return; }
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (!start.dragging) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < DIRECTIONAL_DRAG_MIN_DISTANCE) return;
        // Horizontal navigation and upward scrolling retain their native owners.
        if (dy <= 0 || dy <= Math.abs(dx) * DIRECTIONAL_DRAG_AXIS_RATIO ||
            start.scrollParents.some(parent => parent.scrollTop > 1)) {
          pullTouchRef.current = null;
          return;
        }
        start.dragging = true;
      }
      // React's delegated touchmove is passive in modern browsers; this native
      // non-passive listener prevents scroll only after a downward axis lock.
      if (event.cancelable) event.preventDefault();
      sheetOffsetY.set(Math.max(0, dy));
    };
    const onEnd = (event: TouchEvent) => {
      const start = pullTouchRef.current;
      if (!start) return;
      const touch = Array.from(event.changedTouches).find(candidate => candidate.identifier === start.identifier);
      if (!touch) return;
      pullTouchRef.current = null;
      if (!start.dragging) return;
      const distance = Math.max(0, touch.clientY - start.y);
      const velocity = distance / Math.max(1, performance.now() - start.time);
      if (distance >= PULL_DISMISS_DISTANCE ||
          (distance >= PULL_DISMISS_MIN_FLING_DISTANCE && velocity >= PULL_DISMISS_VELOCITY)) {
        requestSheetClose(sheetId);
      } else {
        animate(sheetOffsetY, 0, { type: 'spring', stiffness: 450, damping: 38 });
      }
    };
    sheet.addEventListener('touchstart', onStart, { capture: true, passive: true });
    sheet.addEventListener('touchmove', onMove, { capture: true, passive: false });
    sheet.addEventListener('touchend', onEnd, true);
    sheet.addEventListener('touchcancel', settle, true);
    return () => {
      sheet.removeEventListener('touchstart', onStart, true);
      sheet.removeEventListener('touchmove', onMove, true);
      sheet.removeEventListener('touchend', onEnd, true);
      sheet.removeEventListener('touchcancel', settle, true);
      pullTouchRef.current = null;
    };
  }, [isOpen, pullDownToDismiss, isLocked, preventDismiss, isBlockedLayer, sheetId, sheetOffsetY]);

  useFocusTrap(
    sheetRef,
    isOpen && !isBlockedLayer && shouldRenderChildren,
    () => !isOpen || isTopLayer,
    (target) => queueFocusReturn(sheetId, target)
  );

  useEffect(() => {
    updateVisibleSheet(sheetId, isOpen || childrenMounted);
    updateOpenSheet(sheetId, isOpen);
  }, [childrenMounted, isOpen, sheetId]);

  // Covers a genuine parent unmount before Framer can signal exit completion.
  useEffect(() => () => {
    updateOpenSheet(sheetId, false);
    updateVisibleSheet(sheetId, false);
  }, [sheetId]);

  useEffect(() => {
    if (!isOpen && !childrenMounted) return;
    openSheetCount++;
    document.body.style.overflow = 'hidden';
    return () => {
      openSheetCount = Math.max(0, openSheetCount - 1);
      if (openSheetCount === 0) {
        document.body.style.overflow = 'unset';
      }
    };
  }, [childrenMounted, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    ensureHistoryBackHandler();
    registerSheet(
      sheetId,
      () => onCloseRef.current(),
      () => preventDismissRef.current,
      () => onTransientDismissRef.current?.() ?? false
    );

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const top = sheetStack[sheetStack.length - 1];
      if (top?.id === sheetId) {
        requestSheetClose(sheetId, true);
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
      // Delay removal by one task. React StrictMode intentionally runs an
      // effect setup→cleanup→setup probe; the second setup cancels this timer,
      // preserving exactly one history entry for the real mounted sheet.
      scheduleSheetCleanup(sheetId);
    };
  }, [isOpen, sheetId]);

  const heightClass =
    height === 'full'
      ? 'h-[92dvh] md:h-[100dvh] rounded-t-3xl'
      : 'max-h-[90vh] rounded-t-3xl';
  const widthClass =
    sheetWidthMode === 'compact'
      ? 'md:left-1/2 md:right-auto md:w-[min(540px,calc(100vw-2rem))] md:[translate:-50%_0]'
      : '';
  const contentClass =
    contentMode === 'fixed'
      ? 'flex-1 min-h-0 px-4'
      : 'flex-1 overflow-y-auto px-4 pb-8 overscroll-contain';

  // #14: skip building the portal tree entirely once the sheet is fully
  // gone. We still render while `childrenMounted` is true so AnimatePresence
  // can play the exit animation.
  if (!isOpen && !childrenMounted) {
    return null;
  }

  const sheetContent = (
    <>
      <AnimatePresence>
        {isOpen && (
          // #8: keyed, no wrapper fragment — AnimatePresence tracks direct
          // motion children.
          <motion.div
            key="backdrop"
            style={{ zIndex: 50 + layerDepth * 20 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={
              isBlockedLayer || preventDismiss
                ? undefined
                : () => requestSheetClose(sheetId)
            }
            aria-hidden="true"
            className={`fixed inset-0 ${layerIndex > 0 ? 'bg-black/35' : 'bg-black/60'} ${backdropBlur ? 'backdrop-blur-sm' : ''} ${isBlockedLayer ? 'pointer-events-none' : ''}`}
          />
        )}
      </AnimatePresence>
      <AnimatePresence onExitComplete={() => {
        if (!isOpen) {
          setChildrenMounted(false);
          onExitComplete?.();
        }
      }}>
        {isOpen && (
          <SheetPresenceSurface
            key="sheet"
            sheetRef={sheetRef}
            isBehind={scaleBehind && isBehindLayer}
            aria-hidden={isBlockedLayer ? true : undefined}
            inert={isBlockedLayer || !isOpen ? true : undefined}
            aria-labelledby={title ? titleId : undefined}
            aria-label={!title ? ariaLabel : undefined}
            onAnimationComplete={() => {
              onAnimationComplete?.();
              if (!isOpen) {
                setChildrenMounted(false);
              }
            }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            dragSnapToOrigin
            onPointerDownCapture={(event) => {
              if (isLocked) return;
              const target = event.target as Element;
              const dragHandle = target.closest('[data-bottom-sheet-drag-handle]');
              const directionalDragHandle = target.closest(
                '[data-bottom-sheet-directional-drag-handle]'
              );
              const nativeHorizontalSwipe = target.closest(
                '[data-bottom-sheet-native-horizontal-swipe]'
              );
              const start = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
              };

              // Native horizontal surfaces (Swiper/Embla) must own the pointer
              // from pointer-down so their content can follow the finger.
              horizontalSwipeStartRef.current =
                onHorizontalSwipe && !nativeHorizontalSwipe ? start : null;
              directionalDragStartRef.current = directionalDragHandle
                ? start
                : null;

              if (dragHandle && !directionalDragHandle) {
                dragControls.start(event);
              }
            }}
            onPointerMoveCapture={(event) => {
              const start = directionalDragStartRef.current;
              if (!start || start.pointerId !== event.pointerId || isLocked) {
                return;
              }

              const deltaX = event.clientX - start.x;
              const deltaY = event.clientY - start.y;
              const distanceX = Math.abs(deltaX);
              const distanceY = Math.abs(deltaY);
              if (
                Math.max(distanceX, distanceY) < DIRECTIONAL_DRAG_MIN_DISTANCE
              ) {
                return;
              }

              if (distanceX > distanceY * DIRECTIONAL_DRAG_AXIS_RATIO) {
                // Horizontal intent stays with the nested native carousel.
                directionalDragStartRef.current = null;
                return;
              }

              if (distanceY > distanceX * DIRECTIONAL_DRAG_AXIS_RATIO) {
                // Touch keeps native carousel ownership until release so
                // horizontal movement remains direct-manipulation. Mouse/pen
                // can hand the clearly vertical gesture to Framer immediately.
                if (event.pointerType !== 'touch') {
                  directionalDragStartRef.current = null;
                  dragControls.start(event);
                }
              }
            }}
            onPointerUpCapture={(event) => {
              directionalDragStartRef.current = null;
              const start = horizontalSwipeStartRef.current;
              horizontalSwipeStartRef.current = null;
              if (
                isLocked ||
                !onHorizontalSwipe ||
                !start ||
                start.pointerId !== event.pointerId
              ) {
                return;
              }

              const deltaX = event.clientX - start.x;
              const deltaY = event.clientY - start.y;
              const distanceX = Math.abs(deltaX);
              const distanceY = Math.abs(deltaY);
              if (
                distanceX < HORIZONTAL_SWIPE_MIN_DISTANCE ||
                distanceX <= distanceY * HORIZONTAL_SWIPE_AXIS_RATIO
              ) {
                return;
              }

              onHorizontalSwipe(deltaX < 0 ? 'left' : 'right');
            }}
            onPointerCancelCapture={() => {
              horizontalSwipeStartRef.current = null;
              directionalDragStartRef.current = null;
            }}
            onTouchStartCapture={(event) => {
              if (isLocked) return;
              const target = event.target as Element;
              if (
                !target.closest('[data-bottom-sheet-directional-drag-handle]')
              ) {
                directionalTouchStartRef.current = null;
                return;
              }
              const touch = event.changedTouches[0];
              directionalTouchStartRef.current = touch
                ? {
                    identifier: touch.identifier,
                    x: touch.clientX,
                    y: touch.clientY,
                  }
                : null;
            }}
            onTouchEndCapture={(event) => {
              const start = directionalTouchStartRef.current;
              directionalTouchStartRef.current = null;
              if (isLocked || !start) return;

              const touch = Array.from(event.changedTouches).find(
                (candidate) => candidate.identifier === start.identifier
              );
              if (!touch) return;

              const deltaX = touch.clientX - start.x;
              const deltaY = touch.clientY - start.y;
              if (
                deltaY > 100 &&
                deltaY > Math.abs(deltaX) * DIRECTIONAL_DRAG_AXIS_RATIO
              ) {
                requestSheetClose(sheetId);
              }
            }}
            onTouchCancelCapture={() => {
              directionalTouchStartRef.current = null;
            }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                requestSheetClose(sheetId);
              }
            }}
            style={{ ...SHEET_SURFACE_STYLE, y: sheetOffsetY, zIndex: 60 + layerDepth * 20, transformOrigin: 'bottom center' }}
            className={`mosaic-bottom-sheet fixed bottom-0 left-0 right-0 bg-surface text-white shadow-2xl border flex flex-col overflow-hidden ${layerIndex > 0 ? 'border-[var(--mosaic-border-strong)] shadow-[0_-12px_30px_rgba(0,0,0,0.28)]' : 'border-[var(--mosaic-border)]'} ${heightClass} ${widthClass} ${isBlockedLayer ? 'pointer-events-none select-none' : ''}`}
          >
            <div
              data-bottom-sheet-drag-handle="true"
              className={`flex-shrink-0 pt-3 pb-2 px-4 flex flex-col items-center transition-all duration-300 ${
                isLocked
                  ? 'cursor-default opacity-50 blur-sm pointer-events-none'
                  : 'cursor-grab active:cursor-grabbing touch-none'
              }`}
              onPointerDown={(event) => {
                if (!isLocked) {
                  dragControls.start(event);
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
                  className="mosaic-sheet-heading text-lg font-semibold w-full text-center"
                >
                  {title}
                </h3>
              )}
            </div>
            <div className={contentClass}>
              {shouldRenderChildren ? children : null}
            </div>
          </SheetPresenceSurface>
        )}
      </AnimatePresence>
    </>
  );

  return ReactDOM.createPortal(sheetContent, document.body);
};
