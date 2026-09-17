import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { format, addDays, differenceInCalendarDays, startOfDay } from 'date-fns';
import { Swiper, SwiperSlide } from 'swiper/react';
import type { Swiper as SwiperClass } from 'swiper';
import 'swiper/css';
import { AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BottomSheet } from '../../ui/BottomSheet';
import { ConfirmSheet } from '../../ui/ConfirmSheet';
import { CategorySection } from './CategorySection';
import { TaskActionSheet } from './TaskActionSheet';
import { MemoSheet } from './MemoSheet';
import { DatePickerSheet } from './DatePickerSheet';
import { ImageViewer } from './ImageViewer';
import { ImagePickerSheet } from './ImagePickerSheet';
import { TaskVisibilitySheet } from './TaskVisibilitySheet';
import { useTasks } from '../../../hooks/useTasks';
import { useCategories } from '../../../hooks/useCategories';
import { useAuth } from '../../../hooks/useAuth';
import { useTaskImage } from '../../../hooks/useTaskImage';
import { useFeedback } from '../../../hooks/useFeedback';
import { deleteImage } from '../../../lib/storage';
import { EMPTY_TASKS } from '../../../constants/empty';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';

interface DayViewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onDateChange?: (date: Date) => void;
}

const SWIPE_RANGE = 90;
const TOTAL_SLIDES = SWIPE_RANGE * 2 + 1;
const RENDER_WINDOW = 3;

