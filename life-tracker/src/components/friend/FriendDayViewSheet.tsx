import React, { lazy, Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Heart,
} from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { ReactionRow } from '../messages/ReactionRow';
import { EmojiPickerSheet } from '../messages/EmojiPickerSheet';
import { useTasksByDate } from '../../hooks/useTasksByDate';
import { useTaskImage } from '../../hooks/useTaskImage';
import { useImageLoadGate } from '../../hooks/useImageLoadGate';
import { useDayViewSwiper } from '../home/views/useDayViewSwiper';
import { useHorizontalArrowNavigation } from '../../hooks/useHorizontalArrowNavigation';
import { useHolidaysByDate } from '../../hooks/useHolidays';
import { parseReactions } from '../../lib/reactionUtils';
import { visibilityIcon } from '../../lib/visibility';
import { getCategoryLabelColor, getReadableTextColor } from '../../constants/colors';
import { Spinner } from '../ui/Spinner';
import type { TaskDocument, CategoryDocument } from '../../db/schema';
import {
  DISABLED_HOLIDAY_CONFIG,
  EMPTY_HOLIDAYS,
  type HolidayDisplayConfig,
} from '../../lib/holidays';

type Visibility = 'private' | 'followers' | 'public';

const ImageViewer = lazy(() =>
  import('../home/views/ImageViewer').then(({ ImageViewer }) => ({ default: ImageViewer }))
);

const ImageViewerLoadingFallback: React.FC = () => (
  <div
    className="fixed inset-0 z-[80] bg-black flex items-center justify-center px-6"
    role="status"
    aria-live="polite"
  >
    <Spinner size="w-8 h-8" />
  </div>
);

interface FriendDayViewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  onDateChange: (date: Date) => void;
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  friendName: string;
  currentUserId: string;
  onReplyToTask?: (task: TaskDocument, categoryColor: string) => void;
  onReactToTask?: (task: TaskDocument, emoji: string) => void;
  renderMode?: 'sheet' | 'inline';
  holidayConfig?: HolidayDisplayConfig;
  focusTaskId?: string;
  emptyMessage?: string;
}

interface FriendDaySlideProps {
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  friendName: string;
  currentUserId: string;
  onReplyToTask?: (task: TaskDocument, categoryColor: string) => void;
  onReactToTask?: (task: TaskDocument, emoji: string) => void;
  onOpenReactions: (task: TaskDocument) => void;
  onViewImage?: (task: TaskDocument) => void;
  scrollMode?: 'page' | 'contained';
  focusTaskId?: string;
  emptyMessage?: string;
}

const EMPTY_TASKS: TaskDocument[] = [];

interface FriendTaskImageProps {
  task: TaskDocument;
  onViewImage?: (task: TaskDocument) => void;
}

const FriendTaskImage: React.FC<FriendTaskImageProps> = ({ task, onViewImage }) => {
  const { targetRef, shouldLoad } = useImageLoadGate<HTMLElement>();
  const { imageUrl, isLoading } = useTaskImage(task.image, shouldLoad);

  if (imageUrl) {
    return (
      <button
        ref={targetRef}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onViewImage?.(task);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        className="mt-2 block w-full aspect-[16/9] rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        aria-label="View image"
      >
        <img
          src={imageUrl}
          alt={task.title}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover rounded-xl"
        />
      </button>
    );
  }

  return (
    <div
      ref={targetRef}
      aria-hidden="true"
      className={`mt-2 w-full aspect-[16/9] rounded-xl bg-gray-500/20 ${isLoading ? 'animate-pulse' : ''}`}
    />
  );
};

