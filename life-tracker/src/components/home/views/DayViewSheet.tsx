/* Day View owns stable, manually memoized callbacks for the shared sheet/swiper
 * state machine. The compiler's dependency inference incorrectly treats
 * stable React state setters as changing dependencies here.
 */
/* eslint-disable react-hooks/preserve-manual-memoization */
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
const DayLayoutMenu = React.lazy(() => import('./DayLayoutMenu').then(m => ({ default: m.DayLayoutMenu })));
import { runBulkTaskActions } from './bulkTaskActions';
import { toggleCategoryDaySelection } from '../../../lib/categoryDaySelection';
import { formatSelectedTasksForClipboard, resolveTaskCompletionSortMode } from '../../../lib/taskOrder';
import { addDays, format, isToday } from 'date-fns';
import { Swiper, SwiperSlide } from 'swiper/react';
import { FreeMode, Virtual } from 'swiper/modules';
import 'swiper/css/virtual';
import 'swiper/css/free-mode';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckSquare, CircleHelp, ChevronLeft, ChevronRight, Copy, MoreHorizontal, Trash2, ListOrdered, Settings2 } from 'lucide-react';
import { useInRouterContext, useNavigate } from 'react-router-dom';
import { makeRouteParentState } from '../../../lib/primarySwipeNavigation';
import { BottomSheet } from '../../ui/BottomSheet';
import { AppearanceContext } from '../../../hooks/appearanceContext';
import { systemRequestsReducedMotion } from '../../../lib/motionPreferences';
import { ConfirmSheet } from '../../ui/ConfirmSheet';
import { DaySlide } from './DaySlide';
import { canAddNewTaskToCategory } from '../../../lib/categoryLifecycle';
import { FirstCategoryPrompt } from './FirstCategoryPrompt';
import { resolveDayViewMode, resolveTimelineDirection, resolveTimelineSortBasis, resolveTimestampLabelStyle } from '../../../lib/taskTimeline';
const LazyTaskTimelineList = React.lazy(() => import('./TaskTimelineList').then(m => ({ default: m.TaskTimelineList })));
const LazyBulkTaskActionSheet = lazy(() => import('./BulkTaskActionSheet').then(m => ({ default: m.BulkTaskActionSheet })));
const LazyBulkCategoryPickerSheet = lazy(() => import('./BulkCategoryPickerSheet').then(m => ({ default: m.BulkCategoryPickerSheet })));
const LazyBulkVisibilitySheet = lazy(() => import('./BulkVisibilitySheet').then(m => ({ default: m.BulkVisibilitySheet })));
import { useContinuousTaskDrag } from './useContinuousTaskDrag';
import { createPreloadedLazy } from '../../../lib/createPreloadedLazy';
import { CategoryManagerOpenContext } from './categoryManagerOpenContext';
const { Component: LazyCategoryManagerSheet, preload: preloadCategoryManagerSheet } =
  createPreloadedLazy(() => import('../../modals/CategoryManagerSheet').then(m => m.CategoryManagerSheet));
import { TaskActionSheet } from './TaskActionSheet';
const { Component: LazyLinkTaskToBucketSheet, preload: preloadLinkTaskToBucketSheet } =
  createPreloadedLazy(() => import('./LinkTaskToBucketSheet').then(m => m.LinkTaskToBucketSheet));
const { Component: LazyShareTaskSheet, preload: preloadShareTaskSheet } =
  createPreloadedLazy(() => import('./ShareTaskSheet').then(m => m.ShareTaskSheet));
import { useSharedTasks } from '../../../hooks/useSharedTasks';
import { useOptionalFriendList } from '../../../hooks/useFriends';
import { ownerShareLabels } from '../../../lib/sharedTaskPresentation';
import type { SharedTaskItem } from '../../../lib/taskShareQueue';
import { editSharedTask } from '../../../lib/taskShareQueue';
import { parseSharedPlacement, placementKey, planSharedTaskMove } from '../../../lib/sharedTaskPlacement';
const LazyMemoSheet = lazy(() => import('./MemoSheet').then(m => ({ default: m.MemoSheet })));
const LazyImagePickerSheet = lazy(() => import('./ImagePickerSheet').then(m => ({ default: m.ImagePickerSheet })));
import { TaskVisibilitySheet } from './TaskVisibilitySheet';
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
import { canUseKeyboardShortcut } from '../../../lib/keyboardShortcuts';
import { useKeyboardShortcuts } from '../../../hooks/keyboardShortcutsContext';
import { useSettings } from '../../../hooks/useSettings';
import { useFeatureEnabled } from '../../../hooks/useFeatureEnabled';
import { isFeatureEnabled } from '../../../lib/featureControls';
import {
  ADD_TASKS_TO_TOP_SETTING_KEY,
  CONFIRM_TASK_DELETE_SETTING_KEY,
  shouldConfirmTaskDelete,
  TASK_COMPLETION_SORT_SETTING_KEY,
  SHOW_TASK_CREATED_TIME_SETTING_KEY,
  SHOW_TASK_COMPLETED_TIME_SETTING_KEY,
  TASK_TIMESTAMP_LABEL_STYLE_SETTING_KEY,
  DAY_VIEW_MODE_SETTING_KEY,
  TIMELINE_DIRECTION_SETTING_KEY,
  TIMELINE_SORT_BASIS_SETTING_KEY,
  CONTINUE_ADDING_TASKS_SETTING_KEY,
  HOLIDAY_REGION_SETTING_KEY,
  HOLIDAY_TYPES_SETTING_KEY,
  SHOW_CATEGORY_COLLAPSE_SETTING_KEY,
  SHOW_ADD_CATEGORY_IN_DAY_VIEW_SETTING_KEY,
  SHOW_DAY_VIEW_TODAY_TAG_SETTING_KEY,
  SHOW_DIARY_IN_DAY_VIEW_SETTING_KEY,
  DIARY_DAY_VIEW_POSITION_SETTING_KEY,
  resolveDiaryDayViewPosition,
  SHOW_HOLIDAYS_SETTING_KEY,
} from '../../../lib/preferences';
import { useHolidaysByDate } from '../../../hooks/useHolidays';
import { diaryPlacementKey, normalizeDiaryPlacement } from '../../../lib/diaryPlacement';
import {
  EMPTY_HOLIDAYS,
  createHolidayDisplayConfig,
  type HolidayDisplayConfig,
} from '../../../lib/holidays';

const ImageViewer = lazy(() =>
  import('./ImageViewer').then(({ ImageViewer }) => ({ default: ImageViewer }))
);

// A separate router-bound control keeps non-router Day View embeds and unit tests valid.
const DayViewSettingsShortcut: React.FC<{
  date: Date;
  onClose: () => void;
  disabled: boolean;
}> = ({ date, onClose, disabled }) => {
  const navigate = useNavigate();
  return (
    <button type="button" disabled={disabled}
      aria-label="Open Day View settings" title="Day View settings"
      onClick={() => {
        onClose();
        navigate('/settings/preferences/day-view', {
          state: {
            ...makeRouteParentState('/home'),
            dayViewReturnDate: format(date, 'yyyy-MM-dd'),
          },
        });
      }}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--mosaic-border)] bg-surfaceHighlight text-secondary transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--mosaic-accent)] disabled:opacity-40"
    >
      <Settings2 size={16} aria-hidden="true" />
    </button>
  );
};

const DAY_SWIPER_FOCUSABLE_ELEMENTS =
  'input, select, option, textarea, video, label, button:not([data-day-swipe-through="true"])';
