import React, { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Swiper, SwiperSlide } from 'swiper/react';
import { AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BottomSheet } from '../../ui/BottomSheet';
import { ConfirmSheet } from '../../ui/ConfirmSheet';
import { DaySlide } from './DaySlide';
import { TaskActionSheet } from './TaskActionSheet';
import { MemoSheet } from './MemoSheet';
import { DatePickerSheet } from './DatePickerSheet';
import { ImagePickerSheet } from './ImagePickerSheet';
import { TaskVisibilitySheet } from './TaskVisibilitySheet';
import { useTasks } from '../../../hooks/useTasks';
import { useCategories } from '../../../hooks/useCategories';
import { useAuth } from '../../../hooks/useAuth';
import { useTaskImage } from '../../../hooks/useTaskImage';
import { useFeedback } from '../../../hooks/useFeedback';
import { useTasksByDate } from '../../../hooks/useTasksByDate';
import { useDayViewSwiper } from './useDayViewSwiper';
import { deleteImage } from '../../../lib/storage';
import { EMPTY_TASKS } from '../../../constants/empty';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';
import { Spinner } from '../../ui/Spinner';
import { useHorizontalArrowNavigation } from '../../../hooks/useHorizontalArrowNavigation';

const ImageViewer = lazy(() =>
  import('./ImageViewer').then(({ ImageViewer }) => ({ default: ImageViewer }))
);

interface DayViewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onDateChange?: (date: Date) => void;
  renderMode?: 'sheet' | 'inline';
  tasks?: TaskDocument[];
  categories?: CategoryDocument[];
}