const FriendDaySlide: React.FC<FriendDaySlideProps> = ({
  tasks,
  categories,
  friendName,
  currentUserId,
  onReplyToTask,
  onReactToTask,
  onOpenReactions,
  onViewImage,
  scrollMode = 'contained',
  focusTaskId,
  emptyMessage,
}) => {
  const scrolledToTaskRef = useRef('');
  const focusRow = useCallback((node: HTMLDivElement | null) => {
    if (!node || !focusTaskId || scrolledToTaskRef.current === focusTaskId) return;
    scrolledToTaskRef.current = focusTaskId;
    requestAnimationFrame(() => node.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }, [focusTaskId]);

  const tasksByCategory = useMemo(() => {
    const map = new Map<string, TaskDocument[]>();
    for (const task of tasks) {
      const list = map.get(task.categoryId);
      if (list) {
        list.push(task);
      } else {
        map.set(task.categoryId, [task]);
      }
    }
    return map;
  }, [tasks]);

  const visibleCategories = useMemo(() => {
    const known = new Set(categories.map((category) => category.id));
    const visible = categories.filter(
      (category) => (tasksByCategory.get(category.id) ?? EMPTY_TASKS).length > 0
    );
    // The server intentionally hides private category metadata even when an
    // individual task overrides its visibility. Never hide that shared task
    // or reveal the private category's name.
    for (const categoryId of tasksByCategory.keys()) {
      if (!known.has(categoryId)) {
        visible.push({
          id: categoryId,
          name: 'Shared tasks',
          color: '#6B7280',
          order: Number.MAX_SAFE_INTEGER,
          visibility: 'followers',
          userId: '',
          isDeleted: false,
          updatedAt: '',
        });
      }
    }
    return visible;
  }, [categories, tasksByCategory]);

  if (tasks.length === 0) {
    return (
      <div className="text-center py-10 px-4">
        {!emptyMessage && (
          <p className="text-xs text-gray-400 mb-5">{friendName} · 0 tasks</p>
        )}
        <p className="text-sm text-gray-400" role={emptyMessage ? 'status' : undefined}>
          {emptyMessage || 'Nothing shared on this day.'}
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        scrollMode === 'contained'
          ? 'min-h-0 w-full min-w-0 flex-1 overflow-y-auto px-4 pb-8'
          : 'w-full min-w-0 px-4 pb-8'
      }
    >
      <p className="text-xs text-gray-400 text-center mb-5">
        {friendName} · {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
      </p>
      <div className="space-y-4">
        {visibleCategories.map((cat) => {
          const catTasks = tasksByCategory.get(cat.id) ?? EMPTY_TASKS;
          const catVisibility: Visibility =
            (cat.visibility as Visibility) || 'private';

          return (
            <div key={cat.id}>
              <div className="flex items-center mb-2">
                <div className="inline-flex items-center gap-2 bg-black rounded-full pl-3.5 pr-4 py-2">
                  {visibilityIcon(catVisibility, 12, 'text-gray-400')}
                  <span
                    className="text-sm font-bold"
                    style={{ color: getCategoryLabelColor(cat.color) }}
                  >
                    {cat.name}
                  </span>
                  <span className="text-sm font-bold text-gray-400">
                    {catTasks.length}
                  </span>
                </div>
              </div>

              <div className="bg-[#1E1E1E] rounded-xl overflow-hidden">
                {catTasks.map((task, idx) => {
                  const canInteract = !!onReplyToTask || !!onReactToTask;
                  const reactions = parseReactions(task.reactions);

                  return (
                    <div
                      key={task.id}
                      ref={task.id === focusTaskId ? focusRow : undefined}
                      className={`flex items-start gap-3 px-3 py-2.5 ${task.id === focusTaskId ? 'ring-1 ring-inset ring-emerald-500/70 rounded-lg ' : ''}${
                        idx > 0 ? 'border-t border-[#2A2A2A]' : ''
                      }`}
                    >
                      <div
                        className="flex-shrink-0 w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center"
                        style={{
                          backgroundColor: task.completed
                            ? cat.color
                            : 'transparent',
                          borderColor: task.completed ? cat.color : '#444444',
                        }}
                      >
                        {task.completed && (
                          <Check
                            size={9}
                            style={{ color: getReadableTextColor(cat.color) }}
                            strokeWidth={3.5}
                            aria-hidden="true"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm ${
                            task.completed
                              ? 'text-gray-400 line-through'
                              : 'text-gray-200'
                          }`}
                        >
                          {task.title}
                        </p>
                        {task.memo && (
                          <p className="text-xs text-gray-400 mt-0.5 whitespace-pre-wrap">
                            {task.memo}
                          </p>
                        )}
                        {task.image && (
                          <FriendTaskImage task={task} onViewImage={onViewImage} />
                        )}
                        {reactions.length > 0 && (
                          <div className="mt-1.5">
                            <ReactionRow
                              reactions={reactions}
                              currentUserId={currentUserId}
                              isOutgoing={false}
                              onToggle={(emoji) => onReactToTask?.(task, emoji)}
                            />
                          </div>
                        )}
                      </div>
                      {canInteract && (
                        <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                          {onReplyToTask && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.9 }}
                              onClick={(event) => {
                                event.stopPropagation();
                                onReplyToTask(task, cat.color);
                              }}
                              onPointerDown={(event) => event.stopPropagation()}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#252525] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                              aria-label="Reply to task"
                            >
                              <MessageSquare size={14} />
                            </motion.button>
                          )}
                          {onReactToTask && (
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.9 }}
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenReactions(task);
                              }}
                              onPointerDown={(event) => event.stopPropagation()}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-pink-400 hover:bg-[#252525] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                              aria-label="React to task"
                            >
                              <Heart size={14} />
                            </motion.button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const FriendDayViewSheet: React.FC<FriendDayViewSheetProps> = ({
  isOpen,
  onClose,
  date,
  onDateChange,
  tasks,
  categories,
  friendName,
  currentUserId,
  onReplyToTask,
  onReactToTask,
  renderMode = 'sheet',
  holidayConfig = DISABLED_HOLIDAY_CONFIG,
  focusTaskId,
  emptyMessage,
}) => {
  const [reactionTask, setReactionTask] = useState<TaskDocument | null>(null);
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null);
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const tasksByDate = useTasksByDate(tasks);

  const viewingTask = useMemo(
    () => tasks.find((task) => task.id === viewingTaskId) ?? null,
    [tasks, viewingTaskId]
  );

  const {
    imageUrl: viewingImageUrl,
    isLoading: isViewingImageLoading,
  } = useTaskImage(viewingTask?.image, isImageViewerOpen);

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
    selectedDate: date,
    onDateChange,
    isDisabled: !!reactionTask || isImageViewerOpen,
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

  const handlePickEmoji = (emoji: string) => {
    if (!reactionTask) return;
    onReactToTask?.(reactionTask, emoji);
    setReactionTask(null);
  };

  const handleViewImage = useCallback((task: TaskDocument) => {
    if (!task.image) return;
    setViewingTaskId(task.id);
    setIsImageViewerOpen(true);
  }, []);

  const handleCloseImageViewer = useCallback(() => {
    setIsImageViewerOpen(false);
    setViewingTaskId(null);
  }, []);

  const handleSheetHorizontalSwipe = useCallback(
    (direction: 'left' | 'right') => {
      if (direction === 'left') handleNextDay();
      else handlePrevDay();
    },
    [handleNextDay, handlePrevDay]
  );

  useHorizontalArrowNavigation({
    enabled: isOpen && !reactionTask && !isImageViewerOpen,
    onLeft: handlePrevDay,
    onRight: handleNextDay,
  });

  const content = (
    <Swiper
      nested={renderMode === 'inline'}
      noSwiping={renderMode === 'sheet'}
      touchStartPreventDefault={false}
      touchMoveStopPropagation={false}
      onSwiper={(swiper) => {
        swiperRef.current = swiper;
      }}
      initialSlide={initialIndex}
      onSlideChange={handleSwipeSettled}
      data-bottom-sheet-native-horizontal-swipe={
        renderMode === 'sheet' ? 'true' : undefined
      }
      className={`min-w-0 w-full max-w-full overflow-hidden ${
        renderMode === 'sheet' ? 'flex-1' : ''
      }`}
      style={{
        width: '100%',
        maxWidth: '100%',
        height: renderMode === 'sheet' ? '100%' : 'auto',
        touchAction: 'pan-y',
      }}
    >
      {slideDates.map((slideDate, index) => {
        const inWindow = Math.abs(index - activeIndex) <= renderWindow;
        const dateStr = slideDateStrs[index];
        const dayTasks = tasksByDate.get(dateStr) ?? EMPTY_TASKS;
        const dayHolidays = holidaysByDate.get(dateStr) ?? EMPTY_HOLIDAYS;
        return (
          <SwiperSlide
            key={slideDate.toISOString()}
            style={{ height: renderMode === 'sheet' ? '100%' : 'auto' }}
          >
            <div
              className={
                renderMode === 'sheet'
                  ? 'flex h-full min-h-0 w-full min-w-0 flex-col'
                  : 'w-full min-w-0'
              }
            >
              {renderMode === 'inline' && <div
                className="flex shrink-0 items-center justify-between gap-2 px-4 py-2"
              >
                <button
                  type="button"
                  onClick={handlePrevDay}
                  tabIndex={index === activeIndex ? 0 : -1}
                  className="p-2 text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                  aria-label="Previous day"
                >
                  <ChevronLeft size={20} />
                </button>
                <h3
                  className="min-w-0 flex-1 text-center text-base font-semibold text-white"
                  aria-live={index === activeIndex ? 'polite' : undefined}
                >
                  {format(slideDate, 'EEEE, MMMM d, yyyy')}
                </h3>
                <button
                  type="button"
                  onClick={handleNextDay}
                  tabIndex={index === activeIndex ? 0 : -1}
                  className="p-2 text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                  aria-label="Next day"
                >
                  <ChevronRight size={20} />
                </button>
              </div>}
              {dayHolidays.length > 0 && (
                <div className="-mt-1 flex shrink-0 flex-wrap justify-center gap-1 px-4 pb-1">
                  {dayHolidays.map((holiday) => (
                    <span
                      key={holiday.id}
                      className="mosaic-holiday-label rounded-full bg-red-500/15 px-2 py-0.5 text-center text-[11px] font-semibold text-red-400"
                    >
                      {holiday.title}
                    </span>
                  ))}
                </div>
              )}
              {inWindow && (
                <FriendDaySlide
                  tasks={dayTasks}
                  categories={categories}
                  friendName={friendName}
                  currentUserId={currentUserId}
                  onReplyToTask={onReplyToTask}
                  onReactToTask={onReactToTask}
                  onOpenReactions={setReactionTask}
                  onViewImage={handleViewImage}
                  scrollMode={renderMode === 'sheet' ? 'contained' : 'page'}
                  focusTaskId={focusTaskId}
                  emptyMessage={emptyMessage}
                />
              )}
            </div>
          </SwiperSlide>
        );
      })}
    </Swiper>
  );

  const surface =
    renderMode === 'inline' ? (
      <div
        data-testid="inline-friend-day-view"
        className="flex min-h-0 min-w-0 w-full max-w-full flex-col overflow-x-hidden"
      >
        {content}
      </div>
    ) : (
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        ariaLabel={format(date, 'EEEE, MMMM d, yyyy')}
        height="full"
        isLocked={!!reactionTask || isImageViewerOpen}
        suspendInteraction={!!reactionTask || isImageViewerOpen}
        contentMode="fixed"
        onHorizontalSwipe={handleSheetHorizontalSwipe}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 items-center gap-2 px-4 py-2">
            <button
              type="button"
              onClick={handlePrevDay}
              className="rounded-lg p-2 text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
              aria-label="Previous day"
            >
              <ChevronLeft size={20} />
            </button>
            <h3
              data-bottom-sheet-drag-handle="true"
              className="flex min-h-10 flex-1 cursor-grab touch-none select-none items-center justify-center text-center text-base font-semibold text-white active:cursor-grabbing"
              aria-live="polite"
            >
              {format(date, 'EEEE, MMMM d, yyyy')}
            </h3>
            <button
              type="button"
              onClick={handleNextDay}
              className="rounded-lg p-2 text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
              aria-label="Next day"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          {content}
        </div>
      </BottomSheet>
    );

  return (
    <>
      {surface}
      <EmojiPickerSheet
        isOpen={!!reactionTask}
        onClose={() => setReactionTask(null)}
        onPick={handlePickEmoji}
      />
      <Suspense fallback={<ImageViewerLoadingFallback />}>
        <ImageViewer
          isOpen={isImageViewerOpen && !!viewingImageUrl && !isViewingImageLoading}
          imageUrl={viewingImageUrl}
          taskTitle={viewingTask?.title}
          taskDate={viewingTask?.date}
          onClose={handleCloseImageViewer}
        />
      </Suspense>
    </>
  );
};