// Do not invalidate every DaySlide when the owned-share projection is empty.
const EMPTY_OWNER_LABELS: ReadonlyMap<string, string> = new Map();
const DAY_SWIPER_TRANSITION_SPEED_MS = 320;
const DAY_SWIPER_TRANSITION_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
// FreeMode follows the finger; Day View owns the release target so a gesture
// cannot fling across multiple dates or leave a slide between snap points.
const DAY_SWIPER_MOMENTUM = {
  enabled: true,
  momentum: true,
  momentumRatio: 0.2,
  momentumVelocityRatio: 0.55,
  momentumBounce: false,
  sticky: true,
} as const;

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
  renderMode?: 'sheet' | 'inline' | 'backlog' | 'panel';
  tasks?: TaskDocument[];
  categories?: CategoryDocument[];
  focusTaskId?: string | null;
  holidayConfig?: HolidayDisplayConfig;
  showDiaryAlways?: boolean;
}

interface SheetContentControls {
  close: () => void;
  settled: () => void;
  transientDismiss: () => boolean;
  horizontalSwipe: (direction: 'left' | 'right') => void;
}

interface SheetContentLock {
  background: boolean;
  reorder: boolean;
}

const DayViewSheetInner: React.FC<DayViewSheetProps & {
  shellControlsRef?: React.MutableRefObject<SheetContentControls | null>;
  onLockChange?: (next: SheetContentLock) => void;
}> = ({
  isOpen,
  onClose,
  selectedDate,
  onDateChange,
  renderMode = 'sheet',
  tasks: tasksOverride,
  categories: categoriesOverride,
  focusTaskId = null,
  holidayConfig: holidayConfigOverride,
  showDiaryAlways = false,
  shellControlsRef,
  onLockChange,
}) => {
  // Preserve the mature, manually memoized Day View gesture and sheet lifecycles.
  // The React Compiler cannot safely infer dependencies across these state machines.
  'use no memo';
  const isBacklogView = renderMode === 'backlog';
  const hasRouter = useInRouterContext();
  const sheetContentRef = useRef<HTMLDivElement>(null);
  const daySwipeStartRef = useRef<{ index: number; time: number; pointerId: number | null; touchId: number | null } | null>(null);
  const didInitialCategoryFocusRef = useRef(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const keyboardHelpCloseRef = useRef<HTMLButtonElement>(null);
  const keyboardHelpTriggerRef = useRef<HTMLButtonElement>(null);
  const keyboardHelpReturnRef = useRef<HTMLElement | null>(null);
  const showKeyboardHelp = useCallback(() => {
    // Opening help is an explicit focus choice; do not let Day View's
    // initial-autofocus frame move focus away from the help Close button.
    didInitialCategoryFocusRef.current = true;
    keyboardHelpReturnRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setKeyboardHelpOpen(true);
  }, []);
  const hideKeyboardHelp = useCallback(() => {
    setKeyboardHelpOpen(false);
    const former = keyboardHelpReturnRef.current;
    window.requestAnimationFrame(() => {
      if (former?.isConnected && !former.closest('[aria-hidden="true"], [inert]')) {
        former.focus({ preventScroll: true });
      } else {
        keyboardHelpTriggerRef.current?.focus({ preventScroll: true });
      }
    });
  }, []);
  useEffect(() => {
    if (isOpen) return;
    // Closing may retain the mounted Day View for its exit animation. Reset
    // after paint rather than synchronously cascading a render from an effect.
    const frame = window.requestAnimationFrame(() => setKeyboardHelpOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);
  useEffect(() => {
    if (keyboardHelpOpen) keyboardHelpCloseRef.current?.focus({ preventScroll: true });
  }, [keyboardHelpOpen]);
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
    moveTaskAcrossDays,
  } = taskStore;
  // With an empty override, wait for owner category hydration before prompting.
  const { categories: hookCategories = [], isLoading: categoriesLoading, addCategory, reorderCategories, updateCategory } = useCategories(
    categoriesOverride === undefined || categoriesOverride.length === 0
  );
  const { message: deleteFeedback, show: showFeedback } = useFeedback();
  const handleSharedMoveError = useCallback((error: unknown) => {
    showFeedback(error instanceof Error ? error.message : 'Could not move shared task.');
  }, [showFeedback]);
  const { getSetting, setSetting, settings } = useSettings();
  const { enabled: shortcutsEnabled } = useKeyboardShortcuts();
  const continueAddingTasks =
    getSetting(CONTINUE_ADDING_TASKS_SETTING_KEY, false) === true;
  const addTasksToTop =
    getSetting(ADD_TASKS_TO_TOP_SETTING_KEY, false) === true;
  const confirmTaskDelete = shouldConfirmTaskDelete(getSetting(CONFIRM_TASK_DELETE_SETTING_KEY));
  const taskTimestampsEnabled = useFeatureEnabled('mosaic_disable_task_timestamps');
  const bulkActionsEnabled = useFeatureEnabled('mosaic_disable_task_bulk_actions');
  const socialEnabled = useFeatureEnabled('mosaic_disable_all_social');
  const taskDragReorderEnabled = useFeatureEnabled('mosaic_disable_task_drag_reorder');
  const taskBucketLinkEnabled = useFeatureEnabled('mosaic_disable_task_bucket_link');
  const dayViewDiaryPanelEnabled = useFeatureEnabled('mosaic_disable_day_view_diary_panel');
  const showCreatedTime = taskTimestampsEnabled && getSetting(SHOW_TASK_CREATED_TIME_SETTING_KEY, false) === true;
  const showCompletedTime = taskTimestampsEnabled && getSetting(SHOW_TASK_COMPLETED_TIME_SETTING_KEY, false) === true;
  const timestampLabelStyle = resolveTimestampLabelStyle(getSetting(TASK_TIMESTAMP_LABEL_STYLE_SETTING_KEY, 'icons'));
  // Keep task rows' display preferences referentially stable while unrelated
  // nested overlays open; updates still propagate when a preference changes.
  const timestampDisplay = useMemo(() => ({
    showCreated: showCreatedTime,
    showCompleted: showCompletedTime,
    labelStyle: timestampLabelStyle,
  }), [showCreatedTime, showCompletedTime, timestampLabelStyle]);
  const timelineModeEnabled = useFeatureEnabled('mosaic_disable_timeline_mode');
  // Fall back in presentation only; retain the saved preference for restoration.
  const dayViewMode = timelineModeEnabled ? resolveDayViewMode(getSetting(DAY_VIEW_MODE_SETTING_KEY, 'categories')) : 'categories';
  const timelineDirection = resolveTimelineDirection(getSetting(TIMELINE_DIRECTION_SETTING_KEY, 'desc'));
  const timelineSortBasis = resolveTimelineSortBasis(getSetting(TIMELINE_SORT_BASIS_SETTING_KEY, 'completion'));
  const taskSortMode = resolveTaskCompletionSortMode(
    getSetting(TASK_COMPLETION_SORT_SETTING_KEY, 'manual')
  );
  const showCategoryCollapseButton =
    getSetting(SHOW_CATEGORY_COLLAPSE_SETTING_KEY, false) === true;
  const alwaysShowAddCategory = getSetting(SHOW_ADD_CATEGORY_IN_DAY_VIEW_SETTING_KEY, false) === true;
  const showDayViewTodayTag =
    getSetting(SHOW_DAY_VIEW_TODAY_TAG_SETTING_KEY, false) === true;
  const showDiaryInDayView = dayViewDiaryPanelEnabled && !isBacklogView && (showDiaryAlways || getSetting(SHOW_DIARY_IN_DAY_VIEW_SETTING_KEY, false) === true);
  const diaryPosition = resolveDiaryDayViewPosition(getSetting(DIARY_DAY_VIEW_POSITION_SETTING_KEY, 'top'));
  const holidayConfig =
    holidayConfigOverride ??
    createHolidayDisplayConfig(
      getSetting(SHOW_HOLIDAYS_SETTING_KEY, false),
      getSetting(HOLIDAY_REGION_SETTING_KEY, ''),
      getSetting(HOLIDAY_TYPES_SETTING_KEY, 'public-and-observances')
    );

  const tasks = tasksOverride ?? taskStore.tasks ?? EMPTY_TASKS;
  const backlogTasks = useMemo(() => tasks.filter((task) => task.date === '' && !task.isDeleted), [tasks]);
  const categories = categoriesOverride ?? hookCategories;
  const tasksByDate = useTasksByDate(tasks);
  const [ownerPendingRevision, setOwnerPendingRevision] = useState(0);
  const [isSharedSheetOpen, setIsSharedSheetOpen] = useState(false);
  useEffect(() => subscribeOwnerCompletionPending(() => setOwnerPendingRevision(n => n + 1)), []);
  const pendingOwnedTaskIds = useMemo(() => pendingOwnerCompletionIds(currentUserId),
    [currentUserId, ownerPendingRevision]);
  const sharedTasks = useSharedTasks('received', isOpen);
  const ownerShares = useSharedTasks('owned', isOpen);
  const sharingFriends = useOptionalFriendList();
  const labelMode = getSetting('sharedTaskLabelMode', 'names') === 'count' ? 'count' : 'names';
  const showPendingShares = getSetting('showPendingSharedTaskInvites', false) === true;
  const ownerLabels = useMemo(() => {
    const labels = ownerShareLabels(ownerShares.items, sharingFriends, labelMode, showPendingShares);
    return labels.size === 0 ? EMPTY_OWNER_LABELS : labels;
  }, [ownerShares.items, sharingFriends, labelMode, showPendingShares]);

  const validCategoryIds = useMemo(() => new Set(categories.map(cat => cat.id)), [categories]);
  const sharedCategoryFor = useCallback((item: SharedTaskItem): string => {
    const raw = settings[placementKey(item.id)];
    return parseSharedPlacement(raw, validCategoryIds)?.categoryId || '';
  }, [settings, validCategoryIds]);
  const sharedOrderFor = useCallback((item: SharedTaskItem) =>
    parseSharedPlacement(settings[placementKey(item.id)], validCategoryIds)?.order ?? 0,
  [settings, validCategoryIds]);
  const moveSharedTask = useCallback(async (item: SharedTaskItem,
    categoryId: string, targetId: string, position: string) => {
    if (!validCategoryIds.has(categoryId)) throw new Error('Destination category unavailable');
    if (item.id === targetId) return;
    const updates = planSharedTaskMove(
      item, categoryId, targetId,
      position === 'start' || position === 'index' || position === 'after' || position === 'before'
        ? position : 'start',
      sharedTasks.activeItems, sharedCategoryFor, sharedOrderFor,
    );
    // Distinct settings rows, but serialize the order to avoid stale RxDB
    // projections racing against a same-moment gesture or sheet change.
    for (const change of updates) {
      await setSetting(placementKey(change.id), { categoryId: change.categoryId, order: change.order });
    }
  }, [validCategoryIds, sharedTasks.activeItems, sharedCategoryFor, sharedOrderFor, setSetting]);
  const assignSharedCategory = useCallback(async (item: SharedTaskItem, categoryId: string) => {
    if (categoryId && !validCategoryIds.has(categoryId)) throw new Error('Category unavailable');
    if (categoryId && !canAddNewTaskToCategory(categories.find(cat => cat.id === categoryId)!, item.date)) {
      throw new Error('Cannot assign shared task to a retired category on this date');
    }
    await setSetting(placementKey(item.id), categoryId ? { categoryId, order: 0 } : null);
  }, [setSetting, validCategoryIds, categories]);
  const copySharedToMine = useCallback(async (item: SharedTaskItem, categoryId: string) => {
    if (!validCategoryIds.has(categoryId)) throw new Error('Choose one of your categories');
    await addTask({ title: item.title, categoryId, date: item.date,
      completed: false, visibility: '' }, addTasksToTop ? 'top' : 'bottom');
  }, [validCategoryIds, addTask, addTasksToTop]);
  const updateSharedTitle = useCallback(async (item: SharedTaskItem, title: string) => {
    await editSharedTask(item, { title });
    await sharedTasks.reload();
  }, [sharedTasks.reload]);
  const updateSharedDate = useCallback(async (item: SharedTaskItem, date: string) => {
    await editSharedTask(item, { date });
    await sharedTasks.reload();
  }, [sharedTasks.reload]);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [isBucketLinkOpen, setIsBucketLinkOpen] = useState(false);
  const [shareSheetMounted, setShareSheetMounted] = useState(false);
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);
  const [imagePickerTaskId, setImagePickerTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [memoInitialMode, setMemoInitialMode] = useState<'view' | 'edit'>('edit');
  const [isVisibilityOpen, setIsVisibilityOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isDeleteProcessing, setIsDeleteProcessing] = useState(false);
  const deletePendingRef = useRef(false);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [deletePhotoConfirmOpen, setDeletePhotoConfirmOpen] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());
  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false);
  const [isBulkCategoryOpen, setIsBulkCategoryOpen] = useState(false);
  const [isBulkVisibilityOpen, setIsBulkVisibilityOpen] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const bulkDeletePendingRef = useRef(false);
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
    setIsBulkVisibilityOpen(false);
    setIsBulkDeleteOpen(false);
  }, [isBulkWorking]);

  const {
    swiperRef,
    slideDates,
    slideDateStrs,
    activeIndex,
    initialIndex,
    anchorKey,
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
      isVisibilityOpen ||
      isDeleteConfirmOpen ||
      isImageViewerOpen ||
      deletePhotoConfirmOpen ||
      isBulkActionOpen ||
      isBulkCategoryOpen ||
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

  const activeDateStr = isBacklogView ? '' : (slideDateStrs[activeIndex] ?? format(selectedDate, 'yyyy-MM-dd'));
  const continuousDrag = useContinuousTaskDrag({
    isOpen: isOpen && !isBacklogView,
    currentUserId,
    swiperRef,
    categories,
    onCommit: (task, date, categoryId, index) =>
      moveTaskAcrossDays(task.id, task.date, date, categoryId, index),
    onFeedback: showFeedback,
    onExternalFinished: () => setIsTaskReorderActive(false),
  });
  const handleReorderActiveChange = useCallback((active: boolean) => {
    setIsTaskReorderActive(active || Boolean(continuousDrag.carried));
  }, [continuousDrag.carried]);
  useEffect(() => {
    continuousDrag.onWindowRebased();
  }, [anchorKey, continuousDrag.onWindowRebased]);

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

  // Only the active day and its six fast-swipe neighbors need labels.
  // Formatting all 181 geometry dates during the opening render delays the
  // sheet without making the off-window slides any more usable.
  const slideDateLabels = useMemo(() => {
    const labels = new Map<number, string>();
    const start = Math.max(0, activeIndex - renderWindow);
    const end = Math.min(slideDates.length - 1, activeIndex + renderWindow);
    for (let i = start; i <= end; i += 1) {
      labels.set(i, format(slideDates[i], 'EEEE, MMMM d, yyyy'));
    }
    return labels;
  }, [activeIndex, renderWindow, slideDates]);

  const [deferredRenderWindow, setDeferredRenderWindow] = useState(0);
  // #7: this fires on any BottomSheet animation completion (entrance and
  // drag snap-back), so "settled" is more accurate than "complete".
  const handleSheetSettled = useCallback(() => {
    if (isOpen) setDeferredRenderWindow(renderWindow);
  }, [isOpen, renderWindow]);

  // Inline Todo Day View has no sheet entrance animation, so its initial render
  // window must not wait for BottomSheet's animation-complete callback.
  const effectiveRenderWindow =
    (renderMode === 'inline' || renderMode === 'panel') ? renderWindow : deferredRenderWindow;

  const handleSheetClose = useCallback(() => {
    continuousDrag.cancel();
    setDeferredRenderWindow(0);
    setIsTaskReorderActive(false);
    setIsSelectMode(false);
    setSelectedTaskIds(new Set());
    onClose();
  }, [continuousDrag.cancel, onClose]);

  useEffect(() => {
    if (!isOpen || (renderMode !== 'sheet' && renderMode !== 'panel' && !isBacklogView) || !focusTaskId) return;

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
  }, [focusTaskId, isBacklogView, isOpen, renderMode, selectedDate]);

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
    if (!continuousDrag.onSlideChanged(swiper)) return;
    if (isSelectMode) exitSelectMode();
    handleSlideChange(swiper);
  }, [continuousDrag.onSlideChanged, exitSelectMode, handleSlideChange, isSelectMode]);

  const handleSwipeSettledFromUi = useCallback((swiper: Parameters<typeof handleSwipeSettled>[0]) => {
    const settled = slideDateStrs[swiper.activeIndex];
    if (!settled || !continuousDrag.onSettled(settled, swiper)) return;
    handleSwipeSettled(swiper);
  }, [continuousDrag.onSettled, handleSwipeSettled, slideDateStrs]);

  const daySwipeConditionsRef = useRef({
    reorderActive: isTaskReorderActive,
    carried: Boolean(continuousDrag.carried),
    reducedMotion,
    slideCount: slideDates.length,
  });
  React.useLayoutEffect(() => {
    daySwipeConditionsRef.current = {
      reorderActive: isTaskReorderActive,
      carried: Boolean(continuousDrag.carried),
      reducedMotion,
      slideCount: slideDates.length,
    };
  }, [isTaskReorderActive, continuousDrag.carried, reducedMotion, slideDates.length]);

  const handleDayTouchStart = useCallback((swiper: Parameters<typeof handleSlideChange>[0]) => {
    const state = daySwipeConditionsRef.current;
    daySwipeStartRef.current =
      !state.reducedMotion && !state.reorderActive && !state.carried && swiper.touchEventsData.isTouched
        ? {
            index: swiper.activeIndex,
            time: Date.now(),
            pointerId: swiper.touchEventsData.pointerId,
            touchId: swiper.touchEventsData.touchId,
          }
        : null;
  }, []);

  const settleDayTouch = useCallback(() => {
    const start = daySwipeStartRef.current;
    daySwipeStartRef.current = null;
    const swiper = swiperRef.current;
    const state = daySwipeConditionsRef.current;
    // Held-task dragging has its own repeated cross-day navigation protocol.
    if (!start || !swiper || swiper.destroyed || state.reorderActive || state.carried ||
        !swiper.touchEventsData.isMoved || !swiper.swipeDirection) return;

    const distance = Math.abs(swiper.touches.diff);
    const velocity = distance / Math.max(1, Date.now() - start.time);
    // A horizontal pointercancel is common when Virtual swaps the finger's
    // source slide. Treat it as release, not as a request to undo the gesture.
    const advance = distance >= swiper.width * 0.45 || (distance >= 20 && velocity >= 0.65);
    const offset = advance ? (swiper.swipeDirection === 'next' ? 1 : -1) : 0;
    const destination = Math.min(Math.max(start.index + offset, 0), state.slideCount - 1);
    const duration = Math.round(Math.max(180, 320 - Math.min(velocity, 2) * 70));

    // Swiper Virtual can lose its own touchEnd when the active slide changes
    // beneath the finger. Finish from capture before that happens,
    // then prevent a second unbounded FreeMode release.
    swiper.touchEventsData.isTouched = false;
    swiper.touchEventsData.isMoved = false;
    swiper.touchEventsData.startMoving = false;
    // Core's onTouchEnd may never run after a Virtual slide changes underneath
    // the touch, so also clear its retained input IDs and FreeMode samples.
    // Otherwise Swiper rejects the next pointerdown as a different pointer.
    swiper.touchEventsData.pointerId = null;
    swiper.touchEventsData.touchId = null;
    swiper.touchEventsData.velocities.length = 0;
    swiper.slideTo(destination, duration);
  }, [swiperRef]);

  useEffect(() => {
    const onPointerUp = (event: PointerEvent) => {
      const start = daySwipeStartRef.current;
      if (start && (start.pointerId === event.pointerId || event.isPrimary)) settleDayTouch();
    };
    const onPointerCancel = (event: PointerEvent) => {
      const start = daySwipeStartRef.current;
      if (start && (start.pointerId === event.pointerId || event.isPrimary)) settleDayTouch();
    };
    const onTouchEnd = (event: TouchEvent) => {
      const start = daySwipeStartRef.current;
      // Swiper Virtual may drop its touch identifier when the source slide
      // changes underneath the finger. Wait until the final touch lifts.
      if (start && event.touches.length === 0) settleDayTouch();
    };
    const onTouchCancel = (event: TouchEvent) => {
      const start = daySwipeStartRef.current;
      if (start && event.touches.length === 0) settleDayTouch();
    };
    // Window capture runs before Swiper's own document touch-end listeners,
    // including when Virtual swaps the active slide during finger tracking.
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerCancel, true);
    window.addEventListener('touchend', onTouchEnd, true);
    window.addEventListener('touchcancel', onTouchCancel, true);
    return () => {
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerCancel, true);
      window.removeEventListener('touchend', onTouchEnd, true);
      window.removeEventListener('touchcancel', onTouchCancel, true);
    };
  }, [settleDayTouch]);

  const handleDayTouchEnd = useCallback(() => settleDayTouch(), [settleDayTouch]);

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

  const handleToggleCategorySelection = useCallback((categoryId: string) => {
    if (!isSelectMode || isBacklogView || !currentUserId) return;
    setSelectedTaskIds(current => toggleCategoryDaySelection(
      current, tasks, categoryId, activeDateStr, currentUserId
    ));
  }, [activeDateStr, currentUserId, isBacklogView, isSelectMode, tasks]);

  const handleToggleSelectMode = useCallback(() => {
    if (isSelectMode) {
      exitSelectMode();
      return;
    }
    if (!isFeatureEnabled('mosaic_disable_task_bulk_actions')) return;
    setEditingTaskId(null);
    setEditValue('');
    setSelectedTaskIds(new Set());
    setIsSelectMode(true);
  }, [exitSelectMode, isSelectMode]);

  React.useEffect(() => {
    if (bulkActionsEnabled || !isSelectMode || isBulkWorking) return;
    let active = true;
    queueMicrotask(() => { if (active) exitSelectMode(); });
    return () => { active = false; };
  }, [bulkActionsEnabled, exitSelectMode, isBulkWorking, isSelectMode]);

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
    if (snapshot.length === 0 || isBulkWorking || bulkDeletePendingRef.current) return;
    bulkDeletePendingRef.current = true;
    setIsBulkWorking(true);
    try {
      const failedIds = await runBulkTaskActions(snapshot, (task) => deleteTask(task.id));
      if (failedIds.size > 0) {
        setSelectedTaskIds(failedIds);
        setIsBulkDeleteOpen(false);
        showFeedback(`${failedIds.size} ${failedIds.size === 1 ? 'task' : 'tasks'} could not be deleted`);
        return;
      }
      exitSelectMode();
    } finally {
      bulkDeletePendingRef.current = false;
      setIsBulkWorking(false);
    }
  }, [deleteTask, exitSelectMode, isBulkWorking, selectedTasks, showFeedback]);

  const handleAddTask = useCallback(
    (title: string, categoryId: string, dateStr: string, completed = false) => {
      void Promise.resolve(addTask(
        {
          title,
          categoryId,
          date: dateStr,
          completed,
          ...(completed ? { completedAt: new Date().toISOString() } : {}),
          visibility: dateStr === '' ? 'private' : '',
        },
        addTasksToTop ? 'top' : 'bottom'
      )).catch(error => showFeedback(error instanceof Error ? error.message : 'Could not create task'));
    },
    [addTask, addTasksToTop, showFeedback]
  );

  const handleOpenActions = useCallback((task: TaskDocument) => {
    // The user requested task actions: warm only code for its two nested
    // sheets while the action menu opens; no hidden sheet or data hooks.
    if (!document.hidden) {
      void preloadShareTaskSheet().catch(() => {});
      void preloadLinkTaskToBucketSheet().catch(() => {});
    }
    setActiveTaskId(task.id);
    setIsActionSheetOpen(true);
  }, []);

  const handleCloseActions = useCallback(() => {
    setIsActionSheetOpen(false);
  }, []);

  const leaveSharedTask = sharedTasks.updateMembership;
  const updateSharedCompletion = sharedTasks.updateCompletion;
  const handleLeaveSharedTask = useCallback(async (item: SharedTaskItem) => {
    const outcome = await leaveSharedTask(item, 'leave');
    if (outcome.status === 'pending') showFeedback('Leaving task queued for sync.');
    if (outcome.status === 'rejected') showFeedback(outcome.reason || 'Could not leave shared task.');
  }, [leaveSharedTask, showFeedback]);
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
    if (!activeTask || deletePendingRef.current) return;
    const taskId = activeTask.id;
    deletePendingRef.current = true;
    setIsDeleteProcessing(true);
    try {
      await deleteTask(taskId);
      setIsDeleteConfirmOpen(false);
      setActiveTaskId(current => current === taskId ? null : current);
    } catch {
      showFeedback('Task could not be deleted');
    } finally {
      deletePendingRef.current = false;
      setIsDeleteProcessing(false);
    }
  }, [activeTask, deleteTask, showFeedback]);

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

  const handleMoveToBacklog = useCallback(async () => {
    if (!activeTask) return;
    await updateTask(activeTask.id, { date: '' });
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

  const handleOpenVisibility = useCallback(() => {
    setIsVisibilityOpen(true);
    setIsActionSheetOpen(false);
  }, []);

  const handleOpenDeleteConfirm = useCallback(() => {
    setIsActionSheetOpen(false);
    if (confirmTaskDelete) setIsDeleteConfirmOpen(true);
    else void handleDelete();
  }, [confirmTaskDelete, handleDelete]);

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
    isSharedSheetOpen ||
    isShareSheetOpen ||
    isMemoOpen ||
    isVisibilityOpen ||
    isDeleteConfirmOpen ||
    isImageViewerOpen ||
    deletePhotoConfirmOpen ||
    isBulkActionOpen ||
    isBulkCategoryOpen ||
    isBulkVisibilityOpen ||
    isBulkDeleteOpen ||
    isBulkWorking ||
    !!imagePickerTaskId;
  useEffect(() => {
    if (renderMode === 'sheet' || !isSelectMode) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isBackgroundLocked) return;
      event.preventDefault();
      exitSelectMode();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [exitSelectMode, isBackgroundLocked, isSelectMode, renderMode]);
  useEffect(() => {
    if (!shortcutsEnabled || !isOpen || isBackgroundLocked || isTaskReorderActive || keyboardHelpOpen ||
        editingTaskId !== null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 's' || event.key.length !== 1 ||
          !canUseKeyboardShortcut(event, { allowOpenDialog: true })) return;
      const root = renderMode === 'sheet' ? sheetContentRef.current :
        document.querySelector<HTMLElement>(renderMode === 'backlog'
          ? '[data-testid="backlog-day-view"]' : renderMode === 'panel'
            ? '[data-testid="day-sheet-swipe-surface"]' : '[data-testid="inline-day-view"]');
      if (!root || root.closest('[inert], [aria-hidden="true"]') ||
          !(event.target instanceof Node) || !root.contains(event.target)) return;
      const scope = isBacklogView ? root :
        root.querySelector<HTMLElement>('.swiper-slide:not([aria-hidden="true"])');
      const select = scope?.querySelector<HTMLButtonElement>(
        'button[aria-label="Select tasks"], button[aria-label="Exit selection mode"]'
      );
      if (!select || select.disabled) return;
      event.preventDefault();
      select.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcutsEnabled, isOpen, isBackgroundLocked, isTaskReorderActive, keyboardHelpOpen,
    editingTaskId, renderMode, isBacklogView]);

  // The BottomSheet trap initially focuses the header's Previous button.
  // After its focus setup, start keyboard browsing at the first visible
  // category instead. Only do this once per sheet opening, not on day swipes,
  // changes in task data, drag snap-back or nested sheet restoration.
  useEffect(() => {
    if (!isOpen) {
      didInitialCategoryFocusRef.current = false;
      return;
    }
    if (renderMode !== 'sheet' || focusTaskId || isBackgroundLocked ||
        didInitialCategoryFocusRef.current) return;
    const frame = window.requestAnimationFrame(() => {
      if (didInitialCategoryFocusRef.current) return;
      const root = sheetContentRef.current;
      if (!root || root.closest('[inert], [aria-hidden="true"]')) return;
      const target = root.querySelector<HTMLButtonElement>(
        '.swiper-slide:not([aria-hidden="true"]) [data-day-keyboard-target="category"]:not(:disabled)'
      );
      if (!target) return; // Categories may still be loading.
      const focused = document.activeElement;
      // Never override a task being edited or a target already chosen by user.
      if (focused instanceof Element && root.contains(focused) &&
          focused.closest('input, textarea, select, [role="textbox"], [contenteditable], [data-day-keyboard-target]')) {
        didInitialCategoryFocusRef.current = true;
        return;
      }
      target.focus({ preventScroll: true });
      didInitialCategoryFocusRef.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, renderMode, focusTaskId, isBackgroundLocked, activeIndex, categories]);

  // A11Y-33: arrows still change dates outside editable fields. When a
  // keyboard user changes dates, move focus out of the now-hidden Swiper slide.
  const keyboardDateFocusRef = useRef<{ categoryId: string | null } | null>(null);
  const navigateDateByKeyboard = (direction: 'left' | 'right') => {
    keyboardDateFocusRef.current = {
      categoryId: document.activeElement instanceof Element
        ? document.activeElement.closest('[data-task-category-id]')?.getAttribute('data-task-category-id') ?? null
        : null,
    };
    if (direction === 'left') handlePrevDayFromUi();
    else handleNextDayFromUi();
  };
  useHorizontalArrowNavigation({
    enabled: isOpen && !isBacklogView && !isBackgroundLocked && !isTaskReorderActive && !keyboardHelpOpen,
    onLeft: () => navigateDateByKeyboard('left'),
    onRight: () => navigateDateByKeyboard('right'),
  });
  useEffect(() => {
    const pending = keyboardDateFocusRef.current;
    if (!pending || !isOpen || isBackgroundLocked) return;
    const slide = swiperRef.current?.el?.querySelector('.swiper-slide:not([aria-hidden="true"])');
    if (!slide) return;
    keyboardDateFocusRef.current = null;
    const category = pending.categoryId
      ? Array.from(slide.querySelectorAll<HTMLButtonElement>('[data-day-keyboard-target="category"]'))
        .find(button => button.dataset.dayKeyboardId === pending.categoryId && !button.disabled)
      : null;
    const target = category ??
      slide.querySelector<HTMLButtonElement>('[data-day-keyboard-target="category"]:not(:disabled)') ??
      slide.querySelector<HTMLButtonElement>('[data-day-view-navigation="true"] button');
    target?.focus({ preventScroll: true });
  }, [activeIndex, isBackgroundLocked, isOpen]);

  const handleTransientDismiss = useCallback(() => {
    if (!isSelectMode || isBackgroundLocked) return false;
    exitSelectMode();
    return true;
  }, [exitSelectMode, isBackgroundLocked, isSelectMode]);

  React.useLayoutEffect(() => {
    if (!shellControlsRef) return;
    shellControlsRef.current = {
      close: handleSheetClose,
      settled: handleSheetSettled,
      transientDismiss: handleTransientDismiss,
      horizontalSwipe: handleSheetHorizontalSwipe,
    };
    return () => { shellControlsRef.current = null; };
  }, [handleSheetClose, handleSheetSettled, handleSheetHorizontalSwipe, handleTransientDismiss, shellControlsRef]);

  React.useEffect(() => {
    onLockChange?.({ background: isBackgroundLocked, reorder: isTaskReorderActive });
  }, [onLockChange, isBackgroundLocked, isTaskReorderActive]);

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

  const keyboardHelpPanel = keyboardHelpOpen ? (
    <div
      role="region"
      aria-label="Day View keyboard shortcuts"
      className="mx-4 mb-2 rounded-xl border border-white/10 bg-[#222222] px-4 py-3 text-gray-200 shadow-lg"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          hideKeyboardHelp();
        }
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-semibold text-sm text-white">Keyboard shortcuts</p>
        <button
          ref={keyboardHelpCloseRef}
          type="button"
          onClick={hideKeyboardHelp}
          className="rounded-lg px-2 py-1 text-xs text-gray-300 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
        >Close</button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        <dt className="font-mono text-gray-100">↑ / ↓</dt><dd>Previous / next task or category</dd>
        <dt className="font-mono text-gray-100">Home / End</dt><dd>First / last visible item</dd>
        {!isBacklogView && <><dt className="font-mono text-gray-100">← / →</dt><dd>Previous / next day outside text editing</dd></>}
        <dt className="font-mono text-gray-100">S</dt><dd>Focus the Select tasks button</dd>
        <dt className="font-mono text-gray-100">N</dt><dd>New task in the focused category (not in Select mode)</dd>
        <dt className="font-mono text-gray-100">Enter</dt><dd>Edit a task; select it in Select mode</dd>
        <dt className="font-mono text-gray-100">Space</dt><dd>Complete a task; select it in Select mode</dd>
        <dt className="font-mono text-gray-100">Shift+Enter</dt><dd>Task actions (outside Select mode)</dd>
        <dt className="font-mono text-gray-100">?</dt><dd>Show this help from a task or category</dd>
        <dt className="font-mono text-gray-100">Tab</dt><dd>Move through other controls</dd>
        <dt className="font-mono text-gray-100">Esc</dt><dd>Cancel editing or close the active overlay</dd>
      </dl>
    </div>
  ) : null;

  const canCreateCategory = Boolean(isOpen && !isBacklogView && currentUserId &&
    !isSelectMode && !categoriesLoading &&
    categories.every(category => category.userId === currentUserId));
  const showFirstCategoryPrompt = canCreateCategory &&
    categories.length === 0 && hookCategories.length === 0;
  const showPersistentCategoryPrompt = canCreateCategory && alwaysShowAddCategory;
  const categoryCreationPrompt = showFirstCategoryPrompt || showPersistentCategoryPrompt ? (
    <FirstCategoryPrompt persistent={showPersistentCategoryPrompt} onCreate={async draft => {
      if (!currentUserId || categories.some(category => category.userId !== currentUserId) ||
          (!showPersistentCategoryPrompt && (categories.length > 0 || hookCategories.length > 0))) {
        throw new Error('Categories have changed. Try again.');
      }
      await addCategory({ ...draft, order: categories.length, icon: '' });
    }} />
  ) : undefined;
  // Empty owners keep the onboarding prompt unless the optional footer action is enabled.
  const firstCategoryPrompt = showPersistentCategoryPrompt ? undefined : categoryCreationPrompt;
  const footerCategoryPrompt = showPersistentCategoryPrompt ? categoryCreationPrompt : undefined;

  const content = (
    <>
      {isBacklogView ? (
        <>
          <div className="flex justify-end gap-2 px-4 py-2">
            <button type="button" ref={keyboardHelpTriggerRef} onClick={showKeyboardHelp}
              aria-label="Show keyboard shortcuts" aria-expanded={keyboardHelpOpen}
              className="hidden md:inline-flex rounded-lg px-2.5 py-1.5 text-gray-300 hover:bg-[#2A2A2A] focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            ><CircleHelp size={17} aria-hidden="true" /></button>
            {bulkActionsEnabled && <button type="button" onClick={handleToggleSelectMode}
              aria-label={isSelectMode ? 'Exit selection mode' : 'Select tasks'}
              aria-pressed={isSelectMode}
              className="rounded-lg px-3 py-1.5 text-sm text-gray-300 focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            >{isSelectMode ? 'Done' : 'Select'}</button>}
          </div>
          {keyboardHelpPanel}
          <DaySlide
            date={selectedDate}
            dateStr=""
            timestampDisplay={timestampDisplay}
            scrollMode="page"
            tasks={backlogTasks}
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
            continueAddingTasks={continueAddingTasks}
            showCategoryCollapseButton={showCategoryCollapseButton}
            taskSortMode={taskSortMode}
            selectionMode={isSelectMode}
            keyboardNavigationEnabled={isOpen && !isBackgroundLocked && !isTaskReorderActive && !keyboardHelpOpen}
            onShowKeyboardHelp={showKeyboardHelp}
            selectedTaskIds={selectedTaskIds}
            onToggleTaskSelection={handleToggleTaskSelection}
            reorderEnabled={taskDragReorderEnabled && isOpen && !isSelectMode && !isBackgroundLocked && editingTaskId === null}
            reorderRuntimeActive={isOpen}
            onReorderTasks={reorderTasks}
            onReorderCategories={currentUserId && categories.every(category => category.userId === currentUserId) ? reorderCategories : undefined}
            onUpdateCategory={currentUserId && categories.every(category => category.userId === currentUserId) ? updateCategory : undefined}
            onCategoryActionError={showFeedback}
            onReorderActiveChange={setIsTaskReorderActive}
          />
        </>
      ) : (
      <Swiper
        key={anchorKey}
        // Preserve all 181 logical dates for direct jumps, but avoid 181 DOM
        // slides (and their synchronous layout) on every sheet open.
        modules={renderMode === 'sheet' || renderMode === 'panel' ? [Virtual, FreeMode] : [FreeMode]}
        virtual={renderMode === 'sheet' || renderMode === 'panel' ? { addSlidesBefore: 3, addSlidesAfter: 3 } : false}
        freeMode={reducedMotion ? false : DAY_SWIPER_MOMENTUM}
        nested={renderMode !== 'sheet'}
        allowTouchMove={!isTaskReorderActive && !isSharedSheetOpen && !continuousDrag.projection}
        noSwiping={renderMode === 'sheet'}
        focusableElements={DAY_SWIPER_FOCUSABLE_ELEMENTS}
        touchStartPreventDefault={false}
        touchMoveStopPropagation={false}
        autoHeight={renderMode === 'inline'}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
          continuousDrag.onWindowRebased();
        }}
        onBeforeDestroy={(swiper) => {
          if (swiperRef.current === swiper) {
            swiperRef.current = null;
          }
        }}
        initialSlide={initialIndex}
        speed={reducedMotion ? 0 : DAY_SWIPER_TRANSITION_SPEED_MS}
        onSlideChange={handleSlideChangeFromUi}
        onTouchStart={handleDayTouchStart}
        onTouchEnd={handleDayTouchEnd}
        // FreeMode updates the active slide after transitionStart. Swiper may
        // emit transitionEnd without slideChangeTransitionEnd, so observe the
        // general completion signal to commit the visible date after inertia.
        onTransitionEnd={reducedMotion ? undefined : handleSwipeSettledFromUi}
        onSlideChangeTransitionEnd={reducedMotion ? handleSwipeSettledFromUi : undefined}
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
              virtualIndex={i}
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
                          className="mosaic-date-header min-w-0 text-center text-base font-semibold text-white"
                          aria-live={i === activeIndex ? 'polite' : undefined}
                        >
                          <span className="block truncate">{slideDateLabels.get(i)}</span>
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
                        <div className="justify-self-end flex items-center gap-1.5">
                          {i === activeIndex && renderMode !== 'panel' && <React.Suspense fallback={null}><DayLayoutMenu /></React.Suspense>}
                          {i === activeIndex && hasRouter && (
                            <DayViewSettingsShortcut date={date} onClose={onClose}
                              disabled={isBackgroundLocked || editingTaskId !== null || isTaskReorderActive || Boolean(continuousDrag.carried)} />
                          )}
                          <button
                            type="button"
                            ref={i === activeIndex ? keyboardHelpTriggerRef : undefined}
                            onClick={showKeyboardHelp}
                            tabIndex={i === activeIndex ? 0 : -1}
                            aria-label="Show keyboard shortcuts"
                            aria-expanded={i === activeIndex ? keyboardHelpOpen : false}
                            className="hidden md:inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#444444] bg-surfaceHighlight text-gray-300 transition-colors hover:bg-[#333333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                          ><CircleHelp size={16} aria-hidden="true" /></button>
                          {timelineModeEnabled && <button
                            type="button"
                            tabIndex={i === activeIndex ? 0 : -1}
                            disabled={isBackgroundLocked || editingTaskId !== null || isTaskReorderActive || Boolean(continuousDrag.carried)}
                            aria-pressed={dayViewMode === 'timeline'}
                            aria-label={dayViewMode === 'timeline' ? 'Switch to categories view' : 'Switch to timeline view'}
                            title={dayViewMode === 'timeline' ? 'Categories view' : 'Timeline view'}
                            onClick={() => void setSetting(DAY_VIEW_MODE_SETTING_KEY, dayViewMode === 'timeline' ? 'categories' : 'timeline')}
                            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 disabled:opacity-40 ${dayViewMode === 'timeline'
                              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                              : 'border-[#444444] bg-surfaceHighlight text-gray-300 hover:bg-[#333333]'}`}
                          >
                            <ListOrdered size={16} aria-hidden="true" />
                          </button>}
                          <button
                            type="button"
                            onClick={handleToggleSelectMode}
                            tabIndex={i === activeIndex ? 0 : -1}
                            aria-pressed={isSelectMode}
                            aria-label={isSelectMode ? 'Exit selection mode' : 'Select tasks'}
                            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 ${isSelectMode
                              ? 'border-transparent bg-emerald-500 text-black'
                              : 'border-[#444444] bg-surfaceHighlight text-gray-300 hover:bg-[#333333]'}`}
                          >
                            <CheckSquare size={16} aria-hidden="true" />
                            <span>Select</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    {i === activeIndex && keyboardHelpPanel}
                    {dayTasks.some(task => pendingOwnedTaskIds.has(task.id)) && (
                      <p role="status" className="px-4 pb-1 text-xs text-amber-400">
                        Shared completion pending sync
                      </p>
                    )}

                    {dayViewMode === 'timeline' ? (
                      <Suspense fallback={<div className="px-4 py-4 text-xs text-gray-400">Loading timeline…</div>}>
                        <LazyTaskTimelineList
                          dateStr={dateStr}
                          scrollMode={renderMode === 'inline' ? 'page' : 'contained'}
                          tasks={dayTasks}
                          categories={categories}
                          currentUserId={currentUserId}
                          ownerLabels={ownerLabels}
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
                          selectionMode={isSelectMode && i === activeIndex}
                          selectedTaskIds={selectedTaskIds}
                          onToggleTaskSelection={handleToggleTaskSelection}
                          direction={timelineDirection}
                          onDirectionChange={next => void setSetting(TIMELINE_DIRECTION_SETTING_KEY, next)}
                          sortBasis={timelineSortBasis}
                          onSortBasisChange={basis => void setSetting(TIMELINE_SORT_BASIS_SETTING_KEY, basis)}
                          timestampDisplay={timestampDisplay}
                          emptyCategoryPrompt={i === activeIndex ? firstCategoryPrompt : undefined}
                          footerCategoryPrompt={i === activeIndex ? footerCategoryPrompt : undefined}
                           showOtherContentNotice={showDiaryInDayView ||
                            sharedTasks.activeItems.some(item => item.status === 'accepted' && item.date === dateStr)}
                        />
                      </Suspense>
                    ) : (
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
                      onSharedSheetOpenChange={i === activeIndex ? setIsSharedSheetOpen : undefined}
                      sharedCategoryFor={sharedCategoryFor}
                      onAssignSharedCategory={assignSharedCategory}
                      onCopySharedTask={copySharedToMine}
                      onEditSharedTitle={updateSharedTitle}
                      onChangeSharedDate={updateSharedDate}
                      onMoveSharedTask={moveSharedTask}
                      sharedOrderFor={sharedOrderFor}
                      onSharedMoveError={handleSharedMoveError}
                      ownerLabels={ownerLabels}
                      onSharedCompletion={handleSharedCompletion}
                      onLeaveSharedTask={handleLeaveSharedTask}
                      sharedPendingFor={sharedTasks.pendingFor}
                      onAddTask={handleAddTask}
                      onOpenActions={handleOpenActions}
                      onOpenMemo={handleOpenMemo}
                      onEditTask={handleEditTask}
                      onViewImage={handleViewImage}
                      onEditChange={handleEditChange}
                      onEditSave={handleEditSave}
                      onEditCancel={handleEditCancel}
                      disableTaskLayoutAnimation={renderMode === 'sheet' || renderMode === 'panel'}
                      continueAddingTasks={continueAddingTasks}
                      showCategoryCollapseButton={showCategoryCollapseButton}
                      taskSortMode={taskSortMode}
                      timestampDisplay={timestampDisplay}
                      selectionMode={isSelectMode && i === activeIndex}
                      keyboardNavigationEnabled={isOpen && i === activeIndex && !isBackgroundLocked && !isTaskReorderActive && !keyboardHelpOpen}
                      onShowKeyboardHelp={i === activeIndex ? showKeyboardHelp : undefined}
                      selectedTaskIds={selectedTaskIds}
                      onToggleTaskSelection={handleToggleTaskSelection}
                      onToggleCategorySelection={i === activeIndex ? handleToggleCategorySelection : undefined}
                      reorderEnabled={
                        taskDragReorderEnabled &&
                        isOpen &&
                        i === activeIndex &&
                        !isSelectMode &&
                        // A modal over sheet-mode Day View already makes the
                        // entire parent inert. Keep the category Reorder.Group
                        // and task/drop-row component identities mounted:
                        // flipping reorderEnabled here would replace every
                        // category and task row during the Memo entrance.
                        (renderMode === 'sheet' || !isBackgroundLocked) &&
                        !continuousDrag.projection &&
                        editingTaskId === null
                      }
                      reorderRuntimeActive={isOpen && i === activeIndex}
                      onCrossDayTaskStart={continuousDrag.startTask}
                      onCrossDayTaskMove={continuousDrag.moveTask}
                      onCrossDayNativeEnd={continuousDrag.onNativeEnd}
                      crossDayDragTaskId={continuousDrag.projection?.task.id}
                      crossDayInsertion={continuousDrag.projection?.date === dateStr
                        ? { categoryId: continuousDrag.projection.categoryId,
                            index: continuousDrag.projection.index, height: continuousDrag.projection.height }
                        : undefined}
                      onReorderTasks={reorderTasks}
            onReorderCategories={currentUserId && categories.every(category => category.userId === currentUserId) ? reorderCategories : undefined}
            onUpdateCategory={currentUserId && categories.every(category => category.userId === currentUserId) ? updateCategory : undefined}
            onCategoryActionError={showFeedback}
                      onReorderActiveChange={handleReorderActiveChange}
                      emptyCategoryPrompt={i === activeIndex ? firstCategoryPrompt : undefined}
                          footerCategoryPrompt={i === activeIndex ? footerCategoryPrompt : undefined}
                       diaryEnabled={showDiaryInDayView && !isSelectMode}
                      diaryPlacement={normalizeDiaryPlacement(getSetting(diaryPlacementKey(dateStr), null), diaryPosition)}
                      onMoveDiary={async placement => { await setSetting(diaryPlacementKey(dateStr), placement); }}
                    />
                    )}

                  </>
                )}
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
      )}
      {continuousDrag.overlay}
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
        <Suspense fallback={null}>
        <LazyBulkTaskActionSheet
            isOpen={isBulkActionOpen}
            count={selectedTasks.length}
            isWorking={isBulkWorking}
            onClose={() => setIsBulkActionOpen(false)}
            onMoveCategory={() => { setIsBulkActionOpen(false); setIsBulkCategoryOpen(true); }}
            onMoveToBacklog={isBacklogView ? undefined : () => runBulkUpdate({ date: '' })}
            onChangeDate={async date => { await runBulkUpdate({ date }); }}
            onDoToday={() => runBulkUpdate({ date: format(new Date(), 'yyyy-MM-dd') })}
            onDoYesterday={() => runBulkUpdate({ date: format(addDays(new Date(), -1), 'yyyy-MM-dd') })}
            onDoTomorrow={() => runBulkUpdate({ date: format(addDays(new Date(), 1), 'yyyy-MM-dd') })}
            showDoToday={selectedTasks.some(task => task.date !== format(new Date(), 'yyyy-MM-dd'))}
            showDoYesterday={selectedTasks.some(task => task.date !== format(addDays(new Date(), -1), 'yyyy-MM-dd'))}
            onVisibility={() => { setIsBulkActionOpen(false); setIsBulkVisibilityOpen(true); }}
          />

        <LazyBulkCategoryPickerSheet
            isOpen={isBulkCategoryOpen}
            categories={categories.filter(
              (category) =>
                category.userId === currentUserId &&
                canAddNewTaskToCategory(category, activeDateStr)
            )}
            isWorking={isBulkWorking}
            onClose={() => setIsBulkCategoryOpen(false)}
            onSelect={handleBulkMoveCategory}
          />
        <LazyBulkVisibilitySheet isOpen={isBulkVisibilityOpen} count={selectedTasks.length} isWorking={isBulkWorking} onClose={() => setIsBulkVisibilityOpen(false)} onSave={(visibility) => runBulkUpdate({ visibility })} />
        </Suspense>
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
        onChangeDate={handleDateChange}
        onVisibility={handleOpenVisibility}
        onShare={() => { if (!isFeatureEnabled('mosaic_disable_all_social')) return; setShareSheetMounted(true); setIsShareSheetOpen(true); }}
        onAddPhoto={handleOpenImagePicker}
        onViewPhoto={handleOpenImageViewer}
        onDeletePhoto={handleRequestDeletePhoto}
        onDoItTomorrowOrToday={handleDoItTomorrowOrToday}
        onMoveToBacklog={handleMoveToBacklog}
        onLinkToBucketList={() => { if (isFeatureEnabled('mosaic_disable_task_bucket_link')) setIsBucketLinkOpen(true); }}
      />
      {shareSheetMounted && (
        <LazyShareTaskSheet
          isOpen={isShareSheetOpen && socialEnabled && !!activeTask}
          onClose={() => setIsShareSheetOpen(false)}
          task={activeTask}
        />
      )}
      {isBucketLinkOpen && (
        <LazyLinkTaskToBucketSheet task={activeTask} isOpen={isBucketLinkOpen && taskBucketLinkEnabled && !!activeTask} onClose={() => setIsBucketLinkOpen(false)}/>
      )}
      <Suspense fallback={null}>
      <LazyMemoSheet isOpen={isMemoOpen && !!activeTask} onClose={handleCloseMemo}
        task={activeTask} onSave={handleMemoSave} initialMode={memoInitialMode} />
      </Suspense>
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
        isProcessing={isDeleteProcessing}
        processingLabel="Deleting…"
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
      <Suspense fallback={null}>
      <LazyImagePickerSheet
        isOpen={!!imagePickerTaskId}
        onClose={handleCloseImagePicker}
        variant="task"
        hasExistingImage={!!imagePickerTask?.image}
        title="Task Photo"
        onSave={handleImagePickerSave}
        onRemove={handleImagePickerRemove}
      />
      </Suspense>
      {deleteFeedback && (
        <div role="status" aria-live="polite" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#2A2A2A] text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {deleteFeedback}
        </div>
      )}
    </>
  );

  if (renderMode === 'inline' || renderMode === 'backlog') {
    return (
      <div
        className={`flex min-h-0 min-w-0 w-full max-w-full flex-col overflow-x-hidden ${isBackgroundLocked ? 'pointer-events-none' : ''}`}
        aria-hidden={isBackgroundLocked || undefined}
        data-testid={isBacklogView ? 'backlog-day-view' : 'inline-day-view'}
        data-day-view-focus-scope={isBacklogView && focusTaskId ? 'true' : undefined}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      data-testid="day-sheet-swipe-surface"
      data-day-view-focus-scope={focusTaskId ? 'true' : undefined}
      ref={sheetContentRef}
      className="flex h-full min-h-0 flex-col"
    >
      {content}
    </div>
  );
};

