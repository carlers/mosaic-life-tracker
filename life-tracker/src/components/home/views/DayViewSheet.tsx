import React, { useMemo, useRef, useEffect, useState } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { BottomSheet } from '../../ui/BottomSheet';
import { CategorySection } from './CategorySection';
import { TaskActionSheet } from './TaskActionSheet';
import { MemoSheet } from './MemoSheet';
import { DatePickerSheet } from './DatePickerSheet';
import { ImageViewer } from './ImageViewer';
import { useTasks } from '../../../hooks/useTasks';
import { useCategories } from '../../../hooks/useCategories';
import { useTaskImage } from '../../../hooks/useTaskImage';
import { deleteImage } from '../../../lib/storage';
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
  const [viewingTask, setViewingTask] = useState<TaskDocument | null>(null);
  
  // Fetch image URL for the viewer
  const viewingImageUrl = useTaskImage(viewingTask?.image).imageUrl;

  // Delete Photo Confirmation State
  const [isDeletePhotoConfirmOpen, setIsDeletePhotoConfirmOpen] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<string | null>(null);

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

  useEffect(() => {
    if (deleteFeedback) {
      const timer = setTimeout(() => setDeleteFeedback(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [deleteFeedback]);

  const prevDate = subDays(selectedDate, 1);
  const nextDate = addDays(selectedDate, 1);

  const handleDragEnd = (_event: any, info: any) => {
    if (isAnimating || width === 0 || isActionSheetOpen || isMemoSheetOpen || isDatePickerOpen || viewingTask || isDeletePhotoConfirmOpen) return;
    const threshold = width / 4;
    const snapTransition = { type: "tween" as const, duration: 0.2, ease: "easeOut" as const };
    const rejectTransition = { type: "tween" as const, duration: 0.15, ease: "easeOut" as const };
    
    if (info.offset.x < -threshold) {
      setIsAnimating(true);
      controls.start({ x: -2 * width, transition: snapTransition }).then(() => {
        onDateChange?.(nextDate);
        controls.set({ x: -width });
        setIsAnimating(false);
      });
    } else if (info.offset.x > threshold) {
      setIsAnimating(true);
      controls.start({ x: 0, transition: snapTransition }).then(() => {
        onDateChange?.(prevDate);
        controls.set({ x: -width });
        setIsAnimating(false);
      });
    } else {
      controls.start({ x: -width, transition: rejectTransition });
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

  const handleStartEdit = (task: TaskDocument) => {
    setEditingTaskId(task.id);
    setEditValue(task.title);
    setIsActionSheetOpen(false);
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

  const handleOpenActions = (task: TaskDocument) => {
    if (editingTaskId) return;
    setActiveTask(task);
    setIsActionSheetOpen(true);
  };

  const handleOpenMemo = (task: TaskDocument) => {
    setActiveTask(task);
    setIsMemoSheetOpen(true);
  };

  const handleDelete = async () => {
    if (activeTask) {
      if (activeTask.image) await deleteImage(activeTask.image);
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
    const now = new Date();
    const taskDate = new Date(activeTask.date);
    const todayStr = format(now, 'yyyy-MM-dd');
    const taskDateStr = format(taskDate, 'yyyy-MM-dd');
    const newDate = taskDateStr === todayStr ? format(addDays(now, 1), 'yyyy-MM-dd') : todayStr;
    await updateTask(activeTask.id, { date: newDate });
  };

  const handleRequestDeletePhoto = () => {
    setIsActionSheetOpen(false);
    setIsDeletePhotoConfirmOpen(true);
  };

  const handleConfirmDeletePhoto = async () => {
    if (!activeTask?.image) return;
    setIsDeletingPhoto(true);
    try {
      await deleteImage(activeTask.image);
      await updateTask(activeTask.id, { image: '' });
      setDeleteFeedback('Photo deleted');
      setActiveTask(prev => prev ? { ...prev, image: '' } : null);
      setIsDeletePhotoConfirmOpen(false);
    } catch (err) {
      console.error('[DayViewSheet] Failed to delete photo:', err);
      setDeleteFeedback('Failed to delete photo');
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const handleCancelDeletePhoto = () => {
    setIsDeletePhotoConfirmOpen(false);
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
      <div className={`pt-2 pb-8 px-1 h-full overflow-y-auto ${!isCenter ? 'pointer-events-none' : ''}`} style={{ touchAction: 'pan-y' }}>
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
            onViewImage={setViewingTask}
            editingTaskId={editingTaskId}
            editValue={editValue}
            onEditChange={(val) => setEditValue(val)}
            onEditSave={handleEditSave}
            onEditCancel={handleEditCancel}
          />
        ))}
      </div>
    );
  };

  const isBackgroundLocked = isActionSheetOpen || isMemoSheetOpen || isDatePickerOpen || !!viewingTask || isDeletePhotoConfirmOpen;

  return (
    <>
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={format(selectedDate, 'EEEE, MMMM d')}
        height="auto"
        isLocked={isBackgroundLocked}
      >
        <div ref={containerRef} className="overflow-hidden w-full">
          <motion.div
            drag="x"
            dragConstraints={{ left: -2 * width, right: 0 }}
            dragElastic={0.1}
            animate={controls}
            onDragEnd={handleDragEnd}
            className={`flex cursor-grab active:cursor-grabbing transition-[filter,opacity] duration-300 ${
              isBackgroundLocked ? 'blur-sm opacity-50 pointer-events-none select-none' : ''
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

      <TaskActionSheet 
        isOpen={isActionSheetOpen}
        onClose={() => setIsActionSheetOpen(false)}
        task={activeTask}
        onEdit={() => activeTask && handleStartEdit(activeTask)}
        onDelete={handleDelete}
        onMemo={() => setIsMemoSheetOpen(true)}
        onChangeDate={() => setIsDatePickerOpen(true)}
        onViewPhoto={() => {
          if (activeTask) setViewingTask(activeTask);
          setIsActionSheetOpen(false);
        }}
        onDeletePhoto={handleRequestDeletePhoto}
        onDoItTomorrowOrToday={handleDoItTomorrowOrToday}
      />

      <MemoSheet
        isOpen={isMemoSheetOpen}
        onClose={() => setIsMemoSheetOpen(false)}
        task={activeTask}
        onSave={handleMemoSave}
      />

      <DatePickerSheet
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        task={activeTask}
        onDateChange={handleDateChange}
      />

      {/* PhotoSwipe Viewer */}
      <ImageViewer
        isOpen={!!viewingTask}
        imageUrl={viewingImageUrl}
        taskTitle={viewingTask?.title}
        taskDate={viewingTask?.createdAt ? format(new Date(viewingTask.createdAt), 'MMM d, yyyy') : undefined}
        onClose={() => setViewingTask(null)}
      />

      {/* Delete Photo Confirmation */}
      <BottomSheet
        isOpen={isDeletePhotoConfirmOpen}
        onClose={handleCancelDeletePhoto}
        title="Delete Photo"
        height="auto"
        isLocked={true}
      >
        <div className="pt-2 pb-8 px-4">
          <p className="text-gray-300 text-sm text-center mb-6 leading-relaxed">
            Are you sure you want to delete this photo? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleCancelDeletePhoto}
              disabled={isDeletingPhoto}
              className="flex-1 py-3 bg-[#2A2A2A] rounded-xl text-white font-medium hover:bg-[#333333] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDeletePhoto}
              disabled={isDeletingPhoto}
              className="flex-1 py-3 bg-red-500 rounded-xl text-white font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeletingPhoto ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </button>
          </div>
        </div>
      </BottomSheet>

      <AnimatePresence>
        {deleteFeedback && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] border border-[#444444] text-white text-sm px-5 py-2.5 rounded-full shadow-lg backdrop-blur-md"
          >
            {deleteFeedback}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};