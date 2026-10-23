import React from 'react';
import { LayoutGroup, motion, Reorder, useDragControls } from 'framer-motion';
import type { CategoryDocument } from '../../../db/schema';
import type { CategoryPillActions } from './CategorySection';
import { CategoryPillActionContext } from './categoryPillActionContext';
import { moveCategoryId, sameCategoryIds } from '../../../lib/categoryReorder';

const HOLD_MS = 500;
const TOLERANCE_PX = 8;

interface ReorderProps {
  categories: CategoryDocument[];
  enabled: boolean;
  /** Layout-only projection while carrying a task between dates. */
  animateExternal?: boolean;
  canStartDrag: boolean;
  onCommit: (categories: CategoryDocument[]) => Promise<void>;
  onUpdate: (id: string, changes: Pick<CategoryDocument, 'name' | 'visibility' | 'color'>) => Promise<void>;
  onDragActiveChange?: (active: boolean) => void;
  onError?: (message: string) => void;
  renderCategory: (category: CategoryDocument) => React.ReactNode;
}

interface DragRowProps {
  category: CategoryDocument;
  index: number;
  total: number;
  canStartDrag: boolean;
  onDragActiveChange?: (active: boolean) => void;
  onDrop: () => void;
  onMove: (id: string, delta: -1 | 1) => void;
  onUpdate: ReorderProps['onUpdate'];
  children: React.ReactNode;
}