/**
 * Keep the shared BottomSheet shell outside the expensive Day View subtree.
 * Calendar's first tap must be able to commit and paint the entrance sheet
 * BEFORE DayViewSheetInner runs its data hooks, Swiper init, and task rendering.
 * BottomSheet's existing two-frame child deferral now covers the entire subtree,
 * not just reconciliation of elements already built by its parent.
 */
export const DayViewSheet: React.FC<DayViewSheetProps> = (props) => {
  const isSheet = (props.renderMode ?? 'sheet') === 'sheet';
  const shellControlsRef = useRef<SheetContentControls | null>(null);
  const [managerCategoryId, setManagerCategoryId] = useState<string | null>(null);
  const [managerMounted, setManagerMounted] = useState(false);
  const [managerSession, setManagerSession] = useState(0);
  const openCategoryManager = useCallback((categoryId: string) => {
    setManagerCategoryId(categoryId);
    setManagerMounted(true);
    setManagerSession(session => session + 1);
    void preloadCategoryManagerSheet().catch(() => {});
  }, []);
  const categoryManager = managerMounted && (
    <LazyCategoryManagerSheet
      key={managerSession}
      isOpen={managerCategoryId !== null}
      initialCategoryId={managerCategoryId}
      onClose={() => setManagerCategoryId(null)}
    />
  );
  const inner = (shellProps: Partial<Pick<React.ComponentProps<typeof DayViewSheetInner>, 'shellControlsRef' | 'onLockChange'>>) => (
    <CategoryManagerOpenContext.Provider value={openCategoryManager}>
      <DayViewSheetInner {...props} {...shellProps} />
    </CategoryManagerOpenContext.Provider>
  );
  const [lock, setLock] = useState<SheetContentLock>({ background: false, reorder: false });
  const onLockChange = useCallback((next: SheetContentLock) => {
    setLock(current => current.background === next.background && current.reorder === next.reorder
      ? current : next);
  }, []);

  if (!isSheet) return <>{inner({})}{categoryManager}</>;

  return (
    <>
    <BottomSheet
      isOpen={props.isOpen}
      onClose={() => {
        if (shellControlsRef.current) shellControlsRef.current.close();
        else props.onClose();
      }}
      ariaLabel={format(props.selectedDate, 'EEEE, MMMM d, yyyy')}
      height="full"
      // Framer Motion reorder/layout projection measures all task/category
      // rows relative to this surface. Scaling their ancestor during nested
      // sheet entrance causes visible FLIP corrections (jitter) even when rows
      // retain DOM identity. Use the nested backdrop for depth instead.
      scaleBehind={false}
      isLocked={lock.background || lock.reorder}
      preventDismiss={lock.reorder}
      suspendInteraction={lock.background}
      contentMode="fixed"
      onHorizontalSwipe={(direction) => shellControlsRef.current?.horizontalSwipe(direction)}
      onAnimationComplete={() => shellControlsRef.current?.settled()}
      deferChildrenUntilPaint
      onTransientDismiss={() => shellControlsRef.current?.transientDismiss() ?? false}
    >
      {inner({ shellControlsRef, onLockChange })}
    </BottomSheet>
    {categoryManager}
    </>
  );
};
