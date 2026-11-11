/** Dynamically loaded only when gesture shortcuts are enabled.
 * All pointer/touch tracking stays outside React render state. */
export interface ShortcutGestureOptions {
  enabled: boolean;
  direction: 'up' | 'down';
  boundary?: 'top' | 'bottom';
  onTrigger: () => void;
  scrollOwner?: (target: Element, surface: HTMLElement) => HTMLElement | null;
  exclude?: string;
}

type Start = {
  identifier: number;
  x: number;
  y: number;
  scroll: HTMLElement | null;
  invalid: boolean;
};

export interface ShortcutGestureEngine {
  start: (id: number, x: number, y: number, target: EventTarget | null, surface: HTMLElement) => boolean;
  move: (id: number) => void;
  finish: (id: number, x: number, y: number) => void;
  cancel: () => void;
  suppressClick: () => boolean;
}

const INPUT_EXCLUSIONS =
  'input, textarea, select, [contenteditable], [role="textbox"], [role="slider"], ' +
  '[data-bottom-sheet-drag-handle], [data-bottom-sheet-directional-drag-handle], ' +
  '[data-diary-drag-source], [data-calendar-zoom-lane], [data-category-drag-handle]';
const SCROLL_EPSILON = 2;
const MIN_SWIPE_DISTANCE = 72;
const DIRECTION_RATIO = 1.35;

export function createShortcutGestureEngine(getOptions: () => ShortcutGestureOptions): ShortcutGestureEngine {
  let session: Start | null = null;
  let suppressClickUntil = 0;

  const atBoundary = (scroll: HTMLElement | null) => {
    const options = getOptions();
    if (!scroll || !options.boundary) return true;
    const max = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
    return options.boundary === 'top'
      ? scroll.scrollTop <= SCROLL_EPSILON
      : scroll.scrollTop >= max - SCROLL_EPSILON;
  };

  const hasNestedVerticalOwner = (target: Element, owner: HTMLElement): boolean => {
    for (let node: Element | null = target; node && node !== owner; node = node.parentElement) {
      if (!(node instanceof HTMLElement) || node.scrollHeight - node.clientHeight <= SCROLL_EPSILON) continue;
      const overflow = window.getComputedStyle(node).overflowY;
      if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') return true;
    }
    return false;
  };

  return {
    start(id, x, y, target, surface) {
      suppressClickUntil = 0;
      session = null;
      const options = getOptions();
      if (!options.enabled || !(target instanceof Element) || target.closest(INPUT_EXCLUSIONS) ||
          (options.exclude && target.closest(options.exclude))) return false;
      // Nested controls own their gestures, apart from the tab button itself.
      const interactive = target.closest('button, a[href], [role="button"]');
      if (interactive && interactive !== surface) return false;
      const scroll = options.scrollOwner ? options.scrollOwner(target, surface)
        : (options.boundary ? surface : null);
      if (options.boundary && (!scroll || !scroll.contains(target) ||
          hasNestedVerticalOwner(target, scroll) || !atBoundary(scroll))) return false;
      session = { identifier: id, x, y, scroll, invalid: false };
      return true;
    },
    move(id) {
      if (session && session.identifier === id && !atBoundary(session.scroll)) session.invalid = true;
    },
    finish(id, x, y) {
      const state = session;
      session = null;
      const options = getOptions();
      if (!options.enabled || !state || state.identifier !== id || state.invalid ||
          (state.scroll !== null && !state.scroll.isConnected) || !atBoundary(state.scroll)) return;
      const dx = x - state.x;
      const dy = y - state.y;
      const along = options.direction === 'up' ? -dy : dy;
      if (along < MIN_SWIPE_DISTANCE || along < Math.abs(dx) * DIRECTION_RATIO) return;
      suppressClickUntil = Date.now() + 500;
      options.onTrigger();
    },
    cancel() { session = null; },
    suppressClick() {
      if (Date.now() > suppressClickUntil) return false;
      suppressClickUntil = 0;
      return true;
    },
  };
}
