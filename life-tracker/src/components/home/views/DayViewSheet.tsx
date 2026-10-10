import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { runBulkTaskActions } from './bulkTaskActions';
import { formatSelectedTasksForClipboard, resolveTaskCompletionSortMode } from '../../../lib/taskOrder';
import { addDays, format, isToday } from 'date-fns';
import { Swiper, SwiperSlide } from 'swiper/react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckSquare, ChevronLeft, ChevronRight, Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import { BottomSheet } from '../../ui/BottomSheet';
import { AppearanceContext } from '../../../hooks/appearanceContext';
import { systemRequestsReducedMotion } from '../../../lib/motionPreferences';
import { ConfirmSheet } from '../../ui/ConfirmSheet';
import { DaySlide } from './DaySlide';
import { TaskActionSheet } from './TaskActionSheet';
const LazyShareTaskSheet = lazy(() =>
  import('./ShareTaskSheet').then(({ ShareTaskSheet }) => ({ default: ShareTaskSheet }))
);
import { useSharedTasks } from '../../../hooks/useSharedTasks';
import type { SharedTaskItem } from '../../../lib/taskShareQueue';
import { MemoSheet } from './MemoSheet';
import { DatePickerSheet } from './DatePickerSheet';
import { ImagePickerSheet } from './ImagePickerSheet';
import { TaskVisibilitySheet } from './TaskVisibilitySheet';
import { BulkTaskActionSheet } from './BulkTaskActionSheet';
import { BulkCategoryPickerSheet } from './BulkCategoryPickerSheet';
import { BulkDatePickerSheet } from './BulkDatePickerSheet';
import { BulkVisibilitySheet } from './BulkVisibilitySheet';
import { useTasks } from '../../../hooks/useTasks';
import { useCategories } from '../../../hooks/useCategories';
import { useAuth } from '../../../hooks/useAuth';
import { useTaskImage } from '../../../hooks/useTaskImage';
import { useFeedback } from '../../../hooks/useFeedback';
import { useTasksByDate } from '../../../hooks/useTasksByDate';
import { pendingOwnerCompletionIds, subscribeOwnerCompletionPending } from '../../../lib/ownerCompletionPending';
import { useDayViewSwiper } from './useDayViewSwiper';
import { deleteImage } from '../../../lib/storage';
import { EMPTY_TASKS } from '../../../constants/empty';
import type { CategoryDocument, TaskDocument } from '../../../db/schema';
import { Spinner } from '../../ui/Spinner';
import { useHorizontalArrowNavigation } from '../../../hooks/useHorizontalArrowNavigation';
import { useSettings } from '../../../hooks/useSettings';
import {
  ADD_TASKS_TO_TOP_SETTING_KEY,
  TASK_COMPLETION_SORT_SETTING_KEY,
  CONTINUE_ADDING_TASKS_SETTING_KEY,
  HOLIDAY_REGION_SETTING_KEY,
  HOLIDAY_TYPES_SETTING_KEY,
  SHOW_CATEGORY_COLLAPSE_SETTING_KEY,
  SHOW_DAY_VIEW_TODAY_TAG_SETTING_KEY,
  SHOW_HOLIDAYS_SETTING_KEY,
} from '../../../lib/preferences';
import { useHolidaysByDate } from '../../../hooks/useHolidays';
import {
  EMPTY_HOLIDAYS,
  createHolidayDisplayConfig,
  type HolidayDisplayConfig,
} from '../../../lib/holidays';

const ImageViewer = lazy(() =>
  import('./ImageViewer').then(({ ImageViewer }) => ({ default: ImageViewer }))
);

const DAY_SWIPER_FOCUSABLE_ELEMENTS =
  'input, select, option, textarea, video, label, button:not([data-day-swipe-through="true"])';
const DAY_SWIPER_TRANSITION_SPEED_MS = 320;
const DAY_SWIPER_TRANSITION_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';

// #11a: hoisted — closes over nothing, so building this once avoids
// re-allocating the JSX tree on every DayViewSheet render.
const ImageViewerLoadingFallback: React.FC = () => (
  <div
    className="fixed inset-0 z-[80] bg-black flex items-center justify-center px-6"
    role="status"
    aria-live="polite"
  >
    <Spinner size="w-8 h-8" />
  </div>
);

