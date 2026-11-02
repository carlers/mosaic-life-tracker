import React, { useMemo, useState } from 'react';
import { ListFilter, Plus, ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { getCategoryLabelColor } from '../../../constants/colors';
import { MosaicSelect } from '../../ui/MosaicSelect';
import type { DaySlideProps } from './DaySlideContent';
import { TaskItem } from './TaskItem';
import { canAddNewTaskToCategory } from '../../../lib/categoryLifecycle';
import { TaskTimestampMeta } from './TaskTimestampMeta';
import {
  sortTasksByTimeline,
  resolveTimelineSortBasis,
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
  | 'selectedTaskIds' | 'onToggleTaskSelection' | 'emptyCategoryPrompt' | 'footerCategoryPrompt'
> & {
  direction: TimelineDirection;
  sortBasis: TimelineSortBasis;
  onSortBasisChange: (basis: TimelineSortBasis) => void;
  onDirectionChange: (direction: TimelineDirection) => void;
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
  sortBasis,
  onSortBasisChange,
  onDirectionChange,
  timestampDisplay,
  showOtherContentNotice = false,
  emptyCategoryPrompt,
  footerCategoryPrompt,
}) => {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [addCategory, setAddCategory] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const categoryMap = useMemo(
    () => new Map(categories.map(category => [category.id, category])),
    [categories]
  );
  const assignableCategories = useMemo(() => categories.filter(category =>
    canAddNewTaskToCategory(category, dateStr)), [categories, dateStr]);
  const chosenCategory = assignableCategories.some(category => category.id === addCategory)
    ? addCategory : (assignableCategories[0]?.id ?? '');

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
      {emptyCategoryPrompt}
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Timeline filters">
        <ListFilter size={16} className="shrink-0 text-gray-400" aria-hidden="true" />
        <MosaicSelect
          value={categoryFilter}
          onChange={setCategoryFilter}
          label="Filter timeline by category"
          variant="compact"
          className="max-w-[55%]"
          options={[
            { value: '', label: 'All categories' },
            ...categories.map(category => ({
              value: category.id, label: category.name, color: category.color,
              textColor: getCategoryLabelColor(category.color),
            })),
          ]}
        />
        <MosaicSelect
          label="Filter timeline by completion"
          value={statusFilter}
          onChange={setStatusFilter}
          variant="compact"
          options={[
            { value: 'all', label: 'All tasks' },
            { value: 'open', label: 'Incomplete' },
            { value: 'complete', label: 'Completed' },
          ]}
        />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Timeline sorting">
        <span className="text-xs text-gray-400">Sort by</span>
        <MosaicSelect
          label="Arrange timeline tasks"
          value={sortBasis}
          onChange={value => onSortBasisChange(resolveTimelineSortBasis(value))}
          variant="compact"
          options={[
            { value: 'completion', label: 'Completed first' },
            { value: 'completion-last', label: 'Completed last' },
            { value: 'creation', label: 'Creation date' },
          ]}
        />
        <button
          type="button"
          aria-label={direction === 'desc' ? 'Timeline newest first; switch to oldest' : 'Timeline oldest first; switch to newest'}
          title={direction === 'desc' ? 'Newest first' : 'Oldest first'}
          onClick={() => onDirectionChange(direction === 'desc' ? 'asc' : 'desc')}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full border border-[#444444] bg-surfaceHighlight px-2 text-gray-300 transition-colors hover:bg-[#333333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        >
          {direction === 'desc' ? <ArrowDownWideNarrow size={16} aria-hidden="true" /> : <ArrowUpNarrowWide size={16} aria-hidden="true" />}
          <span className="text-[11px] font-semibold">{direction === 'desc' ? 'Newest' : 'Oldest'}</span>
        </button>
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
      {!selectionMode && assignableCategories.length > 0 && (
        <form onSubmit={submitTask} className="mt-5 rounded-2xl border border-[#333333] bg-surface px-3 py-3" aria-label="Add timeline task">
          <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
            <MosaicSelect
              value={chosenCategory}
              onChange={setAddCategory}
              label="New task category"
              variant="category"
              className="max-w-[85%]"
              options={assignableCategories.map(category => ({
                value: category.id, label: category.name, color: category.color,
                textColor: getCategoryLabelColor(category.color),
              }))}
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
      {footerCategoryPrompt}
    </div>
  );
};
