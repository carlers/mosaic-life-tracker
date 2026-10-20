import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
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
  const chosenCategory = categories.some(category => category.id === addCategory)
    ? addCategory : (categories[0]?.id ?? '');
  const categoryMap = useMemo(() => new Map(categories.map(category => [category.id, category])), [categories]);
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
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Timeline filters">
        <label className="sr-only" htmlFor={`timeline-category-${dateStr}`}>Filter timeline by category</label>
        <select
          id={`timeline-category-${dateStr}`}
          value={categoryFilter}
          onChange={event => setCategoryFilter(event.target.value)}
          className="min-w-0 max-w-[55%] rounded-lg border border-[#444444] bg-surface px-2 py-1.5 text-xs text-white"
        >
          <option value="">All categories</option>
          {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <label className="sr-only" htmlFor={`timeline-status-${dateStr}`}>Filter timeline by completion</label>
        <select
          id={`timeline-status-${dateStr}`}
          value={statusFilter}
          onChange={event => setStatusFilter(event.target.value)}
          className="rounded-lg border border-[#444444] bg-surface px-2 py-1.5 text-xs text-white"
        >
          <option value="all">All tasks</option>
          <option value="open">Incomplete</option>
          <option value="complete">Completed</option>
        </select>
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
                <TaskTimestampMeta
                  task={task}
                  timeline
                  display={timestampDisplay}
                />
                {category && (
                  <button
                    type="button"
                    disabled={selectionMode}
                    onClick={() => setCategoryFilter(category.id)}
                    className="rounded-full border border-[#444444] px-2 py-0.5 text-[11px] focus-visible:outline focus-visible:outline-2"
                    style={{ color: category.color }}
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
        <form onSubmit={submitTask} className="mt-4 flex min-w-0 items-center gap-2" aria-label="Add timeline task">
          <label className="sr-only" htmlFor={`timeline-add-category-${dateStr}`}>New task category</label>
          <select
            id={`timeline-add-category-${dateStr}`}
            value={chosenCategory}
            onChange={event => setAddCategory(event.target.value)}
            className="max-w-[40%] rounded-lg border border-[#444444] bg-surface px-2 py-2 text-xs text-white"
          >
            {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <input
            data-task-inline-input
            value={newTitle}
            onChange={event => setNewTitle(event.target.value)}
            placeholder="Add a task"
            aria-label="New timeline task title"
            className="min-w-0 flex-1 border-b border-[#555555] bg-transparent py-2 text-sm text-white outline-none focus:border-emerald-500"
          />
          <button type="submit" disabled={!newTitle.trim()} aria-label="Add timeline task"
            className="rounded-full p-2 text-gray-300 disabled:opacity-40 focus-visible:outline focus-visible:outline-2">
            <Plus size={19} />
          </button>
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
