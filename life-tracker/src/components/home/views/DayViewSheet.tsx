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
import type { TaskDocument } from '../../../db/schema';
import { Spinner } from '../../ui/Spinner';

const ImageViewer = lazy(() =>
  import('./ImageViewer').then(({ ImageViewer }) => ({ default: ImageViewer }))
);

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
  onDateChange,
}) => {
  const { user } = useAuth();
  const currentUserId = user?.$id ?? '';

  const {
    tasks = EMPTY_TASKS,
    addTask,
    toggleTaskCompletion,
    updateTask,
    deleteTask,
  } = useTasks();
  const { categories = [] } = useCategories();
  const { message: deleteFeedback } = useFeedback();

  const tasksByDate = useTasksByDate(tasks);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);
  const [imagePickerTaskId, setImagePickerTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isMemoOpen, setIsMemoOpen] = useState(false);
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

  const { imageUrl: viewingImageUrl } = useTaskImage(viewingTask?.image);

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
    isDisabled: isMemoOpen || isDatePickerOpen || isDeleteConfirmOpen,
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
  }, []);

  const handleCloseActions = useCallback(() => {
    setActiveTaskId(null);
  }, []);

  const handleOpenMemo = useCallback((task: TaskDocument) => {
    setActiveTaskId(task.id);
    setIsMemoOpen(true);
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
    visibility: 'private' | 'followers' | 'public'
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
  }, []);

  const handleOpenVisibility = useCallback(() => {
    setIsVisibilityOpen(true);
  }, []);

  const handleOpenDeleteConfirm = useCallback(() => {
    setIsDeleteConfirmOpen(true);
  }, []);

  const handleOpenImageViewer = useCallback(() => {
    setIsImageViewerOpen(true);
  }, []);

  const handleCloseImageViewer = useCallback(() => {
    setIsImageViewerOpen(false);
    setViewingTaskId(null);
  }, []);

  const handleOpenImagePicker = useCallback(() => {
    setImagePickerTaskId(activeTask?.id ?? null);
  }, [activeTask]);

  const isBackgroundLocked =
    isMemoOpen ||
    isDatePickerOpen ||
    isVisibilityOpen ||
    isDeleteConfirmOpen ||
    isImageViewerOpen ||
    deletePhotoConfirmOpen;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={format(selectedDate, 'EEEE, MMM d')}
      height="full"
    >
      <div className="flex items-center justify-between px-4 py-2">
        <button
          onClick={handlePrevDay}
          className="p-2 text-gray-400"
          aria-label="Previous day"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm text-gray-400">
          {format(selectedDate, 'MMM d, yyyy')}
        </span>
        <button
          onClick={handleNextDay}
          className="p-2 text-gray-400"
          aria-label="Next day"
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <Swiper
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
        }}
        initialSlide={initialIndex}
        onSlideChange={handleSwipeSettled}
        className="flex-1"
      >
        {slideDates.map((date, i) => {
          const inWindow = Math.abs(i - activeIndex) <= renderWindow;
          const dateStr = slideDateStrs[i];
          const dayTasks = tasksByDate.get(dateStr) ?? EMPTY_TASKS;
          return (
            <SwiperSlide key={date.toISOString()}>
              {inWindow && (
                <DaySlide
                  date={date}
                  dateStr={dateStr}
                  tasks={dayTasks}
                  categories={categories}
                  currentUserId={currentUserId}
                  editingTaskId={editingTaskId}
                  editValue={editValue}
                  onToggleTask={handleToggleTask}
                  onAddTask={handleAddTask}
                  onOpenActions={handleOpenActions}
                  onOpenMemo={handleOpenMemo}
                  onViewImage={handleViewImage}
                  onEditChange={handleEditChange}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                />
              )}
            </SwiperSlide>
          );
        })}
      </Swiper>
      <TaskActionSheet
        isOpen={!!activeTask}
        onClose={handleCloseActions}
        task={activeTask}
        category={activeTaskCategory}
        onEdit={() => {
          if (activeTask) {
            setEditingTaskId(activeTask.id);
            setEditValue(activeTask.title);
          }
          handleCloseActions();
        }}
        onDelete={handleOpenDeleteConfirm}
        onMemo={() => {
          handleCloseActions();
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
        onClose={() => setIsDeleteConfirmOpen(false)}
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
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[80] bg-black flex items-center justify-center">
              <Spinner size="w-8 h-8" />
            </div>
          }
        >
          <ImageViewer
            isOpen
            imageUrl={viewingImageUrl}
            taskTitle={viewingTask.title}
            taskDate={viewingTask.date}
            onClose={handleCloseImageViewer}
          />
        </Suspense>
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
      {isBackgroundLocked && null}
      {deleteFeedback && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {deleteFeedback}
        </div>
      )}
    </BottomSheet>
  );
};
