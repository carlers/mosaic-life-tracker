import React, { useState, useRef, useId } from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import { PointerActivationConstraints, PointerSensor } from '@dnd-kit/dom';
import { isSortable } from '@dnd-kit/react/sortable';
import { ChevronDown, Plus } from 'lucide-react';
import { TaskItem } from './TaskItem';
import { SortableTaskItem } from './SortableTaskItem';
import { visibilityIcon } from '../../../lib/visibility';
import { getCategoryLabelColor } from '../../../constants/colors';
import type { TaskDocument } from '../../../db/schema';

type Visibility = 'private' | 'followers' | 'public';

const TASK_REORDER_POINTER_SENSOR = PointerSensor.configure({
  activationConstraints: [
    new PointerActivationConstraints.Delay({
      value: 500,
      tolerance: 8,
    }),
  ],
});

interface PendingTaskOrder {
  ids: string[];
  signature: string;
}

interface CategorySectionProps {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  visibility?: Visibility;
  currentUserId: string;
  tasks: TaskDocument[];
  onToggleTask: (taskId: string, currentStatus: boolean) => void;
  onAddTask: (title: string) => void;
  onOpenActions: (task: TaskDocument) => void;
  onOpenMemo: (task: TaskDocument, mode: 'view' | 'edit') => void;
  onEditTask: (task: TaskDocument) => void;
  onViewImage?: (task: TaskDocument) => void;
  editingTaskId: string | null;
  editValue: string;
  onEditChange: (value: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  disableTaskLayoutAnimation?: boolean;
  continueAddingAfterSubmit?: boolean;
  showCollapseButton?: boolean;
  selectionMode?: boolean;
  selectedTaskIds?: ReadonlySet<string>;
  onToggleTaskSelection?: (taskId: string) => void;
  reorderEnabled?: boolean;
  onReorderTasks?: (tasks: readonly TaskDocument[]) => Promise<void> | void;
  onReorderActiveChange?: (active: boolean) => void;
}

export const CategorySection: React.FC<CategorySectionProps> = ({
  categoryId,
  categoryName,
  categoryColor,
  visibility,
  currentUserId,
  tasks,
  onToggleTask,
  onAddTask,
  onOpenActions,
  onOpenMemo,
  onEditTask,
  onViewImage,
  editingTaskId,
  editValue,
  onEditChange,
  onEditSave,
  onEditCancel,
  disableTaskLayoutAnimation = false,
  continueAddingAfterSubmit = false,
  showCollapseButton = false,
  selectionMode = false,
  selectedTaskIds = new Set<string>(),
  onToggleTaskSelection,
  reorderEnabled = false,
  onReorderTasks,
  onReorderActiveChange,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [pendingOrder, setPendingOrder] = useState<PendingTaskOrder | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const setInputRef = (node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (node) {
      node.focus();
    }
  };

  const closeInput = () => {
    setNewTitle('');
    setIsAdding(false);
  };

  const commitAdd = () => {
    const trimmed = newTitle.trim();
    if (trimmed) {
      onAddTask(trimmed);
      if (continueAddingAfterSubmit) {
        setNewTitle('');
      } else {
        closeInput();
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitAdd();
    } else if (e.key === 'Escape') {
      closeInput();
    }
  };

  const handleBlur = () => {
    if (!newTitle.trim()) {
      closeInput();
    }
  };

  const handleOpen = () => {
    setIsCollapsed(false);
    setIsAdding(true);
  };

  const categoryCollapsed = showCollapseButton && isCollapsed;
  const liveIds = tasks.map((task) => task.id);
  const liveSignature = liveIds.join('\0');
  const canUsePending =
    pendingOrder !== null &&
    pendingOrder.ids.length === liveIds.length &&
    pendingOrder.ids.every((id) => liveIds.includes(id));

  let orderedTasks = tasks;
  if (pendingOrder && canUsePending && liveSignature !== pendingOrder.signature) {
    const latestById = new Map(tasks.map((task) => [task.id, task]));
    orderedTasks = pendingOrder.ids.flatMap((id) => {
      const task = latestById.get(id);
      return task ? [task] : [];
    });
  } else if (pendingOrder) {
    setPendingOrder(null);
  }

  const canReorder =
    reorderEnabled &&
    !selectionMode &&
    !isAdding &&
    editingTaskId === null &&
    !!onReorderTasks;

  const handleDragEnd = (event: Parameters<
    NonNullable<React.ComponentProps<typeof DragDropProvider>['onDragEnd']>
  >[0]) => {
    onReorderActiveChange?.(false);
    if (event.canceled) return;

    const { source } = event.operation;
    if (!isSortable(source) || source.initialIndex === source.index) return;
    if (
      source.initialIndex < 0 ||
      source.index < 0 ||
      source.initialIndex >= orderedTasks.length ||
      source.index >= orderedTasks.length
    ) {
      return;
    }

    const next = [...orderedTasks];
    const [moved] = next.splice(source.initialIndex, 1);
    if (!moved) return;
    next.splice(source.index, 0, moved);

    const ids = next.map((task) => task.id);
    const optimistic: PendingTaskOrder = {
      ids,
      signature: ids.join('\0'),
    };
    setPendingOrder(optimistic);

    void Promise.resolve(onReorderTasks?.(next)).catch(() => {
      setPendingOrder((current) =>
        current?.signature === optimistic.signature ? null : current
      );
    });
  };

  const taskProps = (task: TaskDocument) => ({
    task,
    categoryColor,
    currentUserId,
    onToggle: () => onToggleTask(task.id, task.completed),
    onOpenActions,
    onOpenMemo,
    onEditStart: onEditTask,
    onViewImage,
    isEditing: editingTaskId === task.id,
    editValue,
    onEditChange,
    onEditSave,
    onEditCancel,
    disableLayoutAnimation: disableTaskLayoutAnimation,
    selectionMode,
    isSelected: selectedTaskIds.has(task.id),
    onToggleSelection: () => onToggleTaskSelection?.(task.id),
  });

  const handleToggleCollapse = () => {
    if (!categoryCollapsed) {
      closeInput();
    }
    setIsCollapsed((current) => !current);
  };

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={handleOpen}
          disabled={selectionMode}
          className="inline-flex items-center gap-2 bg-black rounded-full pl-3.5 pr-3 py-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          aria-label={`Add a task to ${categoryName}`}
        >
          {visibility && visibilityIcon(visibility, 12, 'text-gray-400')}
          <span
            className="text-[0.9375rem] font-bold"
            style={{ color: getCategoryLabelColor(categoryColor) }}
          >
            {categoryName}
          </span>
          <span className="text-gray-400" aria-hidden="true">
            <Plus data-testid="category-add-icon" size={18} />
          </span>
        </button>
        {showCollapseButton && (
          <button
            type="button"
          onClick={handleToggleCollapse}
          disabled={selectionMode}
            aria-label={categoryCollapsed ? `Expand ${categoryName}` : `Collapse ${categoryName}`}
            aria-expanded={!categoryCollapsed}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-[#2A2A2A] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <ChevronDown
              size={17}
              aria-hidden="true"
              className={`transition-transform ${categoryCollapsed ? '-rotate-90' : ''}`}
            />
          </button>
        )}
      </div>

      {!categoryCollapsed && isAdding && (
        <div
          data-testid="pending-task-row"
          className="flex items-center gap-3 py-2"
        >
          <span
            data-testid="pending-task-checkbox"
            aria-hidden="true"
            className="shrink-0 h-6 w-6 rounded-full border-2"
            style={{ borderColor: categoryColor }}
          />
          <label htmlFor={inputId} className="sr-only">
            New task title
          </label>
          <input
            id={inputId}
            ref={setInputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={`Add a task to ${categoryName}...`}
            className="min-w-0 flex-1 bg-transparent text-white outline-none border-b text-sm"
            style={{ borderBottomColor: categoryColor }}
          />
        </div>
      )}

      {!categoryCollapsed && (
        canReorder ? (
          <DragDropProvider
            sensors={(defaults) => [
              ...defaults.filter((sensor) => sensor !== PointerSensor),
              TASK_REORDER_POINTER_SENSOR,
            ]}
            onDragStart={() => onReorderActiveChange?.(true)}
            onDragEnd={handleDragEnd}
          >
            {orderedTasks.map((task, index) => (
              <SortableTaskItem
                key={task.id}
                {...taskProps(task)}
                index={index}
                group={categoryId}
                reorderEnabled
              />
            ))}
          </DragDropProvider>
        ) : (
          orderedTasks.map((task) => (
            <TaskItem key={task.id} {...taskProps(task)} />
          ))
        )
      )}
    </div>
  );
};
