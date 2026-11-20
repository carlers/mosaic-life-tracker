import React from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import type { CategoryDocument } from '../../../db/schema';
import type { CategoryPillActions } from './CategorySection';
import { CategoryPillActionContext, CategoryReorderDragContext } from './categoryPillActionContext';
import { moveCategoryId, sameCategoryIds } from '../../../lib/categoryReorder';

const HOLD_MS = 500;
const TOLERANCE_PX = 8;
const SWAP_HYSTERESIS_PX = 6;

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
  onDragActiveChange: (active: boolean) => void;
  onDragMove: (id: string, clientY: number) => void;
  onCancel: () => void;
  onDrop: () => void;
  onMove: (id: string, delta: -1 | 1) => void;
  onUpdate: ReorderProps['onUpdate'];
  registerRow: (id: string, node: HTMLDivElement | null) => void;
  children: React.ReactNode;
}

/**
 * Framer Motion Reorder.Item drags the whole (possibly hundreds-of-pixels-tall)
 * category section. When differently sized sections exchange slots, Motion's
 * layout correction displaces the pill from the pointer and can expose
 * transient raster/outline edges. Move only a fixed pill preview under the
 * pointer, independently from the position-only section layout animation.
 */
const DraggableCategoryRow = React.memo(function DraggableCategoryRow({
  category, index, total, canStartDrag, onDragActiveChange, onDragMove,
  onCancel, onDrop, onMove, onUpdate, registerRow, children,
}: DragRowProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const suppressClick = React.useRef(false);
  const pressCleanup = React.useRef<(() => void) | null>(null);
  const activeChangeRef = React.useRef(onDragActiveChange);
  React.useEffect(() => { activeChangeRef.current = onDragActiveChange; }, [onDragActiveChange]);
  React.useEffect(() => () => { pressCleanup.current?.(); }, []);

  const onPointerDown: CategoryPillActions['onPointerDown'] = (event) => {
    if (!canStartDrag || event.button !== 0 || event.isPrimary === false) return;
    const touch = event.pointerType === 'touch';
    const fromLabel = event.target instanceof Element &&
      Boolean(event.target.closest('[data-category-drag-handle]'));
    const source = event.currentTarget as HTMLButtonElement;
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;

    pressCleanup.current?.();
    suppressClick.current = false;
    setMenuOpen(false);

    let held = false;
    let dragging = false;
    let timer = 0;
    let overlay: HTMLDivElement | null = null;
    let originalVisibility = '';
    let originalUserSelect = '';

    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      window.removeEventListener('keydown', handleKeyDown, true);
      if (overlay) {
        overlay.remove();
        overlay = null;
        source.style.visibility = originalVisibility;
      }
      if (dragging) {
        dragging = false;
        document.body.style.userSelect = originalUserSelect;
        activeChangeRef.current(false);
      }
      if (pressCleanup.current === cleanup) pressCleanup.current = null;
    };
    const beginDrag = () => {
      const rect = source.getBoundingClientRect();
      const computed = window.getComputedStyle(source);
      const copy = source.cloneNode(true) as HTMLButtonElement;
      // This presentation has no focus, border, drag-image, or pointer events.
      // The original button stays mounted, but is hidden while being carried.
      copy.removeAttribute('id');
      copy.tabIndex = -1;
      copy.draggable = false;
      copy.style.width = '100%';
      copy.style.height = '100%';
      copy.style.margin = '0';
      copy.style.boxSizing = 'border-box';
      copy.style.justifyContent = computed.justifyContent;
      copy.style.border = '0';
      copy.style.outline = 'none';
      copy.style.boxShadow = 'none';
      copy.style.pointerEvents = 'none';
      const originalLabel = source.querySelector('[data-category-drag-handle]');
      const copiedLabel = copy.querySelector('[data-category-drag-handle]');
      if (originalLabel && copiedLabel instanceof HTMLElement) {
        const labelStyle = window.getComputedStyle(originalLabel);
        copiedLabel.style.minWidth = labelStyle.minWidth;
        copiedLabel.style.maxWidth = labelStyle.maxWidth;
        copiedLabel.style.overflow = labelStyle.overflow;
        copiedLabel.style.textOverflow = labelStyle.textOverflow;
        copiedLabel.style.whiteSpace = labelStyle.whiteSpace;
      }
      const holder = document.createElement('div');
      holder.dataset.categoryDragOverlay = category.id;
      holder.setAttribute('aria-hidden', 'true');
      Object.assign(holder.style, {
        position: 'fixed', left: `${rect.left}px`, top: `${rect.top}px`,
        width: `${rect.width}px`, height: `${rect.height}px`,
        pointerEvents: 'none', zIndex: '2147483000',
        transform: 'translate3d(0px,0px,0px)',
        willChange: 'transform', contain: 'paint',
      });
      holder.appendChild(copy);
      document.body.appendChild(holder);
      overlay = holder;
      originalVisibility = source.style.visibility;
      source.style.visibility = 'hidden';
      originalUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
      dragging = true;
      suppressClick.current = true;
      setMenuOpen(false);
      activeChangeRef.current(true);
    };
    const handleMove = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return;
      const travel = Math.hypot(next.clientX - startX, next.clientY - startY);
      if (!dragging) {
        if (travel < TOLERANCE_PX) return;
        // An early touch swipe belongs to the page; a stationary touch must
        // hold for 500 ms before its label can start a category drag.
        if (!fromLabel || (touch && !held)) {
          cleanup();
          return;
        }
        beginDrag();
      }
      if (overlay) {
        overlay.style.transform = `translate3d(${next.clientX - startX}px,${next.clientY - startY}px,0)`;
      }
      onDragMove(category.id, next.clientY);
      if (next.cancelable) next.preventDefault();
    };
    const handleUp = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return;
      const wasDragging = dragging;
      cleanup();
      if (wasDragging) onDrop();
      else if (held) suppressClick.current = true;
    };
    const handleCancel = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return;
      const wasDragging = dragging;
      cleanup();
      if (wasDragging) onCancel();
      // iOS can cancel a pointer after showing its native context menu.
      if (!held && !suppressClick.current) setMenuOpen(false);
    };
    const handleKeyDown = (next: KeyboardEvent) => {
      if (next.key !== 'Escape' || !dragging) return;
      next.preventDefault();
      next.stopPropagation();
      cleanup();
      onCancel();
    };
    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleCancel);
    window.addEventListener('keydown', handleKeyDown, true);
    pressCleanup.current = cleanup;
    timer = window.setTimeout(() => {
      if (pressCleanup.current !== cleanup || dragging) return;
      held = true;
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
    <motion.div
      ref={(node) => registerRow(category.id, node)}
      data-panel-reorder-row="true"
      data-category-reorder-id={category.id}
      layout="position"
      transition={{ layout: { duration: 0.18, ease: 'easeOut' } }}
      className="relative"
    >
      <CategoryPillActionContext.Provider value={actions}>{children}</CategoryPillActionContext.Provider>
    </motion.div>
  );
});

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
  const dragSnapshot = React.useRef<string[] | null>(null);
  const rowElements = React.useRef(new Map<string, HTMLDivElement>());
  const [categoryDragActive, setCategoryDragActive] = React.useState(false);
  const renderedCategories = React.useMemo(() => {
    const result = new Map<string, React.ReactNode>();
    if (enabled) for (const category of categories) result.set(category.id, renderCategory(category));
    return result;
  }, [categories, enabled, renderCategory]);
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
  }, [categories]);

  const categoryById = React.useMemo(
    () => new Map(categories.map(category => [category.id, category])), [categories]
  );
  const orderedCategories = orderedIds
    .map(id => categoryById.get(id))
    .filter((category): category is CategoryDocument => Boolean(category));

  const commit = React.useCallback(async (ids: string[]) => {
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

  const registerRow = React.useCallback((id: string, node: HTMLDivElement | null) => {
    if (node) rowElements.current.set(id, node);
    else rowElements.current.delete(id);
  }, []);
  const handleDragMove = React.useCallback((id: string, pointerY: number) => {
    const current = pendingIds.current;
    const from = current.indexOf(id);
    if (from < 0) return;
    // Compare pointer to actual category HEADER positions rather than the
    // midpoint of potentially very tall task sections. Layout changes of the
    // dragged section can never change the pointer's position.
    const headerCenter = (targetId: string): number | null => {
      const row = rowElements.current.get(targetId);
      const header = row?.querySelector('.mosaic-category-pill, [data-category-drag-handle], button');
      if (!header) return null;
      const rect = header.getBoundingClientRect();
      return rect.top + rect.height / 2;
    };
    let to = from;
    for (let i = from + 1; i < current.length; i += 1) {
      const center = headerCenter(current[i]);
      if (center === null || pointerY < center + SWAP_HYSTERESIS_PX) break;
      to = i;
    }
    for (let i = from - 1; i >= 0; i -= 1) {
      const center = headerCenter(current[i]);
      if (center === null || pointerY > center - SWAP_HYSTERESIS_PX) break;
      to = i;
    }
    if (from === to) return;
    const next = [...current];
    next.splice(from, 1);
    next.splice(to, 0, id);
    pendingIds.current = next;
    setOrderedIds(next);
  }, []);
  const handleCancel = React.useCallback(() => {
    if (!dragSnapshot.current) return;
    pendingIds.current = dragSnapshot.current;
    setOrderedIds(dragSnapshot.current);
    dragSnapshot.current = null;
  }, []);
  // Cancel is called after deactivation, so preserve the snapshot until after
  // the original order has been restored.
  const handleDragEnded = React.useCallback((active: boolean) => {
    dragging.current = active;
    if (active) dragSnapshot.current = pendingIds.current.slice();
    setCategoryDragActive(active);
    onDragActiveChange?.(active);
  }, [onDragActiveChange]);
  const onDrop = React.useCallback(() => {
    dragSnapshot.current = null;
    void commit(pendingIds.current);
  }, [commit]);
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
    <CategoryReorderDragContext.Provider value={categoryDragActive}>
      <div data-testid="category-reorder">
        {orderedCategories.map((category, index) => (
          <DraggableCategoryRow
            key={category.id}
            category={category}
            index={index}
            total={orderedCategories.length}
            canStartDrag={canStartDrag}
            onDragActiveChange={handleDragEnded}
            onDragMove={handleDragMove}
            onCancel={handleCancel}
            onDrop={onDrop}
            onMove={move}
            onUpdate={onUpdate}
            registerRow={registerRow}
          >
            {renderedCategories.get(category.id)}
          </DraggableCategoryRow>
        ))}
      </div>
    </CategoryReorderDragContext.Provider>
  );
};
