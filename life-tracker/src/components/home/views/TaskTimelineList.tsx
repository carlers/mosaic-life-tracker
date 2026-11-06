import React, { useMemo, useRef, useState } from 'react';
import { ListFilter, Plus, ArrowDownWideNarrow, ArrowUpNarrowWide } from 'lucide-react';
import { DragDropProvider, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/react';
import { CollisionPriority } from '@dnd-kit/abstract';
import { PointerActivationConstraints, PointerSensor, KeyboardSensor } from '@dnd-kit/dom';
import { LayoutGroup, motion } from 'framer-motion';
import { getCategoryLabelColor } from '../../../constants/colors';
import { visibilityIcon } from '../../../lib/visibility';
import { MosaicSelect } from '../../ui/MosaicSelect';
import type { DaySlideProps } from './DaySlideContent';
import { TaskItem, type TaskItemProps } from './TaskItem';
import { TASK_REORDER_KEYBOARD_SENSOR } from './taskKeyboardSensor';
import { canAddNewTaskToCategory } from '../../../lib/categoryLifecycle';
import { TaskTimestampMeta } from './TaskTimestampMeta';
import {
  sortTasksByTimeline, resolveTimelineSortBasis,
  type TaskTimestampDisplay, type TimelineDirection, type TimelineSortBasis,
} from '../../../lib/taskTimeline';
import {
  buildTimelineGroups, projectTimelineGroups, timelineSectionOptions, type TimelineGranularity, type TimelineGroupId, type TimelineGroup,
} from '../../../lib/timelinePlanner';

const pointer = PointerSensor.configure({
  activationConstraints: [new PointerActivationConstraints.Delay({ value: 500, tolerance: 8 })],
});
const sensors: NonNullable<React.ComponentProps<typeof DragDropProvider>['sensors']> = defaults => [
  ...defaults.filter(sensor => sensor !== PointerSensor && sensor !== KeyboardSensor),
  pointer,
  TASK_REORDER_KEYBOARD_SENSOR,
];

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
  granularity: TimelineGranularity;
  placements: Readonly<Record<string, unknown>>;
  onAddTimelineTask: (title: string, categoryId: string, dateStr: string, section: TimelineGroupId) => Promise<void>;
  onTimelineMove: (taskId: string, section: TimelineGroupId, beforeId?: string) => Promise<void>;
  onReorderActiveChange?: (active: boolean) => void;
  allowReorder: boolean;
};

interface RowProps {
  item: TaskItemProps;
  enabled: boolean;
  isDragging: boolean;
  overBefore: boolean;
  overAfter: boolean;
  children: React.ReactNode;
}

