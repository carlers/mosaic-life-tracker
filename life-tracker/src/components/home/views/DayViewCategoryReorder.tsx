import React from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import type { CategoryDocument } from '../../../db/schema';
import type { CategoryPillActions } from './CategorySection';
import { CategoryPillActionContext, CategoryReorderDragContext } from './categoryPillActionContext';
import { moveCategoryId, sameCategoryIds } from '../../../lib/categoryReorder';
import {
  categoryDragOffsets, categoryDragOrder, nextCategoryDragIndex,
  type CategoryDragGeometry,
} from '../../../lib/categoryDragProjection';
import { reuseEqualRenderedCategory } from '../../../lib/reuseEqualRenderedCategory';

const HOLD_MS = 500;
const TOLERANCE_PX = 8;

interface ReorderProps {
  categories: CategoryDocument[];
  enabled: boolean;
  /** Layout-only projection while carrying a task between dates. */
  animateExternal?: boolean;
  /** A mixed task/diary drag owns its own row transitions, not whole-category FLIP. */
  pauseLayoutWhileMixedDrag?: boolean;
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
  pauseLayoutWhileMixedDrag: boolean;
  onDragActiveChange: (active: boolean, id: string) => void;
  categoryDragActive: boolean;
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
  category, index, total, canStartDrag, pauseLayoutWhileMixedDrag, categoryDragActive, onDragActiveChange, onDragMove,
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
    const target = event.target;
    const fromLabel = target instanceof Element &&
      Boolean(target.closest('[data-category-drag-handle]'));
    // A full-width pill has a large empty button surface outside its text
    // label. Treat that surface (and the visibility icon) as a drag handle,
    // but keep the dedicated plus area click/long-press-only. Compact pills
    // retain label-only drag activation.
    const fromWidePill = target instanceof Element &&
      Boolean(event.currentTarget.closest("[data-full-width-category-pills='true']")) &&
      !target.closest('.mosaic-category-add-icon');
    const fromDragHandle = fromLabel || fromWidePill;
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
        activeChangeRef.current(false, category.id);
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
      // The drag overlay is portaled outside the preference-scoped grid CSS.
      // Preserve grid tracks and padding to avoid a text jump on pickup.
      copy.style.display = computed.display;
      copy.style.gridTemplateColumns = computed.gridTemplateColumns;
      copy.style.columnGap = computed.columnGap;
      copy.style.paddingLeft = computed.paddingLeft;
      copy.style.paddingRight = computed.paddingRight;
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
        copiedLabel.style.flex = labelStyle.flex;
        copiedLabel.style.textAlign = labelStyle.textAlign;
        copiedLabel.style.gridColumn = labelStyle.gridColumn;
        copiedLabel.style.justifySelf = labelStyle.justifySelf;
      }
      const originalPlus = source.querySelector('.mosaic-category-add-icon');
      const copiedPlus = copy.querySelector('.mosaic-category-add-icon');
      if (originalPlus && copiedPlus instanceof HTMLElement) {
        const plusStyle = window.getComputedStyle(originalPlus);
        copiedPlus.style.gridColumn = plusStyle.gridColumn;
        copiedPlus.style.justifySelf = plusStyle.justifySelf;
      }
      const originalIcon = source.querySelector(':scope > svg');
      const copiedIcon = copy.querySelector(':scope > svg');
      if (originalIcon && copiedIcon instanceof SVGElement) {
        const iconStyle = window.getComputedStyle(originalIcon);
        copiedIcon.style.gridColumn = iconStyle.gridColumn;
        copiedIcon.style.justifySelf = iconStyle.justifySelf;
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
      activeChangeRef.current(true, category.id);
    };
    const handleMove = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return;
      const travel = Math.hypot(next.clientX - startX, next.clientY - startY);
      if (!dragging) {
        if (travel < TOLERANCE_PX) return;
        // An early touch swipe belongs to the page; a stationary touch must
        // hold for 500 ms before its label can start a category drag.
        if (!fromDragHandle || (touch && !held)) {
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
      layout={pauseLayoutWhileMixedDrag || categoryDragActive ? false : 'position'}
      transition={{ layout: { duration: 0.18, ease: 'easeOut' } }}
      className="relative"
    >
      <CategoryPillActionContext.Provider value={actions}>{children}</CategoryPillActionContext.Provider>
    </motion.div>
  );
}, (previous, next) => {
  // The parent's inline renderCategory closure creates a fresh element for
  // each hover. This comparator checks *every* semantic prop and the actual
  // child element props before skipping any unchanged category's React work.
  const keys = Object.keys(previous) as (keyof DragRowProps)[];
  return keys.length === Object.keys(next).length && keys.every(key =>
    key === 'children'
      ? reuseEqualRenderedCategory(previous.children, next.children) === previous.children
      : Object.is(previous[key], next[key]));
});

/**
 * This layer owns only global category ordering. Task placement, category
 * membership and the existing task/diary drag provider remain untouched.
 */
