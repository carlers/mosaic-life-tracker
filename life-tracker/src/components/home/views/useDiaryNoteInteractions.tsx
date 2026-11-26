import React from 'react';
import { createPortal } from 'react-dom';
import { BookOpenText } from 'lucide-react';
import type { CategoryDocument, DiaryDocument, TaskDocument } from '../../../db/schema';
import { canAddNewTaskToCategory } from '../../../lib/categoryLifecycle';
import { projectDiaryNoteLayout } from '../../../lib/diaryNoteLayout';
import { projectDiaryMixedMove, type DiaryMixedDrop } from '../../../lib/diaryMixedOrder';
import { buildDiaryHoverIndex, resolveDiaryHoverSlot, type DiaryHoverIndex } from '../../../lib/diaryHoverIndex';
import { resolveDiaryDragHit, resolveDiaryReleaseHit, type DiaryDragHitRegion, type DiaryDragRect } from '../../../lib/diaryDropGeometry';
import { diaryDayLayoutKey, diaryNoteCategoryKey, diaryNotePositionKey,
  noteDisplayTitle, resolveDiaryNotePosition } from '../../../lib/diaryNotes';
import type { DiaryNoteDayInteraction } from './diaryNoteDayContext';

type Override = { value: unknown; baseline: unknown };
type NoteHover = { categoryId: string; index: number; order: number; height: number };
type Float = {
  id: string; startX: number; startY: number;
  rect: { left: number; top: number; width: number; height: number };
  source: 'group' | 'inline';
  /** Group row stays in flow while hovered; leaves flow only outside group. */
  external: boolean;
  stage: 'drag' | 'settle';
  destinationCategoryId?: string;
};
type Hit = { kind: 'group' } | { kind: 'category'; drop: DiaryMixedDrop };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function useDiaryNoteInteractions({
  date, entries, categories, tasksByCategory, getSetting, setSetting, onError,
  runtimeOverrides, onCrossDayStart, onCrossDayMove, onCrossDayEnd, onReorderActiveChange,
}: {
  date: string;
  entries: readonly DiaryDocument[];
  categories: readonly CategoryDocument[];
  tasksByCategory: ReadonlyMap<string, readonly TaskDocument[]>;
  getSetting?: (key: string) => unknown;
  setSetting?: (key: string, value: unknown) => Promise<void>;
  onError?: (message: string) => void;
  runtimeOverrides?: ReadonlyMap<string, unknown>;
  onCrossDayStart?: (kind: 'note' | 'group', entries: readonly DiaryDocument[], date: string, rect: DOMRect) => void;
  onCrossDayMove?: (point: { x: number; y: number }, event?: Event | null) => boolean;
  onCrossDayEnd?: (kind: 'note' | 'group', id?: string) => boolean;
  onReorderActiveChange?: (active: boolean) => void;
}) {
  const [overrides, setOverrides] = React.useState<Map<string, Override>>(() => new Map());
  const readPersisted = React.useCallback((key: string): unknown =>
    runtimeOverrides?.has(key) ? runtimeOverrides.get(key) : getSetting?.(key),
    [runtimeOverrides, getSetting]);
  const readSetting = React.useCallback((key: string): unknown => {
    const data = overrides.get(key);
    const raw = readPersisted(key);
    return data && same(raw, data.baseline) ? data.value : raw;
  }, [overrides, readPersisted]);
  // Read-time baseline matching makes stale optimistic values inert without
  // effect-driven setState (and without a render cascade during drag).
  // Superseded entries are reclaimed on the next explicit write.
  const taskPlacement = React.useMemo(() =>
    Object.fromEntries(categories.map(category => [
      category.id, (tasksByCategory.get(category.id) ?? []).map(task => task.id),
    ])), [categories, tasksByCategory]);
  // Pointer movement must not sort Diary entries and resolve all task anchors.
  // Reproject only when the task/Diary/settings inputs actually change.
  const notePlan = React.useMemo(() =>
    projectDiaryNoteLayout(date, entries, categories, tasksByCategory, readSetting),
    [date, entries, categories, tasksByCategory, readSetting]);
  const groupedIds = React.useMemo(
    () => new Set(notePlan.grouped.map(entry => entry.id)), [notePlan.grouped]);
  const [hover, setHover] = React.useState<NoteHover | null>(null);
  const [floating, setFloating] = React.useState<Float | null>(null);
  const floatRef = React.useRef<Float | null>(null);
  const elRef = React.useRef<HTMLDivElement>(null);
  const pointerRef = React.useRef<{ x: number; y: number } | null>(null);
  const lastDropRef = React.useRef<string | null>(null);
  // A valid target remains reserved during short neutral/pill crossings.
  // Task drags do not remove their gap on these collision-free pixels.
  const retainedDropRef = React.useRef<DiaryMixedDrop | null>(null);
  const acceptedPointRef = React.useRef<{ x: number; y: number } | null>(null);
  const hoverAnchorRef = React.useRef<{ x: number; y: number } | null>(null);
  // One immutable index per lifted note. Hover never recomputes every task
  // and diary anchor; the canonical full projection still runs on release.
  const hoverIndexRef = React.useRef<DiaryHoverIndex | null>(null);
  const clearFloat = () => { floatRef.current = null; hitSnapshot.current = null;
    lastDropRef.current = null; retainedDropRef.current = null;
    acceptedPointRef.current = null; hoverAnchorRef.current = null;
    hoverIndexRef.current = null;
    setFloating(null); setHover(null); };

  const updateFloatPosition = (x: number, y: number) => {
    pointerRef.current = { x, y };
    const data = floatRef.current;
    if (!data || data.stage !== 'drag') return;
    const element = elRef.current;
    if (element) element.style.transform =
      `translate3d(${x - data.startX}px, ${y - data.startY}px, 0)`;
  };
  React.useLayoutEffect(() => {
    if (floating?.stage !== 'drag' || !pointerRef.current) return;
    updateFloatPosition(pointerRef.current.x, pointerRef.current.y);
  }, [floating]);

  const root = React.useCallback(() => document.querySelector<HTMLElement>(
    `[data-testid="day-slide"][data-date-str="${date}"]`), [date]);

  type HitSnapshot = { group: DiaryDragRect | null; regions: DiaryDragHitRegion[];
    scrollHost: HTMLElement | null; scrollTop: number; windowY: number };
  const hitSnapshot = React.useRef<HitSnapshot | null>(null);
  const captureTargets = (): HitSnapshot | null => {
    const host = root();
    if (!host) return null;
    const makeRect = (node: HTMLElement): DiaryDragRect => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    };
    const group = host.querySelector<HTMLElement>('[data-diary-drag-group]');
    const regions: DiaryDragHitRegion[] = [];
    for (const section of host.querySelectorAll<HTMLElement>('[data-task-category-id]')) {
      const categoryId = section.dataset.taskCategoryId ?? '';
      const rows = [...section.querySelectorAll<HTMLElement>(
        '[data-diary-note-task-id], [data-diary-note-row]')]
        .map(node => {
          const noteId = node.dataset.diaryNoteRow;
          const taskId = node.dataset.diaryNoteTaskId;
          const rect = node.getBoundingClientRect();
          return { kind: (noteId ? 'note' : 'task') as 'note' | 'task',
            id: (noteId || taskId || ''), midpoint: rect.top + rect.height / 2,
            height: rect.height };
        })
        .filter(row => row.id && row.height > 0)
        .sort((a, b) => a.midpoint - b.midpoint)
        .map(({ kind, id, midpoint }) => ({ kind, id, midpoint }));
      regions.push({ categoryId, rect: makeRect(section), rows });
    }
    // A tall overflow-visible day root is NOT necessarily its scroll owner.
    // Only use a real scrolling ancestor; also account for document scrolling.
    let scrollHost: HTMLElement | null = host;
    while (scrollHost) {
      const overflow = window.getComputedStyle(scrollHost).overflowY;
      if (/(auto|scroll|overlay)/.test(overflow) &&
          scrollHost.scrollHeight > scrollHost.clientHeight + 2) break;
      scrollHost = scrollHost.parentElement;
    }
    return { group: group ? makeRect(group) : null, regions,
      scrollHost, scrollTop: scrollHost?.scrollTop ?? 0, windowY: window.scrollY };
  };
  // Leaving/re-entering the bulk group changes its real height and shifts all
  // category headers. Re-snapshot once after that layout commits, never for
  // each animated insertion gap (which would make targets chase the pointer).
  React.useLayoutEffect(() => {
    if (floating?.stage === 'drag')
      hitSnapshot.current = captureTargets();
  // Intentionally capture only on a group in/out transition. The function is
  // render-local because a hover projection must not resnapshot moving rows.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floating?.id, floating?.external, floating?.stage, root]);

  const hit = (x: number, y: number, sourceId: string): Hit | null => {
    const snapshot = hitSnapshot.current;
    if (!snapshot) return null;
    const offset = (snapshot.scrollHost
      ? snapshot.scrollHost.scrollTop - snapshot.scrollTop : 0) +
      window.scrollY - snapshot.windowY;
    const host = root();
    // Sample the current painted category, not just its captured pre-gap
    // coordinates. A placeholder in the preceding category moves the next
    // category and its pill by a full row height.
    const underPointer = typeof document.elementFromPoint === 'function'
      ? document.elementFromPoint(x, y) as HTMLElement | null : null;
    const groupElement = underPointer?.closest<HTMLElement>('[data-diary-drag-group]');
    if (groupElement && host?.contains(groupElement)) return { kind: 'group' };
    // An insertion spacer is never another droppable row. Ignore its hit
    // rather than allowing it to chase the pointer at a category edge.
    if (underPointer?.closest('[data-diary-note-gap]')) return null;
    const liveSection = underPointer?.closest<HTMLElement>('[data-task-category-id]');
    const liveCategory = liveSection && host?.contains(liveSection)
      ? snapshot.regions.find(region => region.categoryId === liveSection.dataset.taskCategoryId)
      : null;
    // The category header is an explicit start-of-list target, not a
    // midpoint that can flip when the first row is pushed down by a gap.
    if (liveCategory && underPointer?.closest('[data-task-category-drop-position="start"]')) {
      const category = categories.find(item => item.id === liveCategory.categoryId);
      return category && canAddNewTaskToCategory(category, date)
        ? { kind: 'category', drop: { categoryId: category.id, position: 'start' } } : null;
    }
    // Directly use the real painted row when the pointer is on a task/note.
    // The insertion gap moves siblings; their captured midpoints are stale
    // during the same drag. A single live row midpoint is more precise and
    // avoids rescanning every row on each pointer event.
    if (liveCategory && liveSection) {
      const row = underPointer?.closest<HTMLElement>(
        '[data-diary-note-row], [data-diary-note-task-id]');
      if (row && liveSection.contains(row)) {
        const noteId = row.dataset.diaryNoteRow;
        const taskId = row.dataset.diaryNoteTaskId;
        if ((noteId && noteId !== sourceId) || taskId) {
          const rect = row.getBoundingClientRect();
          const side = y < rect.top + rect.height / 2 ? 'before' as const : 'after' as const;
          const drop: DiaryMixedDrop = noteId
            ? { categoryId: liveCategory.categoryId, position: 'note', noteId, side }
            : { categoryId: liveCategory.categoryId, position: side, taskId: taskId! };
          const category = categories.find(item => item.id === drop.categoryId);
          return category && canAddNewTaskToCategory(category, date)
            ? { kind: 'category', drop } : null;
        }
      }
    }
    const baselineY = liveCategory && liveSection
      ? y + liveCategory.rect.top - liveSection.getBoundingClientRect().top
      : y + offset;
    const target = resolveDiaryDragHit(
      snapshot.group, snapshot.regions, x, baselineY, sourceId,
      liveCategory?.categoryId);
    if (target?.kind === 'category') {
      const category = categories.find(item => item.id === target.drop.categoryId);
      if (!category || !canAddNewTaskToCategory(category, date)) return null;
    }
    return target;
  };

  const persist = (values: ReadonlyMap<string, unknown>) => {
    if (!setSetting || !values.size) return;
    setOverrides(current => {
      const next = new Map([...current].filter(([key, item]) =>
        same(readPersisted(key), item.baseline)));
      for (const [key, value] of values)
        next.set(key, { value, baseline: readPersisted(key) });
      return next;
    });
    void (async () => {
      for (const [key, value] of values) await setSetting(key, value);
    })().catch(error => {
      setOverrides(current => {
        const next = new Map(current);
        for (const [key, value] of values)
          if (same(next.get(key)?.value, value)) next.delete(key);
        return next;
      });
      onError?.(error instanceof Error ? error.message : 'Could not move diary entry');
    });
  };

  const onDragStart: DiaryNoteDayInteraction['onDragStart'] = (id, rect, x, y, source) => {
    if (!entries.some(entry => entry.id === id) || !setSetting) return;
    // The committed layout effect captures the target geometry after the
    // source switches to its retained hidden slot. Capturing here would
    // measure the pre-lift row and conflict with the transition snapshot.
    lastDropRef.current = null;
    retainedDropRef.current = null;
    acceptedPointRef.current = null;
    hoverAnchorRef.current = null;
    hoverIndexRef.current = buildDiaryHoverIndex(taskPlacement, notePlan.placed, id);
    // Reserve the source's own slot at pickup, just like a task. The pointer
    // overlay and original row exchange occupancy without a collapsed frame.
    if (source === 'inline') {
      const origin = notePlan.placed.find(note => note.entry.id === id);
      if (origin) {
        const drop: DiaryMixedDrop = origin.position.anchorTaskId && origin.position.side
          ? { categoryId: origin.position.categoryId,
              position: origin.position.side, taskId: origin.position.anchorTaskId }
          : { categoryId: origin.position.categoryId, position: 'index', index: origin.slot };
        retainedDropRef.current = drop;
        acceptedPointRef.current = { x, y };
        hoverAnchorRef.current = { x, y };
        setHover({ categoryId: origin.position.categoryId,
          index: origin.slot, order: origin.position.noteOrder ?? 0,
          height: Math.max(1, rect.height) });
      }
    }
    const data: Float = { id, rect: { left: rect.left, top: rect.top, width: rect.width,
      height: rect.height }, startX: x, startY: y, source,
      // Both sources use one fixed portal. A grouped source keeps its *space*
      // while inside the group, but leaves flow on crossing into categories.
      external: source === 'inline', stage: 'drag' };
    floatRef.current = data;
    pointerRef.current = { x, y };
    setFloating(data);
    onCrossDayStart?.('note', entries.filter(entry => entry.id === id), date, rect as DOMRect);
    onReorderActiveChange?.(true);
  };
  const hoverFor = (drop: DiaryMixedDrop, height: number): NoteHover | null => {
    const slot = hoverIndexRef.current
      ? resolveDiaryHoverSlot(hoverIndexRef.current, drop) : null;
    return slot ? { ...slot, height: Math.max(1, height) } : null;
  };
  const onDragMove: DiaryNoteDayInteraction['onDragMove'] = (id, x, y, height) => {
    const data = floatRef.current;
    if (!data || data.id !== id || data.stage !== 'drag') return false;
    // A cross-day handoff now owns the pointer outside the source slide.
    // Do not let stale source-day collision targets commit an independent move.
    if (onCrossDayMove?.({ x, y })) return true;
    const target = hit(x, y, id);
    // The pointer overlay owns its own transform; no React state update is
    // needed for each sampled pointer coordinate.
    updateFloatPosition(x, y);
    const outsideGroup = data.source === 'inline' || target?.kind !== 'group';
    // Do not collapse the bulk group's original slot merely because the
    // pointer crossed its margin. The category placeholder must already
    // exist before the source releases its in-flow height.
    const external = data.source === 'inline' || target?.kind === 'category' ||
      (data.external && target?.kind !== 'group');
    if (data.external !== external) {
      const updated = { ...data, external };
      floatRef.current = updated;
      // The bulk group must collapse *during the crossing*, not on drop.
      // React's layout effect re-captures all category boundaries afterward.
      setFloating(updated);
      lastDropRef.current = null;
    }
    if (!target) {
      // The pointer may be over a header margin while the placeholder has
      // shifted the next category. Do not retract a valid, full-height gap.
      return outsideGroup;
    }
    if (target.kind === 'group') {
      lastDropRef.current = null;
      retainedDropRef.current = null;
      acceptedPointRef.current = null;
      hoverAnchorRef.current = null;
      setHover(prev => prev ? null : prev);
      return outsideGroup;
    }
    const dropKey = JSON.stringify(target.drop);
    if (dropKey === lastDropRef.current) {
      acceptedPointRef.current = { x, y };
      return outsideGroup;
    }
    // Do not change the gap merely because a sibling/header animated under
    // a nearly stationary finger. Require intentional motion before switching
    // targets; capture the point of each actual slot change, not every sample.
    const anchor = hoverAnchorRef.current;
    if (retainedDropRef.current && anchor &&
        Math.abs(x - anchor.x) < 6 && Math.abs(y - anchor.y) < 6) {
      acceptedPointRef.current = { x, y };
      return outsideGroup;
    }
    const candidate = hoverFor(target.drop, height);
    if (!candidate) return outsideGroup;
    lastDropRef.current = dropKey;
    retainedDropRef.current = target.drop;
    acceptedPointRef.current = { x, y };
    hoverAnchorRef.current = { x, y };
    setHover(prev => prev && same(prev, candidate) ? prev : candidate);
    return outsideGroup;
  };
  const onDragRelease: DiaryNoteDayInteraction['onDragRelease'] = (id, x, y) => {
    if (onCrossDayEnd?.('note', id)) {
      clearFloat();
      return true;
    }
    if (!setSetting || !floatRef.current || floatRef.current.id !== id) return false;
    const direct = hit(x, y, id);
    const snapshot = hitSnapshot.current;
    const offset = snapshot
      ? (snapshot.scrollHost ? snapshot.scrollHost.scrollTop - snapshot.scrollTop : 0)
        + window.scrollY - snapshot.windowY : 0;
    const onCategoryBand = snapshot?.regions.some(region =>
      x >= region.rect.left && x <= region.rect.right &&
      y + offset >= region.rect.top - 24 &&
      y + offset <= region.rect.bottom + Math.max(32, floatRef.current!.rect.height));
    // A neutral-pixel release commits the last visible valid gap only when
    // inside the category workspace. Actual releases outside still cancel.
    // The rendered insertion gap is authoritative at pointer-up. A fresh
    // hit-test can see the *next* category because that gap moved its pill.
    const target: Hit | null = resolveDiaryReleaseHit(
      direct, retainedDropRef.current, acceptedPointRef.current,
      { x, y }, Boolean(onCategoryBand));
    if (!target) return false;
    const update = new Map<string, unknown>();
    let settlingHover: NoteHover | null = null;
    if (target.kind === 'group') {
      if (!resolveDiaryNotePosition(readSetting(diaryNotePositionKey(id)))) return false;
      update.set(diaryNotePositionKey(id), null);
    } else {
      const projected = projectDiaryMixedMove(taskPlacement, notePlan.placed,
        { kind: 'note', id }, target.drop);
      if (!projected) return false;
      settlingHover = hoverFor(target.drop, floatRef.current.rect.height);
      if (!settlingHover) return false;
      for (const [entryId, position] of Object.entries(projected.notes)) {
        const key = diaryNotePositionKey(entryId);
        if (!same(resolveDiaryNotePosition(readSetting(key)), position)) update.set(key, position);
      }
      update.set(diaryNoteCategoryKey(id), target.drop.categoryId);
      update.set(diaryDayLayoutKey(date), 'distributed');
    }
    // Preserve one full-height insertion gap through the entire 200ms settle.
    // The hidden, out-of-flow real row and the gap swap occupancy together
    // when the overlay finishes — never collapse and re-expand on release.
    persist(update);
    const data = { ...floatRef.current, external: true, stage: 'settle' as const,
      destinationCategoryId: settlingHover?.categoryId };
    floatRef.current = data;
    setHover(settlingHover);
    setFloating(data);
    return true;
  };
  const onDragEnd = () => {
    if (floatRef.current?.stage !== 'settle') clearFloat();
    onReorderActiveChange?.(false);
  };
  React.useLayoutEffect(() => {
    if (floating?.stage !== 'settle') return;
    let frame: number | null = null;
    let timer: number | null = null;
    let attempts = 0;
    const finish = () => {
      frame = null; timer = null;
      clearFloat();
    };
    const paint = () => {
      frame = null;
      const element = elRef.current;
      if (!element) { finish(); return; }
      const day = root();
      const gap = floating.destinationCategoryId
        ? day?.querySelector<HTMLElement>('[data-diary-note-gap]') : null;
      const destinationGap = gap?.closest<HTMLElement>('[data-task-category-id]')
        ?.dataset.taskCategoryId === floating.destinationCategoryId ? gap : null;
      // The destination row stays out of flow until overlay completion.
      // Its rect is not the insertion rect; the pinned placeholder is.
      const destinationRow = [...(day?.querySelectorAll<HTMLElement>(
        '[data-diary-note-row], [data-diary-reorder-id]') ?? [])]
        .find(node => node.dataset.diaryNoteRow === floating.id ||
          node.dataset.diaryReorderId === floating.id);
      if (destinationGap && destinationRow) {
        // Match the actual rendered note's height before the gap and hidden
        // source exchange occupancy. Never collapse to zero at pointer-up.
        const height = destinationRow.getBoundingClientRect().height;
        if (height > 0) {
          destinationGap.style.transition = 'height 180ms cubic-bezier(.2,.8,.2,1)';
          destinationGap.style.height = `${height}px`;
        }
      }
      const target = destinationGap ?? destinationRow;
      if (!target && ++attempts < 5) {
        frame = window.requestAnimationFrame(paint);
        return;
      }
      if (!target) {
        element.style.opacity = '0';
        timer = window.setTimeout(finish, 130);
        return;
      }
      const rect = target.getBoundingClientRect();
      element.style.transition = 'transform 180ms cubic-bezier(.2,.8,.2,1), opacity 180ms ease';
      element.style.transform = `translate3d(${rect.left - floating.rect.left}px, ${rect.top - floating.rect.top}px, 0)`;
      element.style.opacity = '.95';
      timer = window.setTimeout(finish, 200);
    };
    frame = window.requestAnimationFrame(paint);
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [floating, root]);

  const toggleLayout = () => {
    const key = diaryDayLayoutKey(date);
    persist(new Map([[key, notePlan.mode === 'grouped' ? 'distributed' : 'grouped']]));
  };
  // The parent re-renders for each new insertion gap, but the other Diary
  // rows must not all re-render through context on every hover frame.
  // Stable delegators point to the latest committed handlers; only actual
  // layout/source state changes publish a new provider value.
  const liveHandlers = React.useRef({
    toggleLayout, onDragStart, onDragMove, onDragRelease, onDragEnd,
  });
  React.useLayoutEffect(() => {
    liveHandlers.current = { toggleLayout, onDragStart, onDragMove,
      onDragRelease, onDragEnd };
  });
  const context = React.useMemo<DiaryNoteDayInteraction | null>(() => setSetting
    ? { layout: notePlan.mode, groupedEntryIds: groupedIds, savedCount: notePlan.savedCount,
      totalEntries: notePlan.total, floatingEntryId: floating?.id ?? null,
      floatingExternal: Boolean(floating?.external),
      toggleLayout: () => liveHandlers.current.toggleLayout(),
      onDragStart: (...args: Parameters<DiaryNoteDayInteraction['onDragStart']>) =>
        liveHandlers.current.onDragStart(...args),
      onDragMove: (...args: Parameters<DiaryNoteDayInteraction['onDragMove']>) =>
        liveHandlers.current.onDragMove(...args),
      onDragRelease: (...args: Parameters<DiaryNoteDayInteraction['onDragRelease']>) =>
        liveHandlers.current.onDragRelease(...args),
      onDragEnd: () => liveHandlers.current.onDragEnd() }
    : null, [setSetting, notePlan.mode, groupedIds, notePlan.savedCount, notePlan.total,
      floating?.id, floating?.external]);
  const floatedEntry = floating ? entries.find(entry => entry.id === floating.id) : null;
  const overlay = typeof document !== 'undefined' && floating && floatedEntry && createPortal(
    <div ref={elRef} aria-hidden="true" data-diary-note-floating="true"
      style={{ position: 'fixed', zIndex: 2100, pointerEvents: 'none',
        left: floating.rect.left, top: floating.rect.top, width: floating.rect.width,
        minHeight: Math.min(220, floating.rect.height),
        opacity: 1,
        borderRadius: 10, padding: '8px 12px', background: 'var(--color-surface, #242424)',
        color: '#fff', boxShadow: '0 12px 28px rgba(0,0,0,.28)' }}>
      <span className="flex items-start gap-2">
        <BookOpenText size={18} aria-hidden="true" className="mt-0.5 shrink-0"/>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-sm">{noteDisplayTitle(floatedEntry, readSetting)}</span>
          {floatedEntry.content && <span className="block line-clamp-2 text-xs opacity-70">
            {floatedEntry.content.slice(0, 140)}</span>}
        </span>
      </span>
    </div>, document.body);
  return { notePlan, context, hover, overlay, readSetting };
}
