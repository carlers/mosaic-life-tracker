import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarPlus2, Check, CheckCircle2, ChevronDown, ListFilter, Plus } from 'lucide-react';
import { getCategoryLabelColor } from '../../../constants/colors';
import type { DaySlideProps } from './DaySlideContent';
import { TaskItem } from './TaskItem';
import { TaskTimestampMeta } from './TaskTimestampMeta';
import {
  sortTasksByTimeline,
  type TaskTimestampDisplay,
  type TimelineDirection,
  type TimelineSortBasis,
} from '../../../lib/taskTimeline';

type Props = Pick<DaySlideProps,
  | 'dateStr' | 'scrollMode' | 'tasks' | 'categories' | 'currentUserId'
  | 'ownerLabels' | 'editingTaskId' | 'editValue'
  | 'onToggleTask' | 'onAddTask' | 'onOpenActions' | 'onOpenMemo'
  | 'onEditTask' | 'onViewImage' | 'onEditChange'
  | 'onEditSave' | 'onEditCancel' | 'selectionMode'
  | 'selectedTaskIds' | 'onToggleTaskSelection'
> & {
  direction: TimelineDirection;
  sortBasis: TimelineSortBasis;
  onSortBasisChange: (basis: TimelineSortBasis) => void;
  timestampDisplay: TaskTimestampDisplay;
  showOtherContentNotice?: boolean;
};


type TimelineCategoryMenuProps = {
  categories: DaySlideProps['categories'];
  value: string;
  onChange: (categoryId: string) => void;
  label: string;
  includeAll?: boolean;
  pill?: boolean;
};

