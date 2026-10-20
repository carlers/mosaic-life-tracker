import React, { useMemo, useState } from 'react';
import { ChevronDown, ListFilter, Plus } from 'lucide-react';
import { getCategoryLabelColor } from '../../../constants/colors';
import type { DaySlideProps } from './DaySlideContent';
import { TaskItem } from './TaskItem';
import { TaskTimestampMeta } from './TaskTimestampMeta';
import {
  sortTasksByTimeline,
  type TaskTimestampDisplay,
  type TimelineDirection,
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
  timestampDisplay: TaskTimestampDisplay;
  showOtherContentNotice?: boolean;
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
  const chosenCategoryDocument = categoryMap.get(chosenCategory);
  const filtered = useMemo(() => sortTasksByTimeline(
    tasks.filter(task =>
      (!categoryFilter || task.categoryId === categoryFilter) &&
      (statusFilter === 'all' || (statusFilter === 'complete' ? task.completed : !task.completed))
    ),
    direction
  ), [tasks, categoryFilter, statusFilter, direction]);

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
        <div className="relative flex min-w-0 max-w-[55%] items-center rounded-full border border-[#444444] bg-surfaceHighlight transition-colors focus-within:ring-2 focus-within:ring-emerald-500/60">
          <label className="sr-only" htmlFor={`timeline-category-${dateStr}`}>Filter timeline by category</label>
          <select
            id={`timeline-category-${dateStr}`}
            value={categoryFilter}
            onChange={event => setCategoryFilter(event.target.value)}
            className="min-w-0 max-w-full appearance-none truncate rounded-full bg-transparent py-2 pl-3 pr-8 text-xs font-semibold text-white outline-none"
          >
            <option className="bg-surface text-white" value="">All categories</option>
            {categories.map(category => (
              <option className="bg-surface text-white" key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-gray-400" aria-hidden="true" />
        </div>
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
                <TaskTimestampMeta task={task} timeline display={timestampDisplay} />
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
            <div className="mosaic-category-pill relative inline-flex max-w-[85%] items-center gap-2 rounded-full bg-black py-1 pl-3.5 pr-1 focus-within:ring-2 focus-within:ring-emerald-500/60">
              <span
                className="min-w-0 truncate text-[0.9375rem] font-bold"
                aria-hidden="true"
                style={{ color: getCategoryLabelColor(chosenCategoryDocument?.color ?? '#6B7280') }}
              >
                {chosenCategoryDocument?.name}
              </span>
              <span className="mosaic-category-add-icon inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400" aria-hidden="true">
                <ChevronDown size={18} />
              </span>
              <label className="sr-only" htmlFor={`timeline-add-category-${dateStr}`}>New task category</label>
              <select
                id={`timeline-add-category-${dateStr}`}
                value={chosenCategory}
                onChange={event => setAddCategory(event.target.value)}
                aria-label="New task category"
                className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full opacity-0"
              >
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>
            <span className="shrink-0 text-[11px] text-gray-400" aria-hidden="true">Add task</span>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <input
              data-task-inline-input
              value={newTitle}
              onChange={event => setNewTitle(event.target.value)}
              placeholder="New task title"
              aria-label="New timeline task title"
              className="min-w-0 flex-1 border-b-2 bg-transparent py-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
              style={{ borderBottomColor: chosenCategoryDocument?.color ?? '#6B7280' }}
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