export const DayViewCategoryReorder: React.FC<ReorderProps> = ({
  categories, enabled, animateExternal = false, pauseLayoutWhileMixedDrag = false,
  canStartDrag, onCommit, onUpdate,
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
  const dragSession = React.useRef<{
    rows: CategoryDragGeometry[];
    elements: Map<string, HTMLDivElement>;
    sourceIndex: number;
    targetIndex: number;
    scrollY: number;
    scrollParents: { node: HTMLElement; top: number }[];
    pendingCommit: boolean;
    lastOffsets: number[];
  } | null>(null);
  const [categoryDragActive, setCategoryDragActive] = React.useState(false);
  const clearDragTransforms = React.useCallback(() => {
    const session = dragSession.current;
    if (!session) return;
    for (const element of session.elements.values()) {
      // Clear direct transforms only after DOM order has been committed,
      // before the next paint. No per-hover React tree updates or layout reads.
      element.style.transform = '';
      element.style.transition = '';
      element.style.willChange = '';
    }
    dragSession.current = null;
  }, []);
  React.useLayoutEffect(() => {
    if (dragSession.current?.pendingCommit) clearDragTransforms();
  }, [orderedIds, clearDragTransforms]);
  React.useEffect(() => () => clearDragTransforms(), [clearDragTransforms]);
  // React.memo on the row wrapper isolates unchanged category subtrees even
  // when the inline renderCategory closure itself changes every hover.
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
    const session = dragSession.current;
    if (!session || session.rows[session.sourceIndex]?.id !== id) return;
    const scrollDelta = window.scrollY - session.scrollY +
      session.scrollParents.reduce((sum, { node, top }) => sum + node.scrollTop - top, 0);
    const nextIndex = nextCategoryDragIndex(
      session.rows, session.sourceIndex, session.targetIndex, pointerY + scrollDelta
    );
    if (nextIndex === session.targetIndex) return;
    session.targetIndex = nextIndex;
    pendingIds.current = categoryDragOrder(session.rows, session.sourceIndex, nextIndex);
    const offsets = categoryDragOffsets(session.rows, session.sourceIndex, nextIndex);
    // Move existing category sections with compositor-only transforms. Do not
    // move full-height DOM sections in React or synchronously read row geometry
    // during boundary crossings; both caused forced layout in owner's trace.
    for (let index = 0; index < offsets.length; index++) {
      const offset = offsets[index];
      if (offset === session.lastOffsets[index]) continue;
      const element = session.elements.get(session.rows[index].id);
      if (!element) continue;
      element.style.transition = 'transform 160ms ease-out';
      element.style.willChange = 'transform';
      element.style.transform = offset ? `translate3d(0px,${offset}px,0px)` : '';
    }
    session.lastOffsets = offsets;
  }, []);
  const handleCancel = React.useCallback(() => {
    pendingIds.current = dragSnapshot.current ?? pendingIds.current;
    dragSnapshot.current = null;
    clearDragTransforms();
  }, [clearDragTransforms]);
  const handleDragEnded = React.useCallback((active: boolean, id: string) => {
    dragging.current = active;
    if (active) {
      const order = pendingIds.current.slice();
      dragSnapshot.current = order;
      const elements = new Map(rowElements.current);
      const rows: CategoryDragGeometry[] = [];
      // Batch all geometric reads at pickup: no read-after-transform/layout
      // in the per-pointer path, even with very different category heights.
      for (const rowId of order) {
        const element = elements.get(rowId);
        const header = element?.querySelector(
          '.mosaic-category-pill, [data-category-drag-handle], button'
        );
        if (!element || !header) break;
        const rect = element.getBoundingClientRect();
        const headerRect = header.getBoundingClientRect();
        rows.push({ id: rowId, top: rect.top, bottom: rect.bottom,
          headerCenter: headerRect.top + headerRect.height / 2 });
      }
      const scrollParents: { node: HTMLElement; top: number }[] = [];
      let parent = elements.get(id)?.parentElement;
      while (parent) {
        if (parent !== document.body && parent !== document.documentElement &&
            parent.scrollHeight > parent.clientHeight + 2 &&
            /(auto|scroll|overlay)/.test(getComputedStyle(parent).overflowY))
          scrollParents.push({ node: parent, top: parent.scrollTop });
        parent = parent.parentElement;
      }
      if (rows.length === order.length) dragSession.current = {
        rows, elements, sourceIndex: order.indexOf(id),
        targetIndex: order.indexOf(id), scrollY: window.scrollY,
        scrollParents, lastOffsets: rows.map(() => 0), pendingCommit: false,
      };
    }
    setCategoryDragActive(active);
    onDragActiveChange?.(active);
  }, [onDragActiveChange]);
  const onDrop = React.useCallback(() => {
    const order = pendingIds.current;
    dragSnapshot.current = null;
    if (!sameCategoryIds(order, orderedIds, true)) {
      if (dragSession.current) dragSession.current.pendingCommit = true;
      setOrderedIds(order);
    } else clearDragTransforms();
    void commit(order);
  }, [commit, orderedIds, clearDragTransforms]);
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
            <motion.div key={category.id} layout={pauseLayoutWhileMixedDrag ? false : 'position'} className="relative"
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
            pauseLayoutWhileMixedDrag={pauseLayoutWhileMixedDrag}
            categoryDragActive={categoryDragActive}
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