const TimelineCategoryMenu: React.FC<TimelineCategoryMenuProps> = ({
  categories, value, onChange, label, includeAll = false, pill = false,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = React.useId();
  const [menuPosition, setMenuPosition] = useState<{
    top: number; left: number; width: number; maxHeight: number;
  } | null>(null);
  const selected = categories.find(category => category.id === value);
  const selectedLabel = selected?.name ?? (includeAll ? 'All categories' : 'Choose category');

  useEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) return;
    // The Day View slide scrolls in a clipped container. The menu must sit above
    // it, with its own viewport-aware geometry rather than being cut off.
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const width = Math.min(288, Math.max(rect.width, 176), window.innerWidth - margin * 2);
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    const below = window.innerHeight - rect.bottom - margin * 2;
    const above = rect.top - margin * 2;
    const showBelow = below >= 176 || below >= above;
    const maxHeight = Math.max(0, Math.min(240, showBelow ? below : above));
    const top = showBelow ? rect.bottom + margin : rect.top - margin - maxHeight;
    setMenuPosition({ top, left, width, maxHeight });

    const onOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onFocusOut = (event: FocusEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    const onScroll = (event: Event) => {
      // Scrolling the options themselves should not close their own popup.
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('focusin', onFocusOut);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    const frame = requestAnimationFrame(() => {
      const checked = menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
      (checked ?? menuRef.current?.querySelector<HTMLButtonElement>('button'))?.focus();
    });
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('focusin', onFocusOut);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frame);
    };
  }, [open]);


  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };
  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? []);
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowDown' ? (current + 1) % items.length
      : (current < 0 ? items.length - 1 : (current + items.length - 1) % items.length);
    items[next]?.focus();
  };

  return (
    <div ref={rootRef} className={pill ? 'relative inline-flex max-w-[85%]' : 'relative inline-flex max-w-[55%]'}
      onPointerDown={event => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${label}: ${selectedLabel}`}
        onClick={() => setOpen(current => !current)}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            setOpen(true);
          }
        }}
        className={pill
          ? 'mosaic-category-pill inline-flex max-w-full items-center gap-2 rounded-full bg-black py-1 pl-3.5 pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60'
          : 'inline-flex max-w-full items-center gap-2 rounded-full border border-[#444444] bg-surfaceHighlight py-2 pl-3 pr-2 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60'}
      >
        <span className={pill ? 'min-w-0 truncate text-[0.9375rem] font-bold' : 'min-w-0 truncate'}
          style={selected ? { color: getCategoryLabelColor(selected.color) } : undefined}>
          {selectedLabel}
        </span>
        <span className={pill
          ? 'mosaic-category-add-icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400'
          : 'inline-flex shrink-0 items-center justify-center text-gray-400'} aria-hidden="true">
          <ChevronDown size={pill ? 18 : 14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && menuPosition && createPortal(
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          onPointerDown={event => event.stopPropagation()}
          style={{ position: 'fixed', zIndex: 1000, top: menuPosition!.top, left: menuPosition!.left,
            width: menuPosition!.width, maxHeight: menuPosition!.maxHeight }}
          className="overflow-y-auto overscroll-contain rounded-2xl border border-[#444444] bg-surface p-1.5 shadow-2xl"
        >
          {(includeAll ? [{ id: '', name: 'All categories', color: '' }, ...categories] : categories).map(category => (
            <button
              key={category.id}
              type="button"
              role="menuitemradio"
              aria-checked={category.id === value}
              onClick={() => choose(category.id)}
              className="flex w-full min-w-36 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-white hover:bg-surfaceHighlight focus:bg-surfaceHighlight focus:outline-none"
            >
              {category.color
                ? <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
                : <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-[#444444]" aria-hidden="true" />}
              <span className="min-w-0 flex-1 break-words"
                style={category.color ? { color: getCategoryLabelColor(category.color) } : undefined}>{category.name}</span>
              {category.id === value && <Check size={16} className="shrink-0 text-gray-300" aria-hidden="true" />}
            </button>
          ))}
        </div>
        , document.body)
    </div>
  );
};

export const TaskTimelineList: React.FC<Props> = ({
  dateStr,
  scrollMode = 'page',
  tasks,
  categories,
  currentUserId,
  ownerLabels,
  editingTaskId,
  editValue,
  onToggleTask,
  onAddTask,
  onOpenActions,
  onOpenMemo,
  onEditTask,
  onViewImage,
  onEditChange,
  onEditSave,
  onEditCancel,
  selectionMode = false,
  selectedTaskIds,
  onToggleTaskSelection,
  direction,
  sortBasis,
  onSortBasisChange,
  timestampDisplay,
  showOtherContentNotice = false,
}) => {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [addCategory, setAddCategory] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const categoryMap = useMemo(
    () => new Map(categories.map(category => [category.id, category])),
    [categories]
  );
  const chosenCategory = categoryMap.has(addCategory) ? addCategory : (categories[0]?.id ?? '');

  const filtered = useMemo(() => sortTasksByTimeline(
    tasks.filter(task =>
      (!categoryFilter || task.categoryId === categoryFilter) &&
      (statusFilter === 'all' || (statusFilter === 'complete' ? task.completed : !task.completed))
    ),
    direction,
    sortBasis
  ), [tasks, categoryFilter, statusFilter, direction, sortBasis]);

  const submitTask = (event: React.FormEvent) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || !chosenCategory || selectionMode) return;
    onAddTask(title, chosenCategory, dateStr);
    setNewTitle('');
  };

  return (
    <div
      data-testid="day-timeline"
      className={scrollMode === 'contained'
        ? 'min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-4 pb-8'
        : 'w-full min-w-0 px-4 pb-8'}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Timeline filters">
        <ListFilter size={16} className="shrink-0 text-gray-400" aria-hidden="true" />
        <TimelineCategoryMenu
          categories={categories}
          value={categoryFilter}
          onChange={setCategoryFilter}
          label="Filter timeline by category"
          includeAll
        />
        <div className="relative flex min-w-0 items-center rounded-full border border-[#444444] bg-surfaceHighlight transition-colors focus-within:ring-2 focus-within:ring-emerald-500/60">
          <label className="sr-only" htmlFor={`timeline-status-${dateStr}`}>Filter timeline by completion</label>
          <select
            id={`timeline-status-${dateStr}`}
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value)}
            className="min-w-0 max-w-full appearance-none rounded-full bg-transparent py-2 pl-3 pr-8 text-xs font-semibold text-white outline-none"
          >
            <option className="bg-surface text-white" value="all">All tasks</option>
            <option className="bg-surface text-white" value="open">Incomplete</option>
            <option className="bg-surface text-white" value="complete">Completed</option>
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-gray-400" aria-hidden="true" />
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Timeline sort basis">
        <span className="text-xs text-gray-400">Sort by</span>
        <div className="inline-flex items-center rounded-full border border-[#444444] bg-surfaceHighlight p-0.5">
          <button type="button"
            aria-pressed={sortBasis === 'completion'}
            onClick={() => onSortBasisChange('completion')}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${sortBasis === 'completion' ? 'bg-surface text-white shadow-sm' : 'text-gray-400'}`}
          >
            <CheckCircle2 size={13} aria-hidden="true" /> Completion first
          </button>
          <button type="button"
            aria-pressed={sortBasis === 'creation'}
            onClick={() => onSortBasisChange('creation')}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${sortBasis === 'creation' ? 'bg-surface text-white shadow-sm' : 'text-gray-400'}`}
          >
            <CalendarPlus2 size={13} aria-hidden="true" /> Creation first
          </button>
        </div>
      </div>
      {filtered.length === 0 &&
        <p className="py-8 text-center text-sm text-gray-400">No tasks match the timeline filters.</p>}
      <div className="space-y-1">
        {filtered.map(task => {
          const category = categoryMap.get(task.categoryId);
          return (
            <div key={task.id} data-task-category-id={task.categoryId} className="border-b border-[#333333]/60 pb-2">
              <TaskItem
                task={task}
                categoryColor={category?.color ?? '#6B7280'}
                shareLabel={ownerLabels?.get(task.id)}
                currentUserId={currentUserId}
                onToggle={() => onToggleTask(task.id, task.completed)}
                onOpenActions={onOpenActions}
                onOpenMemo={onOpenMemo}
                onEditStart={onEditTask}
                onViewImage={onViewImage}
                isEditing={editingTaskId === task.id}
                editValue={editValue}
                onEditChange={onEditChange}
                onEditSave={onEditSave}
                onEditCancel={onEditCancel}
                disableLayoutAnimation
                selectionMode={selectionMode}
                isSelected={selectedTaskIds?.has(task.id)}
                onToggleSelection={() => onToggleTaskSelection?.(task.id)}
              />
              <div className="ml-9 flex flex-wrap items-center gap-x-2 gap-y-1 pb-1">
                <TaskTimestampMeta task={task} timeline sortBasis={sortBasis} display={timestampDisplay} />
                {category && (
                  <button
                    type="button"
                    disabled={selectionMode}
                    onClick={() => setCategoryFilter(category.id)}
                    className="max-w-full truncate rounded-md border border-[#444444] bg-surfaceHighlight px-2 py-0.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-60"
                    style={{ color: getCategoryLabelColor(category.color) }}
                    aria-label={`Filter by ${category.name}`}
                  >
                    {category.name}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!selectionMode && categories.length > 0 && (
        <form onSubmit={submitTask} className="mt-5 rounded-2xl border border-[#333333] bg-surface px-3 py-3" aria-label="Add timeline task">
          <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
            <TimelineCategoryMenu
              categories={categories}
              value={chosenCategory}
              onChange={setAddCategory}
              label="New task category"
              pill
            />
            <span className="shrink-0 text-[11px] text-gray-400" aria-hidden="true">Add task</span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <input
              data-task-inline-input
              value={newTitle}
              onChange={event => setNewTitle(event.target.value)}
              placeholder="New task title"
              aria-label="New timeline task title"
              className="min-w-0 flex-1 border-b-2 bg-transparent py-2 text-sm text-white outline-none"
              style={{ borderBottomColor: categoryMap.get(chosenCategory)?.color ?? '#6B7280' }}
            />
            <button
              type="submit"
              disabled={!newTitle.trim()}
              aria-label="Add timeline task"
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${newTitle.trim()
                ? 'bg-emerald-500 text-black hover:bg-emerald-600'
                : 'bg-surfaceHighlight text-gray-400 opacity-60'}`}
            >
              <Plus size={19} aria-hidden="true" />
            </button>
          </div>
        </form>
      )}
      {showOtherContentNotice && (
        <p className="mt-4 text-center text-xs text-gray-400" role="note">
          Diary and shared tasks remain available in Categories view.
        </p>
      )}
    </div>
  );
};