interface DayViewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onDateChange?: (date: Date) => void;
  renderMode?: 'sheet' | 'inline';
  tasks?: TaskDocument[];
  categories?: CategoryDocument[];
  focusTaskId?: string | null;
  holidayConfig?: HolidayDisplayConfig;
}

export const DayViewSheet: React.FC<DayViewSheetProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onDateChange,
  renderMode = 'sheet',
  tasks: tasksOverride,
  categories: categoriesOverride,
  focusTaskId = null,
  holidayConfig: holidayConfigOverride,
}) => {
  const appearance = React.useContext(AppearanceContext);
  const reducedMotion = Boolean(appearance?.effectiveReducedMotion ?? systemRequestsReducedMotion());
  const { user } = useAuth();
  const currentUserId = user?.$id ?? '';

  const taskStore = useTasks(tasksOverride === undefined);
  const {
    addTask,
    toggleTaskCompletion,
    updateTask,
    deleteTask,
    reorderTasks,
    moveTasksToCategory,
  } = taskStore;
  const { categories: hookCategories = [] } = useCategories(
    categoriesOverride === undefined
  );
  const { message: deleteFeedback, show: showFeedback } = useFeedback();
  const { getSetting } = useSettings();
  const continueAddingTasks =
    getSetting(CONTINUE_ADDING_TASKS_SETTING_KEY, false) === true;
  const addTasksToTop =
    getSetting(ADD_TASKS_TO_TOP_SETTING_KEY, false) === true;
  const taskSortMode = resolveTaskCompletionSortMode(
    getSetting(TASK_COMPLETION_SORT_SETTING_KEY, 'manual')
  );
  const showCategoryCollapseButton =
    getSetting(SHOW_CATEGORY_COLLAPSE_SETTING_KEY, false) === true;
  const showDayViewTodayTag =
    getSetting(SHOW_DAY_VIEW_TODAY_TAG_SETTING_KEY, false) === true;
  const holidayConfig =
    holidayConfigOverride ??
    createHolidayDisplayConfig(
      getSetting(SHOW_HOLIDAYS_SETTING_KEY, false),
      getSetting(HOLIDAY_REGION_SETTING_KEY, ''),
      getSetting(HOLIDAY_TYPES_SETTING_KEY, 'public-and-observances')
    );

  const tasks = tasksOverride ?? taskStore.tasks ?? EMPTY_TASKS;
  const categories = categoriesOverride ?? hookCategories;
  const tasksByDate = useTasksByDate(tasks);
  const [ownerPendingRevision, setOwnerPendingRevision] = useState(0);
  useEffect(() => subscribeOwnerCompletionPending(() => setOwnerPendingRevision(n => n + 1)), []);
  const pendingOwnedTaskIds = useMemo(() => pendingOwnerCompletionIds(currentUserId),
    [currentUserId, ownerPendingRevision]);
  const sharedTasks = useSharedTasks('received', isOpen);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [shareSheetMounted, setShareSheetMounted] = useState(false);
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
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());
  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false);
  const [isBulkCategoryOpen, setIsBulkCategoryOpen] = useState(false);
  const [isBulkDateOpen, setIsBulkDateOpen] = useState(false);
  const [isBulkVisibilityOpen, setIsBulkVisibilityOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkWorking, setIsBulkWorking] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const copyPendingRef = useRef(false);
  const [isTaskReorderActive, setIsTaskReorderActive] = useState(false);

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

  const exitSelectMode = useCallback(() => {
    if (isBulkWorking) return;
    setIsSelectMode(false);
    setSelectedTaskIds(new Set());
    setIsBulkActionOpen(false);
    setIsBulkCategoryOpen(false);
    setIsBulkDateOpen(false);
    setIsBulkVisibilityOpen(false);
    setIsBulkDeleteOpen(false);
  }, [isBulkWorking]);

  const {
    swiperRef,
    slideDates,
    slideDateStrs,
    activeIndex,
    initialIndex,
    renderWindow,
    handlePrevDay,
    handleNextDay,
    handleSlideChange,
    handleSwipeSettled,
  } = useDayViewSwiper({
    isOpen,
    selectedDate,
    onDateChange,
    isDisabled:
      isActionSheetOpen ||
      isShareSheetOpen ||
      isMemoOpen ||
      isDatePickerOpen ||
      isVisibilityOpen ||
      isDeleteConfirmOpen ||
      isImageViewerOpen ||
      deletePhotoConfirmOpen ||
      isBulkActionOpen ||
      isBulkCategoryOpen ||
      isBulkDateOpen ||
      isBulkVisibilityOpen ||
      isBulkDeleteOpen ||
      isBulkWorking ||
      !!imagePickerTaskId ||
      isTaskReorderActive,
  });

  const holidayYears = useMemo(() => {
    const years = new Set<number>();
    const start = Math.max(0, activeIndex - renderWindow);
    const end = Math.min(slideDates.length - 1, activeIndex + renderWindow);
    for (let index = start; index <= end; index += 1) {
      years.add(slideDates[index].getFullYear());
    }
    return [...years];
  }, [activeIndex, renderWindow, slideDates]);
  const holidaysByDate = useHolidaysByDate(holidayConfig, holidayYears);

  const activeDateStr = slideDateStrs[activeIndex] ?? format(selectedDate, 'yyyy-MM-dd');
  const previousActiveDateStrRef = useRef(activeDateStr);
  const selectedTasks = useMemo(
    () =>
      isSelectMode
        ? tasks.filter(
            (task) =>
              selectedTaskIds.has(task.id) && task.date === activeDateStr
          )
        : EMPTY_TASKS,
    [activeDateStr, isSelectMode, selectedTaskIds, tasks]
  );

  useEffect(() => {
    const didChangeDate = previousActiveDateStrRef.current !== activeDateStr;
    previousActiveDateStrRef.current = activeDateStr;
    if (didChangeDate && isSelectMode && !isBulkWorking) {
      exitSelectMode();
    }
  }, [activeDateStr, exitSelectMode, isBulkWorking, isSelectMode]);

  // #10: precompute the header label per slide so the render loop doesn't
  // re-run date-fns' format() on every render for every in-window slide.
  // Effectiveness depends on slideDates identity being stable across
  // renders — if the hook returns a fresh array each time this is a
  // no-op, never a regression.
  const slideDateLabels = useMemo(
    () => slideDates.map((d) => format(d, 'EEEE, MMMM d, yyyy')),
    [slideDates]
  );

  const [deferredRenderWindow, setDeferredRenderWindow] = useState(0);
  // #7: this fires on any BottomSheet animation completion (entrance and
  // drag snap-back), so "settled" is more accurate than "complete".
  const handleSheetSettled = useCallback(() => {
    if (isOpen) setDeferredRenderWindow(renderWindow);
  }, [isOpen, renderWindow]);

  // Inline Todo Day View has no sheet entrance animation, so its initial render
  // window must not wait for BottomSheet's animation-complete callback.
  const effectiveRenderWindow =
    renderMode === 'inline' ? renderWindow : deferredRenderWindow;

  const handleSheetClose = useCallback(() => {
    setDeferredRenderWindow(0);
    setIsTaskReorderActive(false);
    setIsSelectMode(false);
    setSelectedTaskIds(new Set());
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || renderMode !== 'sheet' || !focusTaskId) return;

    let clearTimer: number | null = null;
    const frame = requestAnimationFrame(() => {
      const scope = document.querySelector(
        '[data-day-view-focus-scope="true"]'
      );
      const target = scope?.querySelector<HTMLElement>(
        `[data-task-id="${focusTaskId}"]`
      );
      if (!target) return;

      const reduceMotion =
        document.documentElement.dataset.reduceMotion === 'true' ||
        systemRequestsReducedMotion();
      target.scrollIntoView({
        block: 'center',
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
      target.setAttribute('data-search-focused', 'true');
      clearTimer = window.setTimeout(
        () => target.removeAttribute('data-search-focused'),
        reduceMotion ? 700 : 1600
      );
    });

    return () => {
      cancelAnimationFrame(frame);
      if (clearTimer !== null) window.clearTimeout(clearTimer);
      document
        .querySelector('[data-day-view-focus-scope="true"] [data-search-focused="true"]')
        ?.removeAttribute('data-search-focused');
    };
  }, [focusTaskId, isOpen, renderMode, selectedDate]);

  const handleSheetHorizontalSwipe = useCallback(
    (direction: 'left' | 'right') => {
      if (isSelectMode) exitSelectMode();
      if (direction === 'left') {
        handleNextDay();
      } else {
        handlePrevDay();
      }
    },
    [exitSelectMode, handleNextDay, handlePrevDay, isSelectMode]
  );

  const handlePrevDayFromUi = useCallback(() => {
    if (isSelectMode) exitSelectMode();
    handlePrevDay();
  }, [exitSelectMode, handlePrevDay, isSelectMode]);

  const handleNextDayFromUi = useCallback(() => {
    if (isSelectMode) exitSelectMode();
    handleNextDay();
  }, [exitSelectMode, handleNextDay, isSelectMode]);

  const handleSlideChangeFromUi = useCallback((swiper: Parameters<typeof handleSlideChange>[0]) => {
    if (isSelectMode) exitSelectMode();
    handleSlideChange(swiper);
  }, [exitSelectMode, handleSlideChange, isSelectMode]);

  const handleSwipeSettledFromUi = useCallback((swiper: Parameters<typeof handleSwipeSettled>[0]) => {
    handleSwipeSettled(swiper);
  }, [handleSwipeSettled]);

  const handleToggleTask = useCallback(
    (taskId: string, currentStatus: boolean) => {
      toggleTaskCompletion(taskId, !currentStatus);
    },
    [toggleTaskCompletion]
  );

  const handleToggleTaskSelection = useCallback((taskId: string) => {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const handleToggleSelectMode = useCallback(() => {
    if (isSelectMode) {
      exitSelectMode();
      return;
    }
    setEditingTaskId(null);
    setEditValue('');
    setSelectedTaskIds(new Set());
    setIsSelectMode(true);
  }, [exitSelectMode, isSelectMode]);

  const handleCopySelectedTasks = useCallback(async () => {
    if (copyPendingRef.current || isBulkWorking || selectedTasks.length === 0) return;
    const text = formatSelectedTasksForClipboard(
      selectedTasks,
      categories.map((category) => category.id),
      taskSortMode
    );
    if (!text) {
      showFeedback('No selected tasks to copy');
      return;
    }
    copyPendingRef.current = true;
    setIsCopying(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      showFeedback(`${selectedTasks.length} ${selectedTasks.length === 1 ? 'task' : 'tasks'} copied`);
    } catch {
      showFeedback('Could not copy selected tasks');
    } finally {
      copyPendingRef.current = false;
      setIsCopying(false);
    }
  }, [categories, isBulkWorking, selectedTasks, showFeedback, taskSortMode]);

  const runBulkUpdate = useCallback(async (updates: Partial<TaskDocument>) => {
    const snapshot = selectedTasks;
    if (snapshot.length === 0 || isBulkWorking) return;
    setIsBulkWorking(true);
    const failedIds = await runBulkTaskActions(snapshot, (task) => updateTask(task.id, updates));
    setIsBulkWorking(false);
    if (failedIds.size > 0) {
      setSelectedTaskIds(failedIds);
      setIsBulkActionOpen(false);
      setIsBulkDateOpen(false);
      setIsBulkVisibilityOpen(false);
      showFeedback(`${failedIds.size} ${failedIds.size === 1 ? 'task' : 'tasks'} could not be updated`);
      return;
    }
    exitSelectMode();
  }, [exitSelectMode, isBulkWorking, selectedTasks, showFeedback, updateTask]);

  const handleBulkMoveCategory = useCallback(async (categoryId: string) => {
    const snapshot = selectedTasks;
    if (snapshot.length === 0 || isBulkWorking) return;
    setIsBulkWorking(true);
    try {
      await moveTasksToCategory(
        activeDateStr,
        snapshot.map((task) => task.id),
        categoryId
      );
      setIsBulkWorking(false);
      exitSelectMode();
    } catch {
      setIsBulkWorking(false);
      setIsBulkCategoryOpen(false);
      showFeedback('Selected tasks could not be moved');
    }
  }, [
    activeDateStr,
    exitSelectMode,
    isBulkWorking,
    moveTasksToCategory,
    selectedTasks,
    showFeedback,
  ]);

  const handleBulkDelete = useCallback(async () => {
    const snapshot = selectedTasks;
    if (snapshot.length === 0 || isBulkWorking) return;
    setIsBulkWorking(true);
    const failedIds = await runBulkTaskActions(snapshot, (task) => deleteTask(task.id));
    setIsBulkWorking(false);
    if (failedIds.size > 0) {
      setSelectedTaskIds(failedIds);
      setIsBulkDeleteOpen(false);
      showFeedback(`${failedIds.size} ${failedIds.size === 1 ? 'task' : 'tasks'} could not be deleted`);
      return;
    }
    exitSelectMode();
  }, [deleteTask, exitSelectMode, isBulkWorking, selectedTasks, showFeedback]);

  const handleAddTask = useCallback(
    (title: string, categoryId: string, dateStr: string, completed = false) => {
      addTask(
        {
          title,
          categoryId,
          date: dateStr,
          completed,
          ...(completed ? { completedAt: new Date().toISOString() } : {}),
          visibility: '',
        },
        addTasksToTop ? 'top' : 'bottom'
      );
    },
    [addTask, addTasksToTop]
  );

  const handleOpenActions = useCallback((task: TaskDocument) => {
    setActiveTaskId(task.id);
    setIsActionSheetOpen(true);
  }, []);

  const handleCloseActions = useCallback(() => {
    setIsActionSheetOpen(false);
  }, []);
  const updateSharedCompletion = sharedTasks.updateCompletion;
  const handleSharedCompletion = useCallback(async (item: SharedTaskItem, desired: boolean) => {
    try {
      const result = await updateSharedCompletion(item, desired);
      if (result.status === 'pending') showFeedback('Shared completion queued for sync.');
      if (result.status === 'rejected') showFeedback(result.reason || 'Shared completion failed.');
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : 'Shared completion failed.');
    }
  }, [updateSharedCompletion, showFeedback]);

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

  // #12: these were plain functions rebuilding on every render. Wrapping in
  // useCallback keeps prop identities stable for any downstream memoized
  // children. No behavior change with current consumers.
  const handleDelete = useCallback(async () => {
    if (!activeTask) return;
    await deleteTask(activeTask.id);
    setIsDeleteConfirmOpen(false);
    setActiveTaskId(null);
  }, [activeTask, deleteTask]);

  const handleMemoSave = useCallback(
    async (
      memo: string,
      visibility: '' | 'private' | 'followers' | 'public'
    ) => {
      if (!activeTask) return;
      await updateTask(activeTask.id, { memo, visibility });
      setIsMemoOpen(false);
      setActiveTaskId(null);
    },
    [activeTask, updateTask]
  );

  const handleDateChange = useCallback(
    async (newDate: string) => {
      if (!activeTask) return;
      await updateTask(activeTask.id, { date: newDate });
      setIsDatePickerOpen(false);
      setActiveTaskId(null);
    },
    [activeTask, updateTask]
  );

  const handleDoItTomorrowOrToday = useCallback(async () => {
    if (!activeTask) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const newDate = activeTask.date === today ? tomorrow : today;
    await updateTask(activeTask.id, { date: newDate });
    setActiveTaskId(null);
  }, [activeTask, updateTask]);

  const handleRequestDeletePhoto = useCallback(() => {
    setDeletePhotoConfirmOpen(true);
    setIsActionSheetOpen(false);
  }, []);

  const handleConfirmDeletePhoto = useCallback(async () => {
    if (!activeTask?.image) return;
    await deleteImage(activeTask.image);
    await updateTask(activeTask.id, { image: '' });
    setDeletePhotoConfirmOpen(false);
    setActiveTaskId(null);
  }, [activeTask, updateTask]);

  const handleCancelDeletePhoto = useCallback(() => {
    setDeletePhotoConfirmOpen(false);
    setActiveTaskId(null);
  }, []);

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
    isShareSheetOpen ||
    isMemoOpen ||
    isDatePickerOpen ||
    isVisibilityOpen ||
    isDeleteConfirmOpen ||
    isImageViewerOpen ||
    deletePhotoConfirmOpen ||
    isBulkActionOpen ||
    isBulkCategoryOpen ||
    isBulkDateOpen ||
    isBulkVisibilityOpen ||
    isBulkDeleteOpen ||
    isBulkWorking ||
    !!imagePickerTaskId;
  useEffect(() => {
    if (renderMode !== 'inline' || !isSelectMode) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isBackgroundLocked) return;
      event.preventDefault();
      exitSelectMode();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [exitSelectMode, isBackgroundLocked, isSelectMode, renderMode]);
  // A11Y-33: keyboard arrows mirror the existing swipe/chevron day navigation.
  // Nested sheets and text editing retain their own keyboard behavior.
  useHorizontalArrowNavigation({
    enabled: isOpen && !isBackgroundLocked && !isTaskReorderActive,
    onLeft: handlePrevDayFromUi,
    onRight: handleNextDayFromUi,
  });

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
        allowTouchMove={!isTaskReorderActive}
        noSwiping={renderMode === 'sheet'}
        focusableElements={DAY_SWIPER_FOCUSABLE_ELEMENTS}
        touchStartPreventDefault={false}
        touchMoveStopPropagation={false}
        autoHeight={renderMode === 'inline'}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
        }}
        onBeforeDestroy={(swiper) => {
          if (swiperRef.current === swiper) {
            swiperRef.current = null;
          }
        }}
        initialSlide={initialIndex}
        speed={reducedMotion ? 0 : DAY_SWIPER_TRANSITION_SPEED_MS}
        onSlideChange={handleSlideChangeFromUi}
        onSlideChangeTransitionEnd={handleSwipeSettledFromUi}
        data-testid="day-swiper"
        data-bottom-sheet-native-horizontal-swipe={renderMode === 'sheet' ? 'true' : undefined}
        className={`min-w-0 w-full max-w-full overflow-hidden ${renderMode === 'inline' ? '' : 'flex-1'}`}
        style={{
          width: '100%',
          maxWidth: '100%',
          height: renderMode === 'inline' ? 'auto' : undefined,
          touchAction: 'pan-y',
          '--swiper-wrapper-transition-timing-function': DAY_SWIPER_TRANSITION_EASING,
        } as React.CSSProperties}
      >
        {slideDates.map((date, i) => {
          const inWindow = Math.abs(i - activeIndex) <= effectiveRenderWindow;
          const dateStr = slideDateStrs[i];
          const dayTasks = tasksByDate.get(dateStr) ?? EMPTY_TASKS;
          const dayHolidays = holidaysByDate.get(dateStr) ?? EMPTY_HOLIDAYS;
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
                {inWindow && (
                  <>
                    <div
                      className="shrink-0 px-4 py-2"
                      data-day-view-navigation="true"
                      data-bottom-sheet-directional-drag-handle={
                        renderMode === 'sheet' ? 'true' : undefined
                      }
                    >
                      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center">
                        <button
                          type="button"
                          onClick={handlePrevDayFromUi}
                          tabIndex={i === activeIndex ? 0 : -1}
                          className="justify-self-start p-2 text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                          aria-label="Previous day"
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <h3
                          className="min-w-0 text-center text-base font-semibold text-white"
                          aria-live={i === activeIndex ? 'polite' : undefined}
                        >
                          <span className="block truncate">{slideDateLabels[i]}</span>
                        </h3>
                        <button
                          type="button"
                          onClick={handleNextDayFromUi}
                          tabIndex={i === activeIndex ? 0 : -1}
                          className="justify-self-end p-2 text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                          aria-label="Next day"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </div>
                      <div className="mt-0.5 grid min-h-8 grid-cols-[1fr_auto_1fr] items-center">
                        <span aria-hidden="true" />
                        <div className="flex min-w-0 max-w-[60vw] flex-col items-center justify-center gap-0.5">
                          {showDayViewTodayTag && isToday(date) && (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                              Today
                            </span>
                          )}
                          {dayHolidays.map((holiday) => (
                            <span
                              key={holiday.id}
                              className="mosaic-holiday-label block max-w-full truncate rounded-full bg-red-500/15 px-2 py-0.5 text-center text-[11px] font-semibold text-red-400"
                            >
                              {holiday.title}
                            </span>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={handleToggleSelectMode}
                          tabIndex={i === activeIndex ? 0 : -1}
                          aria-pressed={isSelectMode}
                          aria-label={isSelectMode ? 'Exit selection mode' : 'Select tasks'}
                          className={`justify-self-end flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${isSelectMode ? 'bg-emerald-500 text-black' : 'text-gray-300 hover:bg-[#2A2A2A]'}`}
                        >
                          <CheckSquare size={16} aria-hidden="true" />
                          <span>Select</span>
                        </button>
                      </div>
                    </div>
                    {dayTasks.some(task => pendingOwnedTaskIds.has(task.id)) && (
                      <p role="status" className="px-4 pb-1 text-xs text-amber-400">
                        Shared completion pending sync
                      </p>
                    )}
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
                      sharedItems={sharedTasks.activeItems}
                      onSharedCompletion={handleSharedCompletion}
                      sharedPendingFor={sharedTasks.pendingFor}
                      onAddTask={handleAddTask}
                      onOpenActions={handleOpenActions}
                      onOpenMemo={handleOpenMemo}
                      onEditTask={handleEditTask}
                      onViewImage={handleViewImage}
                      onEditChange={handleEditChange}
                      onEditSave={handleEditSave}
                      onEditCancel={handleEditCancel}
                      disableTaskLayoutAnimation={renderMode === 'sheet'}
                      continueAddingTasks={continueAddingTasks}
                      showCategoryCollapseButton={showCategoryCollapseButton}
                      taskSortMode={taskSortMode}
                      selectionMode={isSelectMode && i === activeIndex}
                      selectedTaskIds={selectedTaskIds}
                      onToggleTaskSelection={handleToggleTaskSelection}
                      reorderEnabled={
                        isOpen &&
                        i === activeIndex &&
                        !isSelectMode &&
                        !isBackgroundLocked &&
                        editingTaskId === null
                      }
                      reorderRuntimeActive={isOpen && i === activeIndex}
                      onReorderTasks={reorderTasks}
                      onReorderActiveChange={setIsTaskReorderActive}
                    />
                  </>
                )}
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
      <AnimatePresence initial={false}>
        {isSelectMode && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="z-10 mx-2 mb-[max(0.5rem,env(safe-area-inset-bottom))] flex shrink-0 items-center justify-end gap-2 rounded-2xl border border-[#333333] bg-surface p-2 shadow-xl backdrop-blur"
            role="toolbar"
            aria-label={`${selectedTasks.length} selected ${selectedTasks.length === 1 ? 'task' : 'tasks'}`}
          >
            <span className="mr-auto pl-2 text-sm text-gray-300">{selectedTasks.length} selected</span>
            <button type="button" disabled={selectedTasks.length === 0 || isBulkWorking || isCopying} onClick={handleCopySelectedTasks} aria-label="Copy selected tasks" className="flex h-11 w-11 items-center justify-center rounded-full bg-surfaceHighlight text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
              <Copy aria-hidden="true" />
            </button>
            <button type="button" disabled={selectedTasks.length === 0 || isBulkWorking} onClick={() => setIsBulkActionOpen(true)} aria-label="More actions for selected tasks" className="flex h-11 w-11 items-center justify-center rounded-full bg-surfaceHighlight text-white disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
              <MoreHorizontal aria-hidden="true" />
            </button>
            <button type="button" disabled={selectedTasks.length === 0 || isBulkWorking} onClick={() => setIsBulkDeleteOpen(true)} aria-label="Delete selected tasks" className="flex h-11 w-11 items-center justify-center rounded-full bg-red-500 text-black disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300">
              <Trash2 aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        <BulkTaskActionSheet
            isOpen={isBulkActionOpen}
            count={selectedTasks.length}
            isWorking={isBulkWorking}
            onClose={() => setIsBulkActionOpen(false)}
            onMoveCategory={() => { setIsBulkActionOpen(false); setIsBulkCategoryOpen(true); }}
            onChangeDate={() => { setIsBulkActionOpen(false); setIsBulkDateOpen(true); }}
            onDoToday={() => runBulkUpdate({ date: format(new Date(), 'yyyy-MM-dd') })}
            onDoTomorrow={() => runBulkUpdate({ date: format(addDays(new Date(), 1), 'yyyy-MM-dd') })}
            onVisibility={() => { setIsBulkActionOpen(false); setIsBulkVisibilityOpen(true); }}
          />

        <BulkCategoryPickerSheet
            isOpen={isBulkCategoryOpen}
            categories={categories.filter(
              (category) =>
                category.userId === currentUserId && !category.isDeleted
            )}
            isWorking={isBulkWorking}
            onClose={() => setIsBulkCategoryOpen(false)}
            onSelect={handleBulkMoveCategory}
          />
        <BulkDatePickerSheet isOpen={isBulkDateOpen} count={selectedTasks.length} isWorking={isBulkWorking} onClose={() => setIsBulkDateOpen(false)} onSave={(date) => runBulkUpdate({ date })} />
        <BulkVisibilitySheet isOpen={isBulkVisibilityOpen} count={selectedTasks.length} isWorking={isBulkWorking} onClose={() => setIsBulkVisibilityOpen(false)} onSave={(visibility) => runBulkUpdate({ visibility })} />
      </AnimatePresence>
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
        onShare={() => { setShareSheetMounted(true); setIsShareSheetOpen(true); }}
        onAddPhoto={handleOpenImagePicker}
        onViewPhoto={handleOpenImageViewer}
        onDeletePhoto={handleRequestDeletePhoto}
        onDoItTomorrowOrToday={handleDoItTomorrowOrToday}
      />
      <Suspense fallback={null}>
        {shareSheetMounted && (
          <LazyShareTaskSheet
            isOpen={isShareSheetOpen && !!activeTask}
            onClose={() => setIsShareSheetOpen(false)}
            task={activeTask}
          />
        )}
      </Suspense>
      <MemoSheet isOpen={isMemoOpen && !!activeTask} onClose={handleCloseMemo}
        task={activeTask} onSave={handleMemoSave} initialMode={memoInitialMode} />
      <DatePickerSheet isOpen={isDatePickerOpen && !!activeTask}
        onClose={handleCloseDatePicker} task={activeTask} onDateChange={handleDateChange} />
      <TaskVisibilitySheet isOpen={isVisibilityOpen && !!activeTask}
        onClose={handleCloseVisibility} task={activeTask} category={activeTaskCategory}
        onSave={handleVisibilitySave} />
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
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        title={`Delete ${selectedTasks.length} ${selectedTasks.length === 1 ? 'Task' : 'Tasks'}?`}
        message="The selected tasks will be removed from your calendar."
        confirmLabel={isBulkWorking ? 'Deleting…' : 'Delete'}
        destructive
        isProcessing={isBulkWorking}
        processingLabel="Deleting…"
        onConfirm={handleBulkDelete}
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
          <Suspense fallback={<ImageViewerLoadingFallback />}>
            <ImageViewer
              isOpen
              imageUrl={viewingImageUrl}
              taskTitle={viewingTask.title}
              taskDate={viewingTask.date}
              onClose={handleCloseImageViewer}
            />
          </Suspense>
        ) : isViewingImageLoading ? <ImageViewerLoadingFallback /> : imageViewerUnavailable
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
      onClose={handleSheetClose}
      ariaLabel={format(selectedDate, 'EEEE, MMMM d, yyyy')}
      height="full"
      isLocked={isBackgroundLocked || isTaskReorderActive}
      preventDismiss={isTaskReorderActive}
      suspendInteraction={isBackgroundLocked}
      contentMode="fixed"
      onHorizontalSwipe={handleSheetHorizontalSwipe}
      onAnimationComplete={handleSheetSettled}
      deferChildrenUntilPaint
      onTransientDismiss={() => {
        if (!isSelectMode || isBackgroundLocked) return false;
        exitSelectMode();
        return true;
      }}
    >
      <div
        data-testid="day-sheet-swipe-surface"
        data-day-view-focus-scope={focusTaskId ? 'true' : undefined}
        className="flex h-full min-h-0 flex-col"
      >
        {content}
      </div>
    </BottomSheet>
  );
};
