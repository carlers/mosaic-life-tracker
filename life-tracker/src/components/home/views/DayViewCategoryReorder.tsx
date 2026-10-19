import React from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import type { CategoryDocument } from '../../../db/schema';
import type { CategoryPillActions } from './CategorySection';
import { moveCategoryId, sameCategoryIds } from '../../../lib/categoryReorder';

const HOLD_MS = 500;
const TOLERANCE_PX = 8;

interface ReorderProps {
  categories: CategoryDocument[];
  enabled: boolean;
  canStartDrag: boolean;
  onCommit: (categories: CategoryDocument[]) => Promise<void>;
  onUpdate: (id: string, changes: Pick<CategoryDocument, 'name' | 'visibility'>) => Promise<void>;
  onDragActiveChange?: (active: boolean) => void;
  onError?: (message: string) => void;
  renderCategory: (category: CategoryDocument, actions?: CategoryPillActions) => React.ReactNode;
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
  children: (actions: CategoryPillActions) => React.ReactNode;
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
  const menuButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => () => {
    pressCleanup.current?.();
    if (dragStarted.current) onDragActiveChange?.(false);
  }, [onDragActiveChange]);

  const onPointerDown: CategoryPillActions['onPointerDown'] = (event) => {
    if (!canStartDrag || event.button !== 0) return;
    setMenuOpen(false);
    pressCleanup.current?.();

    if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
      controls.start(event);
      return;
    }

    // Touch starts only after a stationary hold. Moving early abandons the
    // gesture, leaving the regular day/task surfaces to own their gestures.
    const state = {
      pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      held: false, moved: false, timer: 0,
    };
    const move = (next: PointerEvent) => {
      if (next.pointerId !== state.pointerId) return;
      if (Math.hypot(next.clientX - state.x, next.clientY - state.y) > TOLERANCE_PX) {
        state.moved = true;
        window.clearTimeout(state.timer);
        setMenuOpen(false);
      }
    };
    const cleanup = () => {
      window.clearTimeout(state.timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      pressCleanup.current = null;
    };
    const finish = (next: PointerEvent) => {
      if (next.pointerId !== state.pointerId) return;
      cleanup();
      if (state.held) {
        suppressClick.current = true;
        if (!state.moved) setMenuOpen(true);
      }
    };
    const cancel = (next: PointerEvent) => {
      if (next.pointerId !== state.pointerId) return;
      cleanup();
      setMenuOpen(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    pressCleanup.current = cleanup;
    state.timer = window.setTimeout(() => {
      if (state.moved || !pressCleanup.current) return;
      state.held = true;
      suppressClick.current = true;
      controls.start(event);
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
      event.preventDefault();
      setMenuOpen(true);
    },
    menuOpen,
    setMenuOpen,
    menuButtonRef,
    moveUp: index > 0 ? () => onMove(category.id, -1) : undefined,
    moveDown: index < total - 1 ? () => onMove(category.id, 1) : undefined,
    update: (changes) => onUpdate(category.id, changes),
  };

  return (
    <Reorder.Item
      as="div"
      value={category.id}
      dragListener={false}
      dragControls={controls}
      className="relative"
      onDragStart={() => {
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
      {children(actions)}
    </Reorder.Item>
  );
};

/**
 * This layer owns only global category ordering. Task placement, category
 * membership and the existing task/diary drag provider remain untouched.
 */
export const DayViewCategoryReorder: React.FC<ReorderProps> = ({
  categories, enabled, canStartDrag, onCommit, onUpdate,
  onDragActiveChange, onError, renderCategory,
}) => {
  const [orderedIds, setOrderedIds] = React.useState(() => categories.map(c => c.id));
  const pendingIds = React.useRef(orderedIds);
  const persisting = React.useRef(false);
  const dragging = React.useRef(false);
  const incomingIds = categories.map(c => c.id);

  React.useEffect(() => {
    if (!sameCategoryIds(incomingIds, pendingIds.current)) {
      pendingIds.current = incomingIds;
      persisting.current = false;
      setOrderedIds(incomingIds);
    } else if (sameCategoryIds(incomingIds, pendingIds.current, true)) {
      persisting.current = false;
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
    if (sameCategoryIds(ids, categories.map(c => c.id), true)) return;
    persisting.current = true;
    try {
      const byId = new Map(categories.map(c => [c.id, c]));
      const next = ids.map(id => byId.get(id));
      if (next.length !== categories.length || next.some(c => !c)) {
        throw new Error('Categories changed during reordering');
      }
      await onCommit(next as CategoryDocument[]);
    } catch (error) {
      persisting.current = false;
      const original = categories.map(c => c.id);
      pendingIds.current = original;
      setOrderedIds(original);
      onError?.(error instanceof Error ? error.message : 'Could not reorder categories');
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
    return <>{categories.map(category =>
      <React.Fragment key={category.id}>{renderCategory(category)}</React.Fragment>
    )}</>;
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
          {(actions) => renderCategory(category, actions)}
        </DraggableCategoryRow>
      ))}
    </Reorder.Group>
  );
};