const TimelineRow: React.FC<RowProps> = ({
  item, enabled, isDragging, overBefore, overAfter, children,
}) => {
  const { ref: dragRef, handleRef } = useDraggable({
    id: item.task.id, type: 'timeline-task', disabled: !enabled,
  });
  const { ref: beforeRef } = useDroppable({
    id: 'planner-before:' + item.task.id, type: 'timeline-insert',
    accept: 'timeline-task', collisionPriority: CollisionPriority.High, disabled: !enabled,
  });
  const { ref: afterRef } = useDroppable({
    id: 'planner-after:' + item.task.id, type: 'timeline-insert',
    accept: 'timeline-task', collisionPriority: CollisionPriority.High, disabled: !enabled,
  });
  return (
    <motion.div ref={handleRef} layout="position" transition={{ layout: { duration: 0.2, ease: 'easeOut' } }}
      className="relative pb-2 touch-pan-y"
      data-task-category-id={item.task.categoryId}
      style={{ opacity: isDragging ? 0.2 : 1 }}>
      {overBefore && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-0.5 rounded-full bg-accent" />}
      <div ref={dragRef} aria-hidden="true" style={{
        position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none',
      }}/>
      <div ref={beforeRef} aria-hidden="true" style={{
        position: 'absolute', insetInline: 0, top: 0, height: '50%', pointerEvents: 'none',
      }}/>
      <div ref={afterRef} aria-hidden="true" style={{
        position: 'absolute', insetInline: 0, bottom: 0, height: '50%', pointerEvents: 'none',
      }}/>
      <TaskItem {...item} allowParentDrag={enabled} disableLayoutAnimation />
      {children}
      {overAfter && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-accent" />}
    </motion.div>
  );
};

const SectionDrop: React.FC<{
  id: TimelineGroupId; enabled: boolean; active: boolean; children: React.ReactNode;
}> = ({ id, enabled, active, children }) => {
  const { ref } = useDroppable({
    id: 'planner-end:' + id,
    type: 'timeline-section',
    accept: 'timeline-task',
    collisionPriority: CollisionPriority.Low,
    disabled: !enabled,
  });
  return <div ref={ref} className={active ? 'rounded-lg bg-accent/10' : ''}>{children}</div>;
};

const noop = () => undefined;

interface HoverProjection {
  taskId: string;
  section: TimelineGroupId;
  beforeTaskId?: string;
}

/** Resolve drop targets against the projected order, ignoring the dragged row. */
function timelineDropTarget(
  groups: readonly TimelineGroup[],
  sourceId: string,
  target: string
): Omit<HoverProjection, 'taskId'> | null {
  if (target.startsWith('planner-end:')) {
    const id = target.slice('planner-end:'.length) as TimelineGroupId;
    return groups.some(group => group.id === id) ? { section: id } : null;
  }
  const after = target.startsWith('planner-after:');
  if (!after && !target.startsWith('planner-before:')) return null;
  const targetId = target.slice(after ? 'planner-after:'.length : 'planner-before:'.length);
  if (targetId === sourceId) return null;
  const group = groups.find(value => value.tasks.some(task => task.id === targetId));
  if (!group) return null;
  const siblings = group.tasks.filter(task => task.id !== sourceId);
  const index = siblings.findIndex(task => task.id === targetId);
  if (index < 0) return null;
  return { section: group.id, beforeTaskId: siblings[index + (after ? 1 : 0)]?.id };
}


export const TaskTimelineList: React.FC<Props> = ({
  dateStr, scrollMode = 'page', tasks, categories, currentUserId, ownerLabels,
  editingTaskId, editValue, onToggleTask, onOpenActions, onOpenMemo, onEditTask,
  onViewImage, onEditChange, onEditSave, onEditCancel, selectionMode = false,
  selectedTaskIds, onToggleTaskSelection, direction, sortBasis, onSortBasisChange,
  onDirectionChange, timestampDisplay, showOtherContentNotice,
  emptyCategoryPrompt, footerCategoryPrompt, granularity, placements,
  onAddTimelineTask, onTimelineMove, onReorderActiveChange, allowReorder,
}) => {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [addCategory, setAddCategory] = useState('');
  const [activeAddGroup, setActiveAddGroup] = useState<TimelineGroupId>('');
  const [newTitle, setNewTitle] = useState('');
  const [saveError, setSaveError] = useState('');
  const [moveError, setMoveError] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState('');
  const [dragProjection, setDragProjection] = useState<HoverProjection | null>(null);
  const acceptedPointerRef = useRef<{ x: number; y: number } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const cancelBlurRef = useRef(false);
  const categoryMap = useMemo(() => new Map(categories.map(category => [category.id, category])), [categories]);
  const assignableCategories = useMemo(() => categories.filter(category =>
    canAddNewTaskToCategory(category, dateStr)), [categories, dateStr]);
  const chosenCategory = assignableCategories.some(category => category.id === addCategory)
    ? addCategory : (assignableCategories[0]?.id ?? '');

  const manual = sortBasis === 'manual';
  const filteredTasks = useMemo(() => tasks.filter(task =>
    (!categoryFilter || task.categoryId === categoryFilter) &&
    (statusFilter === 'all' || (statusFilter === 'complete' ? task.completed : !task.completed))
  ), [tasks, categoryFilter, statusFilter]);
  const groups = useMemo(() => manual
    ? buildTimelineGroups(filteredTasks, placements, granularity)
    : [{ id: 'all' as const, label: '', tasks: sortTasksByTimeline(filteredTasks, direction, sortBasis) }],
    [manual, filteredTasks, placements, granularity, direction, sortBasis]);
  const canReorder = manual && allowReorder && !selectionMode && !editingTaskId &&
    !categoryFilter && statusFilter === 'all';
  // Layout projection is ephemeral: rows animate aside during drag, while
  // persistence remains deferred to a valid pointer/keyboard release.
  const displayGroups = useMemo(() =>
    canReorder && dragProjection && draggedId === dragProjection.taskId
      ? projectTimelineGroups(groups, dragProjection.taskId, dragProjection.section, dragProjection.beforeTaskId)
      : groups, [groups, canReorder, draggedId, dragProjection]);
  const activeAdd = groups.some(group => group.id === activeAddGroup)
    ? activeAddGroup : groups[groups.length - 1]?.id ?? 'all';

  const commitTask = () => {
    const title = newTitle.trim();
    if (!title || !chosenCategory || selectionMode || submittingRef.current) return;
    submittingRef.current = true;
    setSaveError('');
    void Promise.resolve(onAddTimelineTask(title, chosenCategory, dateStr, activeAdd))
      .then(() => {
        submittingRef.current = false;
        setNewTitle(current => current.trim() === title ? '' : current);
      })
      .catch(error => {
        submittingRef.current = false;
        setSaveError(error instanceof Error ? error.message : 'Could not create task');
      });
  };

  const handleDragEnd: NonNullable<React.ComponentProps<typeof DragDropProvider>['onDragEnd']> = event => {
    const sourceId = event.operation.source ? String(event.operation.source.id) : '';
    const releasedTarget = event.operation.target ? String(event.operation.target.id) : '';
    const committedProjection = dragProjection?.taskId === sourceId ? dragProjection : null;
    setDraggedId(null);
    setDragProjection(null);
    setHoverId('');
    acceptedPointerRef.current = null;
    onReorderActiveChange?.(false);
    // An outside/canceled release never saves the last hover position.
    if (event.canceled || !canReorder || !sourceId || !releasedTarget) return;
    const direct = timelineDropTarget(displayGroups, sourceId, releasedTarget);
    const destination = committedProjection ?? (direct ? { taskId: sourceId, ...direct } : null);
    if (!destination || !timelineSectionOptions(granularity).includes(destination.section) ||
        !tasks.some(task => task.id === sourceId)) return;
    setMoveError('');
    void onTimelineMove(sourceId, destination.section, destination.beforeTaskId).catch(error =>
      setMoveError(error instanceof Error ? error.message : 'Could not move task'));
  };

  const renderTask = (task: Props['tasks'][number]) => {
    const category = categoryMap.get(task.categoryId);
    const color = category?.color ?? '#6B7280';
    const row: TaskItemProps = {
      task, categoryColor: color, shareLabel: ownerLabels?.get(task.id), currentUserId,
      onToggle: () => onToggleTask(task.id, task.completed),
      onOpenActions, onOpenMemo, onEditStart: onEditTask, onViewImage,
      isEditing: editingTaskId === task.id, editValue,
      onEditChange, onEditSave, onEditCancel,
      selectionMode, isSelected: selectedTaskIds?.has(task.id),
      onToggleSelection: () => onToggleTaskSelection?.(task.id),
    };
    return (
      <TimelineRow key={task.id} item={row} enabled={canReorder}
        isDragging={draggedId === task.id}
        overBefore={hoverId === 'planner-before:' + task.id}
        overAfter={hoverId === 'planner-after:' + task.id}>
        <div className="ml-9 flex flex-wrap items-center gap-x-2 gap-y-1 pb-1">
          <TaskTimestampMeta task={task} timeline={!manual} sortBasis={sortBasis} display={timestampDisplay}/>
          {category && <button type="button" disabled={selectionMode}
            onClick={() => setCategoryFilter(category.id)}
            className="mosaic-category-pill inline-flex max-w-full select-none items-center gap-1 rounded-full border-0 bg-black px-2.5 py-1 text-[11px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
            aria-label={'Filter by ' + category.name}>
            {visibilityIcon(category.visibility, 10, 'shrink-0 text-gray-400')}
            <span className="truncate" style={{ color: getCategoryLabelColor(category.color) }}>
              {category.name}
            </span>
          </button>}
        </div>
      </TimelineRow>
    );
  };

  return (
    <div data-testid="day-timeline" className={scrollMode === 'contained'
      ? 'min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-4 pb-8'
      : 'w-full min-w-0 px-4 pb-8'}>
      {emptyCategoryPrompt}
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Timeline filters">
        <ListFilter size={16} className="shrink-0 text-secondary" aria-hidden="true" />
        <MosaicSelect value={categoryFilter} onChange={setCategoryFilter}
          label="Filter timeline by category" variant="compact" className="max-w-[55%]"
          options={[{ value: '', label: 'All categories' }, ...categories.map(category => ({
            value: category.id, label: category.name, color: category.color,
            textColor: getCategoryLabelColor(category.color),
          }))]}/>
        <MosaicSelect label="Filter timeline by completion" value={statusFilter}
          onChange={setStatusFilter} variant="compact"
          options={[{ value: 'all', label: 'All tasks' },
            { value: 'open', label: 'Incomplete' }, { value: 'complete', label: 'Completed' }]}/>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Timeline sorting">
        <span className="text-xs text-secondary">Sort by</span>
        <MosaicSelect label="Arrange timeline tasks" value={sortBasis}
          onChange={value => onSortBasisChange(resolveTimelineSortBasis(value))}
          variant="compact" options={[
            { value: 'manual', label: 'Manual' },
            { value: 'completion', label: 'Completed first' },
            { value: 'completion-last', label: 'Completed last' },
            { value: 'creation', label: 'Creation date' },
          ]}/>
        {!manual && <button type="button"
          aria-label={direction === 'desc' ? 'Timeline newest first; switch to oldest' : 'Timeline oldest first; switch to newest'}
          title={direction === 'desc' ? 'Newest first' : 'Oldest first'}
          onClick={() => onDirectionChange(direction === 'desc' ? 'asc' : 'desc')}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full border border-border bg-surfaceHighlight px-2 text-secondary focus-visible:ring-2 focus-visible:ring-accent">
          {direction === 'desc' ? <ArrowDownWideNarrow size={16} aria-hidden="true" /> :
            <ArrowUpNarrowWide size={16} aria-hidden="true" />}
          <span className="text-[11px] font-semibold">{direction === 'desc' ? 'Newest' : 'Oldest'}</span>
        </button>}
      </div>
      {manual && (categoryFilter || statusFilter !== 'all') &&
        <p role="note" className="mb-2 text-xs text-secondary">Clear filters to reorder tasks.</p>}
      {moveError && <p role="alert" className="mb-2 text-xs text-red-400">{moveError}</p>}
      {filteredTasks.length === 0 && !manual &&
        <p className="py-8 text-center text-sm text-secondary">No tasks match the timeline filters.</p>}
      <DragDropProvider sensors={sensors}
        onDragStart={event => {
          const id = event.operation.source ? String(event.operation.source.id) : '';
          if (!canReorder || !tasks.some(task => task.id === id)) return;
          acceptedPointerRef.current = null;
          setDraggedId(id);
          setHoverId('');
          setDragProjection(null);
          onReorderActiveChange?.(true);
        }}
        onDragOver={event => {
          const target = event.operation.target ? String(event.operation.target.id) : '';
          const source = event.operation.source ? String(event.operation.source.id) : '';
          if (!draggedId || draggedId !== source || !canReorder || !target) return;
          const position = event.operation.position.current;
          const last = acceptedPointerRef.current;
          // Moving targets under a stationary pointer must not oscillate the
          // projected layout; unlock after the user moves again.
          if (last && position && Math.abs(last.x - position.x) < 0.5 &&
              Math.abs(last.y - position.y) < 0.5) return;
          const drop = timelineDropTarget(displayGroups, source, target);
          if (!drop) return;
          acceptedPointerRef.current = position ? { x: position.x, y: position.y } : null;
          setHoverId(target);
          setDragProjection(previous =>
            previous?.taskId === source && previous.section === drop.section &&
              previous.beforeTaskId === drop.beforeTaskId
              ? previous : { taskId: source, ...drop });
        }}
        onDragEnd={handleDragEnd}>
        <LayoutGroup>
          <div className="space-y-4">
            {displayGroups.map(group => (
              <section key={group.id || 'unassigned'} aria-label={group.label || 'Chronological timeline'}>
                {manual && granularity !== 'off' && <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {group.label} <span className="ml-1 text-xs font-normal text-secondary">{group.tasks.length}</span>
                  </h3>
                  {!selectionMode && assignableCategories.length > 0 && <button type="button"
                    aria-label={'Add task to ' + group.label}
                    onClick={() => { setActiveAddGroup(group.id); setSaveError(''); requestAnimationFrame(() => inputRef.current?.focus()); }}
                    className="rounded-full p-1 text-secondary focus-visible:ring-2 focus-visible:ring-accent">
                    <Plus size={17} aria-hidden="true" />
                  </button>}
                </div>}
                <div className="space-y-1">{group.tasks.map(renderTask)}</div>
                {manual && <SectionDrop id={group.id} enabled={canReorder}
                  active={hoverId === 'planner-end:' + group.id}>
                  <div aria-hidden="true" className={group.tasks.length ? 'h-3' : 'min-h-7'}/>
                </SectionDrop>}
                {!selectionMode && assignableCategories.length > 0 && activeAdd === group.id && (
                  <form ref={formRef} onSubmit={event => { event.preventDefault(); commitTask(); }}
                    className="mt-3 rounded-2xl border border-border bg-surface px-3 py-3" aria-label="Add timeline task">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <MosaicSelect value={chosenCategory} onChange={setAddCategory}
                        label="New task category" variant="category" className="max-w-[85%]"
                        options={assignableCategories.map(category => ({
                          value: category.id, label: category.name, color: category.color,
                          textColor: getCategoryLabelColor(category.color),
                        }))}/>
                      <span className="shrink-0 text-[11px] text-secondary">
                        {manual && granularity !== 'off' ? group.label : 'Add task'}
                      </span>
                    </div>
                    <div className="flex min-w-0 items-center gap-3">
                      <input ref={inputRef} data-task-inline-input enterKeyHint="done" value={newTitle}
                        onChange={event => setNewTitle(event.target.value)}
                        onBlur={event => {
                          if (cancelBlurRef.current) { cancelBlurRef.current = false; return; }
                          if (event.relatedTarget && formRef.current?.contains(event.relatedTarget)) return;
                          queueMicrotask(() => {
                            if (formRef.current?.contains(document.activeElement)) return;
                            if (formRef.current?.querySelector('[role="combobox"][aria-expanded="true"]')) return;
                            commitTask();
                          });
                        }}
                        onKeyDown={event => {
                          if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
                            if (event.key === 'Enter') event.preventDefault();
                            return;
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            event.stopPropagation();
                            cancelBlurRef.current = true;
                            setNewTitle('');
                            setSaveError('');
                            event.currentTarget.blur();
                          }
                        }}
                        placeholder="New task title" aria-label="New timeline task title"
                        className="min-w-0 flex-1 border-b-2 bg-transparent py-2 text-sm text-foreground outline-none"
                        style={{ borderBottomColor: categoryMap.get(chosenCategory)?.color ?? '#6B7280' }}/>
                      <button type="submit" disabled={!newTitle.trim()} aria-label="Add timeline task"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-black disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-accent">
                        <Plus size={19} aria-hidden="true"/>
                      </button>
                    </div>
                    {saveError && <p role="alert" className="mt-2 text-xs text-red-400">{saveError}</p>}
                  </form>
                )}
              </section>
            ))}
          </div>
        </LayoutGroup>
        <DragOverlay dropAnimation={null}>
          {draggedId && tasks.find(task => task.id === draggedId) && (() => {
            const task = tasks.find(task => task.id === draggedId)!;
            const category = categoryMap.get(task.categoryId);
            return <div aria-hidden="true" style={{ pointerEvents: 'none' }}>
              <TaskItem task={task} categoryColor={category?.color ?? '#6B7280'}
                currentUserId={currentUserId} onToggle={noop} onOpenActions={noop}
                onOpenMemo={noop} onEditStart={noop} onViewImage={noop}
                isEditing={false} editValue="" onEditChange={noop}
                onEditSave={noop} onEditCancel={noop} isDragOverlay disableLayoutAnimation/>
              {category && <span className="mosaic-category-pill ml-9 inline-flex items-center gap-1 rounded-full border-0 bg-black px-2.5 py-1 text-[11px] font-bold">
                {visibilityIcon(category.visibility, 10, 'shrink-0 text-gray-400')}
                <span style={{ color: getCategoryLabelColor(category.color) }}>{category.name}</span>
              </span>}
            </div>;
          })()}
        </DragOverlay>
      </DragDropProvider>
      {showOtherContentNotice && <p className="mt-4 text-center text-xs text-secondary" role="note">
        Diary and shared tasks remain available in Categories view.
      </p>}
      {footerCategoryPrompt}
    </div>
  );
};