interface DaySlideProps {
  date: Date;
  dateStr: string;
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  currentUserId: string;
  editingTaskId: string | null;
  editValue: string;
  onToggleTask: (taskId: string, currentStatus: boolean) => void;
  onAddTask: (title: string, categoryId: string, dateStr: string) => void;
  onOpenActions: (task: TaskDocument) => void;
  onOpenMemo: (task: TaskDocument) => void;
  onViewImage: (task: TaskDocument) => void;
  onEditChange: (val: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

const DaySlide = React.memo(
  ({
    date,
    dateStr,
    tasks,
    categories,
    currentUserId,
    editingTaskId,
    editValue,
    onToggleTask,
    onAddTask,
    onOpenActions,
    onOpenMemo,
    onViewImage,
    onEditChange,
    onEditSave,
    onEditCancel,
  }: DaySlideProps) => {
    const groupedTasks = useMemo(() => {
      const map: Record<string, TaskDocument[]> = {};
      for (const task of tasks) {
        (map[task.categoryId] ||= []).push(task);
      }
      return map;
    }, [tasks]);

    const headerLabel = useMemo(() => format(date, 'EEEE, MMMM d'), [date]);

    return (
      <div className="w-full">
        <div className="px-4 pt-3 pb-2 select-none">
          <h2 className="text-white text-lg font-semibold tracking-tight">
            {headerLabel}
          </h2>
        </div>
        <div className="pt-1 pb-8 px-1">
          {categories.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm px-4">
              Create a category to start adding tasks.
            </div>
          ) : (
            categories.map((category: CategoryDocument) => (
              <CategorySection
                key={category.id}
                categoryName={category.name}
                categoryColor={category.color}
                visibility={category.visibility}
                currentUserId={currentUserId}
                tasks={groupedTasks[category.id] || EMPTY_TASKS}
                onToggleTask={onToggleTask}
                onAddTask={(title) => onAddTask(title, category.id, dateStr)}
                onOpenActions={onOpenActions}
                onOpenMemo={onOpenMemo}
                onViewImage={onViewImage}
                editingTaskId={editingTaskId}
                editValue={editValue}
                onEditChange={onEditChange}
                onEditSave={onEditSave}
                onEditCancel={onEditCancel}
              />
            ))
          )}
        </div>
      </div>
    );
  }
);
DaySlide.displayName = 'DaySlide';

export const DayViewSheet: React.FC<DayViewSheetProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onDateChange,
}) => {
  const { tasks, addTask, updateTask, deleteTask, toggleTaskCompletion } =
    useTasks();
  const { categories } = useCategories();
  const { user } = useAuth();
  const currentUserId = user?.$id ?? '';

  const swiperRef = useRef<SwiperClass | null>(null);
  const isProgrammaticMoveRef = useRef(false);
  const wasOpenRef = useRef(false);
  const selectedDateRef = useRef(selectedDate);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  const [anchorDate, setAnchorDate] = useState(() => startOfDay(selectedDate));
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setAnchorDate(startOfDay(selectedDate));
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, selectedDate]);

  const slideDates = useMemo(
    () =>
      Array.from({ length: TOTAL_SLIDES }, (_, i) =>
        addDays(anchorDate, i - SWIPE_RANGE)
      ),
    [anchorDate]
  );

  const slideDateStrs = useMemo(
    () => slideDates.map((d) => format(d, 'yyyy-MM-dd')),
    [slideDates]
  );

  const initialIndex = useMemo(() => {
    const offset = differenceInCalendarDays(selectedDate, anchorDate);
    return Math.min(TOTAL_SLIDES - 1, Math.max(0, offset + SWIPE_RANGE));
  }, [selectedDate, anchorDate]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [prevInitialIndex, setPrevInitialIndex] = useState(initialIndex);
  if (prevInitialIndex !== initialIndex) {
    setPrevInitialIndex(initialIndex);
    setActiveIndex(initialIndex);
  }

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskDocument[]>();
    for (const t of tasks) {
      const arr = map.get(t.date);
      if (arr) arr.push(t);
      else map.set(t.date, [t]);
    }
    return map;
  }, [tasks]);

  useEffect(() => {
    if (!isOpen) return;
    const s = swiperRef.current;
    if (!s) return;
    const offset = differenceInCalendarDays(selectedDate, anchorDate);
    const targetIndex = offset + SWIPE_RANGE;
    if (targetIndex < 0 || targetIndex >= TOTAL_SLIDES) return;
    if (s.activeIndex === targetIndex) return;
    isProgrammaticMoveRef.current = true;
    s.slideTo(targetIndex, 0);
    const raf = requestAnimationFrame(() => {
      isProgrammaticMoveRef.current = false;
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen, selectedDate, anchorDate]);

  const [activeTask, setActiveTask] = useState<TaskDocument | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isMemoSheetOpen, setIsMemoSheetOpen] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isVisibilitySheetOpen, setIsVisibilitySheetOpen] = useState(false);
  const [viewingTask, setViewingTask] = useState<TaskDocument | null>(null);
  const [imagePickerTask, setImagePickerTask] = useState<TaskDocument | null>(null);
  const viewingImageUrl = useTaskImage(viewingTask?.image).imageUrl;
  const [isDeletePhotoConfirmOpen, setIsDeletePhotoConfirmOpen] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const { message: deleteFeedback, show: showDeleteFeedback } = useFeedback();
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const activeTaskCategory = useMemo(() => {
    if (!activeTask) return null;
    return categories.find((c) => c.id === activeTask.categoryId) || null;
  }, [activeTask, categories]);

  // ----- Stable handlers -----
  const handleToggleTask = useCallback(
    (taskId: string, currentStatus: boolean) => {
      toggleTaskCompletion(taskId, !currentStatus);
    },
    [toggleTaskCompletion]
  );

  const handleAddTask = useCallback(
    (title: string, categoryId: string, dateStr: string) => {
      addTask({
        title,
        categoryId,
        date: dateStr,
        completed: false,
        visibility: '',
      });
    },
    [addTask]
  );

  const handleStartEdit = useCallback((task: TaskDocument) => {
    setEditingTaskId(task.id);
    setEditValue(task.title);
    setIsActionSheetOpen(false);
  }, []);

  const handleEditSave = useCallback(async () => {
    if (editingTaskId && editValue.trim()) {
      await updateTask(editingTaskId, { title: editValue.trim() });
    }
    setEditingTaskId(null);
    setEditValue('');
  }, [editingTaskId, editValue, updateTask]);

  const handleEditCancel = useCallback(() => {
    setEditingTaskId(null);
    setEditValue('');
  }, []);

  const handleOpenActions = useCallback((task: TaskDocument) => {
    setActiveTask(task);
    setIsActionSheetOpen(true);
  }, []);

  const handleOpenMemo = useCallback((task: TaskDocument) => {
    setActiveTask(task);
    setIsMemoSheetOpen(true);
  }, []);

  const handleViewImage = useCallback((task: TaskDocument) => {
    setViewingTask(task);
  }, []);

  const handleDelete = async () => {
    if (activeTask) {
      if (activeTask.image) await deleteImage(activeTask.image);
      await deleteTask(activeTask.id);
      setIsActionSheetOpen(false);
      setActiveTask(null);
    }
  };

  const handleMemoSave = async (
    memo: string,
    visibility: 'private' | 'followers' | 'public'
  ) => {
    if (activeTask) {
      await updateTask(activeTask.id, { memo, visibility });
      setIsMemoSheetOpen(false);
    }
  };

  const handleVisibilitySave = useCallback(
    async (visibility: '' | 'private' | 'followers' | 'public') => {
      if (activeTask) {
        await updateTask(activeTask.id, { visibility });
      }
    },
    [activeTask, updateTask]
  );

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
    const newDate =
      taskDateStr === todayStr ? format(addDays(now, 1), 'yyyy-MM-dd') : todayStr;
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
      showDeleteFeedback('Photo deleted');
      setActiveTask((prev) => (prev ? { ...prev, image: '' } : null));
      setIsDeletePhotoConfirmOpen(false);
    } catch (err) {
      console.error('[DayViewSheet] Failed to delete photo:', err);
      showDeleteFeedback('Failed to delete photo');
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const handleCancelDeletePhoto = () => {
    setIsDeletePhotoConfirmOpen(false);
  };

  const handleAddPhoto = useCallback((task: TaskDocument) => {
    setImagePickerTask(task);
    setIsActionSheetOpen(false);
  }, []);

  const handleImageSaved = useCallback(
    async (fileId: string) => {
      if (imagePickerTask) {
        await updateTask(imagePickerTask.id, { image: fileId });
      }
    },
    [imagePickerTask, updateTask]
  );

  const handleImageRemoved = useCallback(async () => {
    if (imagePickerTask) {
      await updateTask(imagePickerTask.id, { image: '' });
    }
  }, [imagePickerTask, updateTask]);

  const isBackgroundLocked =
    isActionSheetOpen ||
    isMemoSheetOpen ||
    isDatePickerOpen ||
    isVisibilitySheetOpen ||
    !!viewingTask ||
    isDeletePhotoConfirmOpen ||
    !!imagePickerTask;

  const handleSwipeSettled = useCallback(
    (s: SwiperClass) => {
      setActiveIndex(s.activeIndex);
      if (isProgrammaticMoveRef.current) return;
      const date = slideDates[s.activeIndex];
      if (!date) return;
      if (differenceInCalendarDays(date, selectedDateRef.current) !== 0) {
        onDateChange?.(date);
      }
    },
    [slideDates, onDateChange]
  );

  const handlePrevDay = useCallback(() => {
    if (isBackgroundLocked) return;
    const s = swiperRef.current;
    if (!s) return;
    const target = Math.max(0, s.activeIndex - 1);
    if (target === s.activeIndex) return;
    isProgrammaticMoveRef.current = true;
    s.slideTo(target, 240);
    const raf = requestAnimationFrame(() => {
      isProgrammaticMoveRef.current = false;
    });
    const date = slideDates[target];
    if (date) onDateChange?.(date);
    return () => cancelAnimationFrame(raf);
  }, [isBackgroundLocked, slideDates, onDateChange]);

  const handleNextDay = useCallback(() => {
    if (isBackgroundLocked) return;
    const s = swiperRef.current;
    if (!s) return;
    const target = Math.min(TOTAL_SLIDES - 1, s.activeIndex + 1);
    if (target === s.activeIndex) return;
    isProgrammaticMoveRef.current = true;
    s.slideTo(target, 240);
    const raf = requestAnimationFrame(() => {
      isProgrammaticMoveRef.current = false;
    });
    const date = slideDates[target];
    if (date) onDateChange?.(date);
    return () => cancelAnimationFrame(raf);
  }, [isBackgroundLocked, slideDates, onDateChange]);

  const slides = useMemo(() => {
    return slideDates.map((date, i) => {
      const dateStr = slideDateStrs[i];
      const inWindow = Math.abs(i - activeIndex) <= RENDER_WINDOW;
      return (
        <SwiperSlide key={dateStr}>
          {inWindow ? (
            <DaySlide
              date={date}
              dateStr={dateStr}
              tasks={tasksByDate.get(dateStr) ?? EMPTY_TASKS}
              categories={categories}
              currentUserId={currentUserId}
              editingTaskId={editingTaskId}
              editValue={editValue}
              onToggleTask={handleToggleTask}
              onAddTask={handleAddTask}
              onOpenActions={handleOpenActions}
              onOpenMemo={handleOpenMemo}
              onViewImage={handleViewImage}
              onEditChange={setEditValue}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          ) : null}
        </SwiperSlide>
      );
    });
  }, [
    slideDates,
    slideDateStrs,
    activeIndex,
    tasksByDate,
    categories,
    currentUserId,
    editingTaskId,
    editValue,
    handleToggleTask,
    handleAddTask,
    handleOpenActions,
    handleOpenMemo,
    handleViewImage,
    handleEditSave,
    handleEditCancel,
  ]);

  return (
    <>
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        height="full"
        isLocked={isBackgroundLocked}
      >
        <div
          className={`w-full h-full flex flex-col transition-opacity duration-300 ${
            isBackgroundLocked ? 'opacity-50 pointer-events-none select-none' : ''
          }`}
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#333333] flex-shrink-0">
            <button
              type="button"
              onClick={handlePrevDay}
              disabled={isBackgroundLocked}
              className="p-1.5 rounded-lg bg-[#1E1E1E] border border-[#333333] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
              aria-label="Previous day"
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span className="text-xs text-gray-500" aria-hidden="true">
              Swipe or use arrows to change day
            </span>
            <button
              type="button"
              onClick={handleNextDay}
              disabled={isBackgroundLocked}
              className="p-1.5 rounded-lg bg-[#1E1E1E] border border-[#333333] text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
              aria-label="Next day"
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
          <Swiper
            className="flex-1 min-h-0 w-full"
            onSwiper={(s) => {
              swiperRef.current = s;
            }}
            initialSlide={initialIndex}
            slidesPerView={1}
            spaceBetween={0}
            speed={320}
            resistanceRatio={0.85}
            threshold={3}
            touchRatio={1}
            followFinger
            longSwipes
            longSwipesRatio={0.35}
            longSwipesMs={250}
            shortSwipes
            allowTouchMove={!isBackgroundLocked}
            onSlideChangeTransitionEnd={handleSwipeSettled}
          >
            {slides}
          </Swiper>
        </div>
      </BottomSheet>
      <TaskActionSheet
        isOpen={isActionSheetOpen}
        onClose={() => setIsActionSheetOpen(false)}
        task={activeTask}
        category={activeTaskCategory}
        onEdit={() => activeTask && handleStartEdit(activeTask)}
        onDelete={handleDelete}
        onMemo={() => setIsMemoSheetOpen(true)}
        onChangeDate={() => setIsDatePickerOpen(true)}
        onVisibility={() => setIsVisibilitySheetOpen(true)}
        onAddPhoto={() => activeTask && handleAddPhoto(activeTask)}
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
      <TaskVisibilitySheet
        isOpen={isVisibilitySheetOpen}
        onClose={() => setIsVisibilitySheetOpen(false)}
        task={activeTask}
        category={activeTaskCategory}
        onSave={handleVisibilitySave}
      />
      <DatePickerSheet
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        task={activeTask}
        onDateChange={handleDateChange}
      />
      <ImagePickerSheet
        isOpen={!!imagePickerTask}
        onClose={() => setImagePickerTask(null)}
        variant="task"
        hasExistingImage={!!imagePickerTask?.image}
        title="Add Photo"
        onSave={handleImageSaved}
        onRemove={handleImageRemoved}
      />
      <ImageViewer
        isOpen={!!viewingTask}
        imageUrl={viewingImageUrl}
        taskTitle={viewingTask?.title}
        taskDate={
          viewingTask?.createdAt
            ? format(new Date(viewingTask.createdAt), 'MMM d, yyyy')
            : undefined
        }
        onClose={() => setViewingTask(null)}
      />
      <ConfirmSheet
        isOpen={isDeletePhotoConfirmOpen}
        onClose={handleCancelDeletePhoto}
        title="Delete Photo"
        message="Are you sure you want to delete this photo? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        isProcessing={isDeletingPhoto}
        processingLabel="Deleting..."
        onConfirm={handleConfirmDeletePhoto}
      />
      <AnimatePresence>
        {deleteFeedback && (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] border border-[#444444] text-white text-sm px-5 py-2.5 rounded-full shadow-lg backdrop-blur-md"
          >
            {deleteFeedback}
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
