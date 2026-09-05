import React, { useMemo, useRef, useEffect, useState } from 'react';
import { format, addDays, subDays, isToday } from 'date-fns';
import { motion, useAnimation } from 'framer-motion';
import { BottomSheet } from '../../ui/BottomSheet';
import { CategorySection } from './CategorySection';
import { TaskActionSheet } from './TaskActionSheet';
import { MemoSheet } from './MemoSheet';
import { DatePickerSheet } from './DatePickerSheet';
import { useTasks } from '../../../hooks/useTasks';
import { useCategories } from '../../../hooks/useCategories';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';

interface DayViewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onDateChange?: (date: Date) => void;
}

export const DayViewSheet: React.FC<DayViewSheetProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onDateChange
}) => {
  const { tasks, addTask, updateTask, deleteTask, toggleTaskCompletion } = useTasks();
  const { categories } = useCategories();

  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const controls = useAnimation();
  const [isAnimating, setIsAnimating] = useState(false);

  // Sheet State
  const [activeTask, setActiveTask] = useState<TaskDocument | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isMemoSheetOpen, setIsMemoSheetOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Inline Edit State
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !isOpen) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        setWidth(newWidth);
        controls.set({ x: -newWidth });
      }
    });

    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [isOpen, controls]);

  useEffect(() => {
    if (width > 0) {
      controls.set({ x: -width });
    }
  }, [selectedDate, width, controls]);

  const prevDate = subDays(selectedDate, 1);
  const nextDate = addDays(selectedDate, 1);

  const handleDragEnd = (_event: any, info: any) => {
    // Prevent swipe logic if any sub-sheet is open or currently animating
    if (isAnimating || width === 0 || isActionSheetOpen || isMemoSheetOpen || isDatePickerOpen) return;

    const threshold = width / 4;
    const snapTransition = { type: "tween" as const, duration: 0.2, ease: "easeOut" as const };
    const rejectTransition = { type: "tween" as const, duration: 0.15, ease: "easeOut" as const };

    if (info.offset.x < -threshold) {
      setIsAnimating(true);
      controls.start({
        x: -2 * width,
        transition: snapTransition
      }).then(() => {
        onDateChange?.(nextDate);
        controls.set({ x: -width });
        setIsAnimating(false);
      });
    } else if (info.offset.x > threshold) {
      setIsAnimating(true);
      controls.start({
        x: 0,
        transition: snapTransition
      }).then(() => {
        onDateChange?.(prevDate);
        controls.set({ x: -width });
        setIsAnimating(false);
      });
    } else {
      controls.start({
        x: -width,
        transition: rejectTransition
      });
    }
  };

  const handleToggleTask = (taskId: string, currentStatus: boolean) => {
    toggleTaskCompletion(taskId, !currentStatus);
  };

  const handleAddTask = (title: string, categoryId: string) => {
    addTask({
      title,
      categoryId,
      date: format(selectedDate, 'yyyy-MM-dd'),
      completed: false,
      visibility: 'private'
    });
  };

  // Inline Edit Handlers
  const handleStartEdit = (task: TaskDocument) => {
    setEditingTaskId(task.id);
    setEditValue(task.title);
    setIsActionSheetOpen(false);
  };

  const handleEditChange = (value: string) => {
    setEditValue(value);
  };

  const handleEditSave = async () => {
    if (editingTaskId && editValue.trim()) {
      await updateTask(editingTaskId, { title: editValue.trim() });
    }
    setEditingTaskId(null);
    setEditValue('');
  };

  const handleEditCancel = () => {
    setEditingTaskId(null);
    setEditValue('');
  };

  // Action Handlers
  const handleOpenActions = (task: TaskDocument) => {
    if (editingTaskId) return; // Don't open actions while editing
    setActiveTask(task);
    setIsActionSheetOpen(true);
  };

  const handleOpenMemo = (task: TaskDocument) => {
    setActiveTask(task);
    setIsMemoSheetOpen(true);
  };

  const handleDelete = async () => {
    if (activeTask) {
      await deleteTask(activeTask.id);
      setIsActionSheetOpen(false);
      setActiveTask(null);
    }
  };

  const handleMemoSave = async (memo: string, visibility: 'private' | 'followers' | 'public') => {
    if (activeTask) {
      await updateTask(activeTask.id, { memo, visibility });
      setIsMemoSheetOpen(false);
    }
  };

  const handleDateChange = async (newDate: string) => {
    if (activeTask) {
      await updateTask(activeTask.id, { date: newDate });
      setIsDatePickerOpen(false);
    }
  };

  const handleDoItTomorrowOrToday = async () => {
    if (!activeTask) return;

    // FIX: Use actual system date, not the currently viewed selectedDate
    const now = new Date();
    const taskDate = new Date(activeTask.date);

    // Normalize both dates to midnight for accurate comparison
    const todayStr = format(now, 'yyyy-MM-dd');
    const taskDateStr = format(taskDate, 'yyyy-MM-dd');

    let newDate: string;

    if (taskDateStr === todayStr) {
      // Task is actually today -> Move to tomorrow
      newDate = format(addDays(now, 1), 'yyyy-MM-dd');
    } else {
      // Task is NOT today -> Move to today
      newDate = todayStr;
    }

    await updateTask(activeTask.id, { date: newDate });
  };

  const renderDayContent = (date: Date, isCenter: boolean) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayTasks = tasks.filter(t => t.date === dateStr);

    const groupedTasks = useMemo(() => {
      const groups: Record<string, typeof dayTasks> = {};
      dayTasks.forEach(task => {
        if (!groups[task.categoryId]) groups[task.categoryId] = [];
        groups[task.categoryId].push(task);
      });
      return groups;
    }, [dayTasks]);

    if (categories.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500 text-sm px-4">
          Create a category to start adding tasks.
        </div>
      );
    }

    return (
      <div
        className={`pt-2 pb-8 px-1 h-full overflow-y-auto ${!isCenter ? 'pointer-events-none' : ''}`}
        style={{ touchAction: 'pan-y' }}
      >
        {categories.map((category: CategoryDocument) => (
          <CategorySection
            key={category.id}
            categoryName={category.name}
            categoryColor={category.color}
            visibility={category.visibility}
            tasks={groupedTasks[category.id] || []}
            onToggleTask={handleToggleTask}
            onAddTask={(title) => handleAddTask(title, category.id)}
            onOpenActions={handleOpenActions}
            onOpenMemo={handleOpenMemo}
            editingTaskId={editingTaskId}
            editValue={editValue}
            onEditChange={handleEditChange}
            onEditSave={handleEditSave}
            onEditCancel={handleEditCancel}
            onStartEdit={handleStartEdit}
          />
        ))}
      </div>
    );
  };

  const isBackgroundLocked = isActionSheetOpen || isMemoSheetOpen || isDatePickerOpen;

  return (
    <>
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={format(selectedDate, 'EEEE, MMMM d')}
        height="auto"
        isLocked={isBackgroundLocked} // Locks header drag and applies blur when sub-sheets are open
      >
        <div ref={containerRef} className="overflow-hidden w-full">
          {/* FIX: Only transition filter/opacity. Removed 'transition-all' to prevent Framer Motion drag lag */}
          <motion.div
            drag="x"
            dragConstraints={{ left: -2 * width, right: 0 }}
            dragElastic={0.1}
            animate={controls}
            onDragEnd={handleDragEnd}
            className={`flex cursor-grab active:cursor-grabbing transition-[filter,opacity] duration-300 ${isBackgroundLocked ? 'blur-sm opacity-50 pointer-events-none select-none' : ''
              }`}
            style={{ width: width * 3, touchAction: 'pan-y' }}
          >
            <div style={{ width }} className="flex-shrink-0 opacity-60">
              {renderDayContent(prevDate, false)}
            </div>

            <div style={{ width }} className="flex-shrink-0">
              {renderDayContent(selectedDate, true)}
            </div>

            <div style={{ width }} className="flex-shrink-0 opacity-60">
              {renderDayContent(nextDate, false)}
            </div>
          </motion.div>
        </div>
      </BottomSheet>

      {/* Task Action Sheet */}
      <TaskActionSheet
        isOpen={isActionSheetOpen}
        onClose={() => setIsActionSheetOpen(false)}
        task={activeTask}
        onEdit={() => activeTask && handleStartEdit(activeTask)}
        onDelete={handleDelete}
        onMemo={() => setIsMemoSheetOpen(true)}
        onChangeDate={() => setIsDatePickerOpen(true)}
        onDoItTomorrowOrToday={handleDoItTomorrowOrToday}
      />

      {/* Memo Sheet */}
      <MemoSheet
        isOpen={isMemoSheetOpen}
        onClose={() => setIsMemoSheetOpen(false)}
        task={activeTask}
        onSave={handleMemoSave}
      />

      {/* Date Picker Sheet */}
      <DatePickerSheet
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        task={activeTask}
        onDateChange={handleDateChange}
      />
    </>
  );
};