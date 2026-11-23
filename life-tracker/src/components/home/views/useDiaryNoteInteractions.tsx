import React from 'react';
import { createPortal } from 'react-dom';
import { BookOpenText } from 'lucide-react';
import type { CategoryDocument, DiaryDocument, TaskDocument } from '../../../db/schema';
import { canAddNewTaskToCategory } from '../../../lib/categoryLifecycle';
import { projectDiaryNoteLayout } from '../../../lib/diaryNoteLayout';
import { projectDiaryMixedMove, type DiaryMixedDrop } from '../../../lib/diaryMixedOrder';
import { resolveDiaryDragHit, type DiaryDragHitRegion, type DiaryDragRect } from '../../../lib/diaryDropGeometry';
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
  runtimeOverrides,
}: {
  date: string;
  entries: readonly DiaryDocument[];
  categories: readonly CategoryDocument[];
  tasksByCategory: ReadonlyMap<string, readonly TaskDocument[]>;
  getSetting?: (key: string) => unknown;
  setSetting?: (key: string, value: unknown) => Promise<void>;
  onError?: (message: string) => void;
  runtimeOverrides?: ReadonlyMap<string, unknown>;
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
  const clearFloat = () => { floatRef.current = null; hitSnapshot.current = null;
    lastDropRef.current = null;
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
  const captureTargets = React.useCallback((): HitSnapshot | null => {
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
  }, [root]);
  // Leaving/re-entering the bulk group changes its real height and shifts all
  // category headers. Re-snapshot once after that layout commits, never for
  // each animated insertion gap (which would make targets chase the pointer).
  React.useLayoutEffect(() => {
    if (floating?.stage === 'drag')
      hitSnapshot.current = captureTargets();
  }, [floating?.id, floating?.external, floating?.stage, captureTargets]);

  const hit = (x: number, y: number, sourceId: string): Hit | null => {
    const snapshot = hitSnapshot.current;
    if (!snapshot) return null;
    const offset = (snapshot.scrollHost
      ? snapshot.scrollHost.scrollTop - snapshot.scrollTop : 0) +
      window.scrollY - snapshot.windowY;
    const target = resolveDiaryDragHit(
      snapshot.group, snapshot.regions, x, y + offset, sourceId);
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
    hitSnapshot.current = captureTargets();
    lastDropRef.current = null;
    const data: Float = { id, rect: { left: rect.left, top: rect.top, width: rect.width,
      height: rect.height }, startX: x, startY: y, source,
      // Both sources use one fixed portal. A grouped source keeps its *space*
      // while inside the group, but leaves flow on crossing into categories.
      external: source === 'inline', stage: 'drag' };
    floatRef.current = data;
    pointerRef.current = { x, y };
    setFloating(data);
  };
  const hoverFor = (id: string, drop: DiaryMixedDrop, height: number): NoteHover | null => {
    const mixed = projectDiaryMixedMove(taskPlacement, notePlan.placed,
      { kind: 'note', id }, drop);
    const next = mixed?.notes[id];
    if (!next) return null;
    const item = next.anchorTaskId
      ? taskPlacement[next.categoryId]?.indexOf(next.anchorTaskId) ?? -1 : -1;
    return { categoryId: next.categoryId,
      index: item >= 0 ? item + (next.side === 'after' ? 1 : 0) : next.rank,
      order: next.noteOrder ?? 0, height: Math.min(220, Math.max(35, height)) };
  };
  const onDragMove: DiaryNoteDayInteraction['onDragMove'] = (id, x, y, height) => {
    const data = floatRef.current;
    if (!data || data.id !== id || data.stage !== 'drag') return false;
    const target = hit(x, y, id);
    // The pointer overlay owns its own transform; no React state update is
    // needed for each sampled pointer coordinate.
    updateFloatPosition(x, y);
    const outsideGroup = data.source === 'inline' || target?.kind !== 'group';
    if (data.external !== outsideGroup) {
      const updated = { ...data, external: outsideGroup };
      floatRef.current = updated;
      // The bulk group must collapse *during the crossing*, not on drop.
      // React's layout effect re-captures all category boundaries afterward.
      setFloating(updated);
      lastDropRef.current = null;
    }
    if (!target || target.kind === 'group') {
      lastDropRef.current = null;
      setHover(prev => prev ? null : prev);
      return outsideGroup;
    }
    const dropKey = JSON.stringify(target.drop);
    if (dropKey === lastDropRef.current) return outsideGroup;
    lastDropRef.current = dropKey;
    const candidate = hoverFor(id, target.drop, height);
    if (!candidate) { setHover(prev => prev ? null : prev); return outsideGroup; }
    setHover(prev => prev && same(prev, candidate) ? prev : candidate);
    return outsideGroup;
  };
  const onDragRelease: DiaryNoteDayInteraction['onDragRelease'] = (id, x, y) => {
    if (!setSetting || !floatRef.current || floatRef.current.id !== id) return false;
    const target = hit(x, y, id);
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
      settlingHover = hoverFor(id, target.drop, floatRef.current.rect.height);
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
  const context: DiaryNoteDayInteraction | null = setSetting
    ? { layout: notePlan.mode, groupedEntryIds: groupedIds, savedCount: notePlan.savedCount,
      totalEntries: notePlan.total, floatingEntryId: floating?.id ?? null,
      floatingExternal: Boolean(floating?.external),
      toggleLayout, onDragStart, onDragMove, onDragRelease, onDragEnd }
    : null;
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
