import React from 'react';
import { createPortal } from 'react-dom';
import { BookOpenText } from 'lucide-react';
import type { CategoryDocument, DiaryDocument, TaskDocument } from '../../../db/schema';
import { canAddNewTaskToCategory } from '../../../lib/categoryLifecycle';
import { projectDiaryNoteLayout } from '../../../lib/diaryNoteLayout';
import { projectDiaryMixedMove, type DiaryMixedDrop } from '../../../lib/diaryMixedOrder';
import { diaryDayLayoutKey, diaryNoteCategoryKey, diaryNotePositionKey,
  noteDisplayTitle, resolveDiaryNotePosition } from '../../../lib/diaryNotes';
import type { DiaryNoteDayInteraction } from './diaryNoteDayContext';

type Override = { value: unknown; baseline: unknown };
type NoteHover = { categoryId: string; index: number; order: number; height: number };
type Float = {
  id: string; startX: number; startY: number;
  rect: { left: number; top: number; width: number; height: number };
  source: 'group' | 'inline';
  external: boolean;
  stage: 'drag' | 'settle';
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
  const readPersisted = (key: string): unknown =>
    runtimeOverrides?.has(key) ? runtimeOverrides.get(key) : getSetting?.(key);
  const readSetting = (key: string): unknown => {
    const data = overrides.get(key);
    const raw = readPersisted(key);
    return data && same(raw, data.baseline) ? data.value : raw;
  };
  // Local optimistic values survive the asynchronous settings broadcast, but
  // never override a newer concurrent device write.
  React.useEffect(() => {
    if (!overrides.size) return;
    const next = new Map(overrides);
    for (const [key, entry] of overrides)
      if (!same(readPersisted(key), entry.baseline)) next.delete(key);
    if (next.size !== overrides.size) setOverrides(next);
  });
  const taskPlacement = React.useMemo(() =>
    Object.fromEntries(categories.map(category => [
      category.id, (tasksByCategory.get(category.id) ?? []).map(task => task.id),
    ])), [categories, tasksByCategory]);
  const notePlan = projectDiaryNoteLayout(date, entries, categories, tasksByCategory, readSetting);
  const groupedIds = new Set(notePlan.grouped.map(entry => entry.id));
  const [hover, setHover] = React.useState<NoteHover | null>(null);
  const [floating, setFloating] = React.useState<Float | null>(null);
  const floatRef = React.useRef<Float | null>(null);
  const elRef = React.useRef<HTMLDivElement>(null);
  const pointerRef = React.useRef<{ x: number; y: number } | null>(null);
  const clearFloat = () => { floatRef.current = null; setFloating(null); setHover(null); };

  const updateFloatPosition = (x: number, y: number) => {
    pointerRef.current = { x, y };
    const data = floatRef.current;
    if (!data || data.stage !== 'drag') return;
    const element = elRef.current;
    if (element) element.style.transform =
      `translate3d(${x - data.startX}px, ${y - data.startY}px, 0)`;
  };
  React.useLayoutEffect(() => {
    const data = floating;
    if (data?.stage !== 'drag' || !data.external || !pointerRef.current) return;
    updateFloatPosition(pointerRef.current.x, pointerRef.current.y);
  }, [floating?.external, floating?.id, floating?.stage]);

  const root = () => document.querySelector<HTMLElement>(
    `[data-testid="day-slide"][data-date-str="${date}"]`);

  const hit = (x: number, y: number, sourceId: string): Hit | null => {
    const host = root();
    if (!host) return null;
    const group = host.querySelector<HTMLElement>('[data-diary-drag-group]');
    if (group) {
      const rect = group.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
        return { kind: 'group' };
    }
    for (const section of host.querySelectorAll<HTMLElement>('[data-task-category-id]')) {
      const rect = section.getBoundingClientRect();
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
      const categoryId = section.dataset.taskCategoryId ?? '';
      const category = categories.find(item => item.id === categoryId);
      if (!category || !canAddNewTaskToCategory(category, date)) return null;
      const rows = [...section.querySelectorAll<HTMLElement>(
        '[data-diary-note-task-id], [data-diary-note-row]')]
        .map(node => {
          const entryId = node.dataset.diaryNoteRow;
          const taskId = node.dataset.diaryNoteTaskId;
          return { node, entryId, taskId, rect: node.getBoundingClientRect() };
        })
        .filter(item => (item.taskId || (item.entryId && item.entryId !== sourceId)) &&
          item.rect.height > 0)
        .sort((a, b) => a.rect.top - b.rect.top);
      const next = rows.find(item => y < item.rect.top + item.rect.height / 2);
      const previous = rows[rows.length - 1];
      if (!next && !previous) return { kind: 'category', drop: { categoryId, position: 'start' } };
      const chosen = next ?? previous;
      const side = next ? 'before' as const : 'after' as const;
      return { kind: 'category', drop: chosen.entryId
        ? { categoryId, position: 'note', noteId: chosen.entryId, side }
        : { categoryId, position: side, taskId: chosen.taskId! } };
    }
    return null;
  };

  const persist = (values: ReadonlyMap<string, unknown>) => {
    if (!setSetting || !values.size) return;
    setOverrides(current => {
      const next = new Map(current);
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
    const data: Float = { id, rect: { left: rect.left, top: rect.top, width: rect.width,
      height: rect.height }, startX: x, startY: y, source,
      external: source === 'inline', stage: 'drag' };
    floatRef.current = data;
    pointerRef.current = { x, y };
    setFloating(data);
  };
  const onDragMove: DiaryNoteDayInteraction['onDragMove'] = (id, x, y, height) => {
    const data = floatRef.current;
    if (!data || data.id !== id || data.stage !== 'drag') return false;
    const target = hit(x, y, id);
    const external = data.source === 'inline' || target?.kind !== 'group';
    if (external !== data.external) {
      const updated = { ...data, external };
      floatRef.current = updated;
      setFloating(updated);
    }
    updateFloatPosition(x, y);
    if (!target || target.kind === 'group') {
      setHover(prev => prev ? null : prev);
      return external;
    }
    const mixed = projectDiaryMixedMove(taskPlacement, notePlan.placed,
      { kind: 'note', id }, target.drop);
    const next = mixed?.notes[id];
    if (!next) { setHover(prev => prev ? null : prev); return external; }
    const item = next.anchorTaskId
      ? taskPlacement[next.categoryId]?.indexOf(next.anchorTaskId) ?? -1 : -1;
    const slot = item >= 0 ? item + (next.side === 'after' ? 1 : 0) : next.rank;
    const candidate = { categoryId: next.categoryId, index: slot,
      order: next.noteOrder ?? 0, height: Math.min(220, Math.max(35, height)) };
    setHover(prev => prev && same(prev, candidate) ? prev : candidate);
    return external;
  };
  const onDragRelease: DiaryNoteDayInteraction['onDragRelease'] = (id, x, y) => {
    if (!setSetting || !floatRef.current || floatRef.current.id !== id) return false;
    const target = hit(x, y, id);
    if (!target) return false;
    const update = new Map<string, unknown>();
    if (target.kind === 'group') {
      if (!resolveDiaryNotePosition(readSetting(diaryNotePositionKey(id)))) return false;
      update.set(diaryNotePositionKey(id), null);
    } else {
      const projected = projectDiaryMixedMove(taskPlacement, notePlan.placed,
        { kind: 'note', id }, target.drop);
      if (!projected) return false;
      for (const [entryId, position] of Object.entries(projected.notes)) {
        const key = diaryNotePositionKey(entryId);
        if (!same(resolveDiaryNotePosition(readSetting(key)), position)) update.set(key, position);
      }
      update.set(diaryNoteCategoryKey(id), target.drop.categoryId);
      update.set(diaryDayLayoutKey(date), 'distributed');
    }
    persist(update);
    const data = { ...floatRef.current, external: true, stage: 'settle' as const };
    floatRef.current = data;
    setFloating(data);
    setHover(null);
    return true;
  };
  const onDragEnd = () => {
    setHover(prev => prev ? null : prev);
    if (floatRef.current?.stage !== 'settle') clearFloat();
  };
  React.useLayoutEffect(() => {
    if (floating?.stage !== 'settle') return;
    const frame = window.requestAnimationFrame(() => {
      const element = elRef.current;
      if (!element) { clearFloat(); return; }
      const target = [...(root()?.querySelectorAll<HTMLElement>(
        '[data-diary-note-row], [data-diary-reorder-id]') ?? [])]
        .find(node => node.dataset.diaryNoteRow === floating.id ||
          node.dataset.diaryReorderId === floating.id);
      const finish = () => clearFloat();
      if (!target) {
        element.style.opacity = '0';
        window.setTimeout(finish, 130);
        return;
      }
      const rect = target.getBoundingClientRect();
      element.style.transition = 'transform 180ms cubic-bezier(.2,.8,.2,1), opacity 180ms ease';
      element.style.transform = `translate3d(${rect.left - floating.rect.left}px, ${rect.top - floating.rect.top}px, 0)`;
      element.style.opacity = '.95';
      window.setTimeout(finish, 200);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [floating?.stage, floating?.id, notePlan.grouped.length, notePlan.placed.length]);

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
        opacity: floating.external ? 1 : 0,
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