export const DayViewSheet: React.FC<DayViewSheetProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onDateChange,
  renderMode = 'sheet',
  tasks: tasksOverride,
  categories: categoriesOverride,
}) => {
  const { user } = useAuth();
  const currentUserId = user?.$id ?? '';

  const taskStore = useTasks();
  const {
    addTask,
    toggleTaskCompletion,
    updateTask,
    deleteTask,
  } = taskStore;
  const { categories: hookCategories = [] } = useCategories();
  const { message: deleteFeedback } = useFeedback();

  const tasks = tasksOverride ?? taskStore.tasks ?? EMPTY_TASKS;
  const categories = categoriesOverride ?? hookCategories;
  const tasksByDate = useTasksByDate(tasks);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);
  const [imagePickerTaskId, setImagePickerTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [memoInitialMode, setMemoInitialMode] = useState<'view' | 'edit'>('edit');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isVisibilityOpen, setIsVisibilityOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [deletePhotoConfirmOpen, setDeletePhotoConfirmOpen] = useState(false);

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeTaskId) ?? null,
    [tasks, activeTaskId]
  );
  const viewingTask = useMemo(
    () => tasks.find((t) => t.id === viewingTaskId) ?? null,
    [tasks, viewingTaskId]
  );
  const imagePickerTask = useMemo(
    () => tasks.find((t) => t.id === imagePickerTaskId) ?? null,
    [tasks, imagePickerTaskId]
  );

  const {
    imageUrl: viewingImageUrl,
    isLoading: isViewingImageLoading,
  } = useTaskImage(viewingTask?.image, isImageViewerOpen);

  const activeTaskCategory = useMemo(
    () =>
      activeTask
        ? categories.find((c) => c.id === activeTask.categoryId) ?? null
        : null,
    [activeTask, categories]
  );

  const {
    swiperRef,
    slideDates,
    slideDateStrs,
    activeIndex,
    initialIndex,
    renderWindow,
    handlePrevDay,
    handleNextDay,
    handleSwipeSettled,
  } = useDayViewSwiper({
    isOpen,
    selectedDate,
    onDateChange,
    isDisabled:
      isActionSheetOpen ||
      isMemoOpen ||
      isDatePickerOpen ||
      isVisibilityOpen ||
      isDeleteConfirmOpen ||
      isImageViewerOpen ||
      deletePhotoConfirmOpen ||
      !!imagePickerTaskId,
  });

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

  const handleOpenActions = useCallback((task: TaskDocument) => {
    setActiveTaskId(task.id);
    setIsActionSheetOpen(true);
  }, []);

  const handleCloseActions = useCallback(() => {
    setIsActionSheetOpen(false);
  }, []);

  const handleOpenMemo = useCallback(
    (task: TaskDocument, mode: 'view' | 'edit' = 'view') => {
      setActiveTaskId(task.id);
      setMemoInitialMode(mode);
      setIsMemoOpen(true);
    },
    []
  );

  const handleEditTask = useCallback((task: TaskDocument) => {
    setEditingTaskId(task.id);
    setEditValue(task.title);
  }, []);

  const handleViewImage = useCallback((task: TaskDocument) => {
    setViewingTaskId(task.id);
    setIsImageViewerOpen(true);
  }, []);

  const handleEditChange = useCallback((val: string) => {
    setEditValue(val);
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

  const handleDelete = async () => {
    if (!activeTask) return;
    await deleteTask(activeTask.id);
    setIsDeleteConfirmOpen(false);
    setActiveTaskId(null);
  };

  const handleMemoSave = async (
    memo: string,
    visibility: '' | 'private' | 'followers' | 'public'
  ) => {
    if (!activeTask) return;
    await updateTask(activeTask.id, { memo, visibility });
    setIsMemoOpen(false);
    setActiveTaskId(null);
  };

  const handleDateChange = async (newDate: string) => {
    if (!activeTask) return;
    await updateTask(activeTask.id, { date: newDate });
    setIsDatePickerOpen(false);
    setActiveTaskId(null);
  };

  const handleDoItTomorrowOrToday = async () => {
    if (!activeTask) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd');
    const newDate = activeTask.date === today ? tomorrow : today;
    await updateTask(activeTask.id, { date: newDate });
    setActiveTaskId(null);
  };

  const handleRequestDeletePhoto = () => {
    setDeletePhotoConfirmOpen(true);
    setIsActionSheetOpen(false);
  };

  const handleConfirmDeletePhoto = async () => {
    if (!activeTask?.image) return;
    await deleteImage(activeTask.image);
    await updateTask(activeTask.id, { image: '' });
    setDeletePhotoConfirmOpen(false);
    setActiveTaskId(null);
  };

  const handleCancelDeletePhoto = () => {
    setDeletePhotoConfirmOpen(false);
    setActiveTaskId(null);
  };

  const handleImagePickerSave = useCallback(
    async (fileId: string) => {
      if (!imagePickerTask) return;
      await updateTask(imagePickerTask.id, { image: fileId });
      setImagePickerTaskId(null);
    },
    [imagePickerTask, updateTask]
  );

  const handleImagePickerRemove = useCallback(async () => {
    if (!imagePickerTask?.image) return;
    await deleteImage(imagePickerTask.image);
    await updateTask(imagePickerTask.id, { image: '' });
    setImagePickerTaskId(null);
  }, [imagePickerTask, updateTask]);

  const handleCloseImagePicker = useCallback(() => {
    setImagePickerTaskId(null);
    setActiveTaskId(null);
  }, []);

  const handleVisibilitySave = useCallback(
    async (visibility: '' | 'private' | 'followers' | 'public') => {
      if (!activeTask) return;
      await updateTask(activeTask.id, { visibility });
      setIsVisibilityOpen(false);
      setActiveTaskId(null);
    },
    [activeTask, updateTask]
  );

  const handleCloseVisibility = useCallback(() => {
    setIsVisibilityOpen(false);
    setActiveTaskId(null);
  }, []);

  const handleCloseMemo = useCallback(() => {
    setIsMemoOpen(false);
    setActiveTaskId(null);
  }, []);

  const handleCloseDatePicker = useCallback(() => {
    setIsDatePickerOpen(false);
    setActiveTaskId(null);
  }, []);

  const handleOpenDatePicker = useCallback(() => {
    setIsDatePickerOpen(true);
    setIsActionSheetOpen(false);
  }, []);

  const handleOpenVisibility = useCallback(() => {
    setIsVisibilityOpen(true);
    setIsActionSheetOpen(false);
  }, []);

  const handleOpenDeleteConfirm = useCallback(() => {
    setIsDeleteConfirmOpen(true);
    setIsActionSheetOpen(false);
  }, []);

  const handleOpenImageViewer = useCallback(() => {
    if (!activeTask) return;
    setViewingTaskId(activeTask.id);
    setIsImageViewerOpen(true);
    setIsActionSheetOpen(false);
  }, [activeTask]);

  const handleCloseImageViewer = useCallback(() => {
    setIsImageViewerOpen(false);
    setViewingTaskId(null);
  }, []);

  const handleOpenImagePicker = useCallback(() => {
    if (!activeTask) return;
    setImagePickerTaskId(activeTask.id);
    setIsActionSheetOpen(false);
  }, [activeTask]);

  const isBackgroundLocked =
    isActionSheetOpen ||
    isMemoOpen ||
    isDatePickerOpen ||
    isVisibilityOpen ||
    isDeleteConfirmOpen ||
    isImageViewerOpen ||
    deletePhotoConfirmOpen ||
    !!imagePickerTaskId;
  // A11Y-33: keyboard arrows mirror the existing swipe/chevron day navigation.
  // Nested sheets and text editing retain their own keyboard behavior.
  useHorizontalArrowNavigation({
    enabled: isOpen && !isBackgroundLocked,
    onLeft: handlePrevDay,
    onRight: handleNextDay,
  });

  const imageViewerLoadingFallback = (
    <div
      className="fixed inset-0 z-[80] bg-black flex items-center justify-center px-6"
      role="status"
      aria-live="polite"
    >
      <Spinner size="w-8 h-8" />
    </div>
  );
  const imageViewerUnavailable = (
    <div className="fixed inset-0 z-[80] bg-black flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-sm text-gray-300 mb-4">Image unavailable</p>
        <button
          type="button"
          onClick={handleCloseImageViewer}
          className="px-4 py-2 rounded-xl bg-[#2A2A2A] text-white text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );

  const content = (
    <>
      <Swiper
        nested={renderMode === 'inline'}
        noSwiping={renderMode === 'inline' ? false : undefined}
        touchStartPreventDefault={false}
        touchMoveStopPropagation={false}
        autoHeight={renderMode === 'inline'}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
        }}
        initialSlide={initialIndex}
        onSlideChange={handleSwipeSettled}
        data-testid="day-swiper"
        className={`min-w-0 w-full max-w-full overflow-hidden ${renderMode === 'inline' ? '' : 'flex-1'}`}
        style={{
          width: '100%',
          maxWidth: '100%',
          height: renderMode === 'inline' ? 'auto' : undefined,
          touchAction: 'pan-y',
        }}
      >
        {slideDates.map((date, i) => {
          const inWindow = Math.abs(i - activeIndex) <= renderWindow;
          const dateStr = slideDateStrs[i];
          const dayTasks = tasksByDate.get(dateStr) ?? EMPTY_TASKS;
          return (
            <SwiperSlide
              key={date.toISOString()}
              className="min-w-0"
              aria-hidden={i === activeIndex ? undefined : true}
              style={{ height: renderMode === 'inline' ? 'auto' : '100%' }}
            >
              <div
                className={renderMode === 'inline' ? 'w-full min-w-0' : 'flex h-full min-h-0 w-full min-w-0 flex-col'}
              >
                <div
                  className={`flex shrink-0 items-center justify-between gap-2 px-4 py-2 ${renderMode === 'sheet' ? 'touch-none' : ''}`}
                  data-bottom-sheet-drag-handle={renderMode === 'sheet' ? 'true' : undefined}
                >
                  <button
                    type="button"
                    onClick={handlePrevDay}
                    tabIndex={i === activeIndex ? 0 : -1}
                    className="p-2 text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                    aria-label="Previous day"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <h3
                    className="min-w-0 flex-1 text-center text-sm font-semibold text-white"
                    aria-live={i === activeIndex ? 'polite' : undefined}
                  >
                    {format(date, 'EEEE, MMMM d, yyyy')}
                  </h3>
                  <button
                    type="button"
                    onClick={handleNextDay}
                    tabIndex={i === activeIndex ? 0 : -1}
                    className="p-2 text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                    aria-label="Next day"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
                {inWindow && (
                  <DaySlide
                    date={date}
                    dateStr={dateStr}
                    scrollMode={renderMode === 'inline' ? 'page' : 'contained'}
                    tasks={dayTasks}
                    categories={categories}
                    currentUserId={currentUserId}
                    editingTaskId={editingTaskId}
                    editValue={editValue}
                    onToggleTask={handleToggleTask}
                    onAddTask={handleAddTask}
                    onOpenActions={handleOpenActions}
                    onOpenMemo={handleOpenMemo}
                    onEditTask={handleEditTask}
                    onViewImage={handleViewImage}
                    onEditChange={handleEditChange}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                  />
                )}
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
      <TaskActionSheet
        isOpen={isActionSheetOpen && !!activeTask}
        onClose={handleCloseActions}
        task={activeTask}
        category={activeTaskCategory}
        onEdit={() => {
          if (activeTask) handleEditTask(activeTask);
          setIsActionSheetOpen(false);
          setActiveTaskId(null);
        }}
        onDelete={handleOpenDeleteConfirm}
        onMemo={() => {
          if (activeTask) handleOpenMemo(activeTask, 'edit');
          setIsActionSheetOpen(false);
        }}
        onChangeDate={handleOpenDatePicker}
        onVisibility={handleOpenVisibility}
        onAddPhoto={handleOpenImagePicker}
        onViewPhoto={handleOpenImageViewer}
        onDeletePhoto={handleRequestDeletePhoto}
        onDoItTomorrowOrToday={handleDoItTomorrowOrToday}
      />
      <AnimatePresence>
        {isMemoOpen && activeTask && (
          <MemoSheet
            isOpen={isMemoOpen}
            onClose={handleCloseMemo}
            task={activeTask}
            onSave={handleMemoSave}
            initialMode={memoInitialMode}
          />
        )}
        {isDatePickerOpen && activeTask && (
          <DatePickerSheet
            isOpen={isDatePickerOpen}
            onClose={handleCloseDatePicker}
            task={activeTask}
            onDateChange={handleDateChange}
          />
        )}
        {isVisibilityOpen && activeTask && (
          <TaskVisibilitySheet
            isOpen={isVisibilityOpen}
            onClose={handleCloseVisibility}
            task={activeTask}
            category={activeTaskCategory}
            onSave={handleVisibilitySave}
          />
        )}
      </AnimatePresence>
      <ConfirmSheet
        isOpen={isDeleteConfirmOpen}
        onClose={() => {
          setIsDeleteConfirmOpen(false);
          setActiveTaskId(null);
        }}
        title="Delete Task"
        message="This task will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
      <ConfirmSheet
        isOpen={deletePhotoConfirmOpen}
        onClose={handleCancelDeletePhoto}
        title="Delete Photo"
        message="This photo will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={handleConfirmDeletePhoto}
      />
      {isImageViewerOpen && viewingTask?.image && (
        viewingImageUrl ? (
          <Suspense fallback={imageViewerLoadingFallback}>
            <ImageViewer
              isOpen
              imageUrl={viewingImageUrl}
              taskTitle={viewingTask.title}
              taskDate={viewingTask.date}
              onClose={handleCloseImageViewer}
            />
          </Suspense>
        ) : isViewingImageLoading ? imageViewerLoadingFallback : imageViewerUnavailable
      )}
      <ImagePickerSheet
        isOpen={!!imagePickerTaskId}
        onClose={handleCloseImagePicker}
        variant="task"
        hasExistingImage={!!imagePickerTask?.image}
        title="Task Photo"
        onSave={handleImagePickerSave}
        onRemove={handleImagePickerRemove}
      />
      {deleteFeedback && (
        <div role="status" aria-live="polite" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {deleteFeedback}
        </div>
      )}
    </>
  );

  if (renderMode === 'inline') {
    return (
      <div
        className={`flex min-h-0 min-w-0 w-full max-w-full flex-col overflow-x-hidden ${isBackgroundLocked ? 'pointer-events-none' : ''}`}
        aria-hidden={isBackgroundLocked || undefined}
        data-testid="inline-day-view"
      >
        {content}
      </div>
    );
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={format(selectedDate, 'EEEE, MMMM d, yyyy')}
      height="full"
      isLocked={isBackgroundLocked}
      suspendInteraction={isBackgroundLocked}
    >
      {content}
    </BottomSheet>
  );
};