const DraggableCategoryRow: React.FC<DragRowProps> = ({
  category, index, total, canStartDrag, onDragActiveChange,
  onDrop, onMove, onUpdate, children,
}) => {
  const controls = useDragControls();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const suppressClick = React.useRef(false);
  const dragStarted = React.useRef(false);
  const pressCleanup = React.useRef<(() => void) | null>(null);
  const activeChangeRef = React.useRef(onDragActiveChange);
  React.useEffect(() => {
    activeChangeRef.current = onDragActiveChange;
  }, [onDragActiveChange]);

  React.useEffect(() => () => {
    pressCleanup.current?.();
    if (dragStarted.current) activeChangeRef.current?.(false);
  }, []);

  const onPointerDown: CategoryPillActions['onPointerDown'] = (event) => {
    if (!canStartDrag || event.button !== 0 || event.isPrimary === false) return;
    const touch = event.pointerType === 'touch';
    const fromLabel = event.target instanceof Element &&
      Boolean(event.target.closest('[data-category-drag-handle]'));
    const originalDown = event.nativeEvent;

    pressCleanup.current?.();
    suppressClick.current = false;
    setMenuOpen(false);

    const state = {
      pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      held: false, timer: 0,
    };
    const cleanup = () => {
      window.clearTimeout(state.timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      if (pressCleanup.current === cleanup) pressCleanup.current = null;
    };
    const move = (next: PointerEvent) => {
      if (next.pointerId !== state.pointerId) return;
      if (!state.held &&
          Math.hypot(next.clientX - state.x, next.clientY - state.y) >= TOLERANCE_PX) {
        // An early swipe belongs to the page, not a category. Cancel
        // Motion's armed touch PanSession before it sees this movement.
        // Our move listener was registered before controls.start().
        if (touch && fromLabel && !dragStarted.current) controls.cancel();
        cleanup();
      }
    };
    const finish = (next: PointerEvent) => {
      if (next.pointerId !== state.pointerId) return;
      cleanup();
      if (touch && fromLabel && !dragStarted.current) controls.cancel();
      if (state.held) suppressClick.current = true;
    };
    const cancel = (next: PointerEvent) => {
      if (next.pointerId !== state.pointerId) return;
      cleanup();
      if (touch && fromLabel && !dragStarted.current) controls.cancel();
      // iOS can cancel the pointer after its native contextmenu event.
      // Preserve a menu intentionally opened by our hold or contextmenu.
      if (!state.held && !suppressClick.current) setMenuOpen(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    pressCleanup.current = cleanup;

    if (fromLabel) {
      // Motion must register the *live* pointerdown for both mouse and touch.
      // Deferring start() until after a long press worked in Chromium emulation,
      // but iOS/Android can select text or cancel the pointer in the meantime.
      // An early touch move explicitly cancels the still-unstarted drag above.
      controls.start(originalDown, { distanceThreshold: TOLERANCE_PX });
    }
    state.timer = window.setTimeout(() => {
      if (pressCleanup.current !== cleanup || dragStarted.current) return;
      state.held = true;
      suppressClick.current = true;
      setMenuOpen(true);
    }, HOLD_MS);
  };

  const actions: CategoryPillActions = {
    onPointerDown,
    consumeClick: (event) => {
      if (!suppressClick.current) return;
      event.preventDefault();
      event.stopPropagation();
      suppressClick.current = false;
    },
    onContextMenu: (event) => {
      if (!canStartDrag) return;
      event.preventDefault();
      suppressClick.current = true;
      setMenuOpen(true);
    },
    menuOpen,
    setMenuOpen,
    moveUp: index > 0 ? () => onMove(category.id, -1) : undefined,
    moveDown: index < total - 1 ? () => onMove(category.id, 1) : undefined,
    update: (changes) => onUpdate(category.id, changes),
  };

  return (
    <Reorder.Item
      data-panel-reorder-row="true"
      as="div"
      value={category.id}
      dragListener={false}
      dragControls={controls}
      className="relative"
      onDragStart={() => {
        pressCleanup.current?.();
        dragStarted.current = true;
        setMenuOpen(false);
        suppressClick.current = true;
        onDragActiveChange?.(true);
      }}
      onDragEnd={() => {
        dragStarted.current = false;
        onDragActiveChange?.(false);
        onDrop();
      }}
    >
      <CategoryPillActionContext.Provider value={actions}>{children}</CategoryPillActionContext.Provider>
    </Reorder.Item>
  );
};

/**
 * This layer owns only global category ordering. Task placement, category
 * membership and the existing task/diary drag provider remain untouched.
 */
export const DayViewCategoryReorder: React.FC<ReorderProps> = ({
  categories, enabled, animateExternal = false, canStartDrag, onCommit, onUpdate,
  onDragActiveChange, onError, renderCategory,
}) => {
  const [orderedIds, setOrderedIds] = React.useState(() => categories.map(c => c.id));
  const pendingIds = React.useRef(orderedIds);
  const persisting = React.useRef(false);
  const pendingWrites = React.useRef(0);
  const latestCategoryIds = React.useRef(categories.map(c => c.id));
  const dragging = React.useRef(false);
  React.useEffect(() => {
    const incomingIds = categories.map(c => c.id);
    latestCategoryIds.current = incomingIds;
    if (!sameCategoryIds(incomingIds, pendingIds.current)) {
      pendingIds.current = incomingIds;
      persisting.current = pendingWrites.current > 0;
      setOrderedIds(incomingIds);
    } else if (sameCategoryIds(incomingIds, pendingIds.current, true)) {
      if (pendingWrites.current === 0) persisting.current = false;
      if (!dragging.current) setOrderedIds(incomingIds);
    } else if (!persisting.current && !dragging.current) {
      pendingIds.current = incomingIds;
      setOrderedIds(incomingIds);
    }
  }, [categories]); // CategoryDocument changes only when its RxDB query changes.

  const orderedCategories = orderedIds
    .map(id => categories.find(category => category.id === id))
    .filter((category): category is CategoryDocument => Boolean(category));
  const commit = React.useCallback(async (ids: string[]) => {
    // A user may reverse a pending reorder before the first write settles.
    // Even if the desired order equals the old props, it must be queued.
    if (sameCategoryIds(ids, categories.map(c => c.id), true) &&
        pendingWrites.current === 0) return;
    pendingWrites.current += 1;
    persisting.current = true;
    try {
      const byId = new Map(categories.map(c => [c.id, c]));
      const next = ids.map(id => byId.get(id));
      if (next.length !== categories.length || next.some(c => !c)) {
        throw new Error('Categories changed during reordering');
      }
      await onCommit(next as CategoryDocument[]);
    } catch (error) {
      // A failed older write must never undo a newer drag / keyboard move.
      if (sameCategoryIds(ids, pendingIds.current, true)) {
        const original = latestCategoryIds.current;
        pendingIds.current = original;
        setOrderedIds(original);
      }
      onError?.(error instanceof Error ? error.message : 'Could not reorder categories');
    } finally {
      pendingWrites.current -= 1;
      if (pendingWrites.current === 0 &&
          sameCategoryIds(latestCategoryIds.current, pendingIds.current, true)) {
        persisting.current = false;
      }
    }
  }, [categories, onCommit, onError]);
  const move = React.useCallback((id: string, delta: -1 | 1) => {
    const next = moveCategoryId(pendingIds.current, id, delta);
    if (sameCategoryIds(next, pendingIds.current, true)) return;
    pendingIds.current = next;
    setOrderedIds(next);
    void commit(next);
  }, [commit]);

  if (!enabled) {
    if (!animateExternal) {
      return <>{categories.map(category =>
        <React.Fragment key={category.id}>{renderCategory(category)}</React.Fragment>
      )}</>;
    }
    // Normal task sorting uses Reorder.Item around every category. The
    // cross-day projection used to drop that entire layout layer, leaving
    // category movement visually abrupt. Keep equivalent position-layout
    // ownership without enabling category *dragging* during a held task.
    return (
      <LayoutGroup>
        <div>
          {categories.map(category => (
            <motion.div key={category.id} layout="position" className="relative"
              transition={{ layout: { duration: 0.2, ease: 'easeOut' } }}>
              {renderCategory(category)}
            </motion.div>
          ))}
        </div>
      </LayoutGroup>
    );
  }

  return (
    <Reorder.Group
      as="div"
      axis="y"
      values={orderedIds}
      onReorder={(ids: string[]) => {
        pendingIds.current = ids;
        setOrderedIds(ids);
      }}
    >
      {orderedCategories.map((category, index) => (
        <DraggableCategoryRow
          key={category.id}
          category={category}
          index={index}
          total={orderedCategories.length}
          canStartDrag={canStartDrag}
          onDragActiveChange={(active) => {
            dragging.current = active;
            onDragActiveChange?.(active);
          }}
          onDrop={() => { void commit(pendingIds.current); }}
          onMove={move}
          onUpdate={onUpdate}
        >
          {renderCategory(category)}
        </DraggableCategoryRow>
      ))}
    </Reorder.Group>
  );
};
