import React, { useCallback, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  MessageSquare,
  Heart,
} from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { ReactionRow } from '../messages/ReactionRow';
import { EmojiPickerSheet } from '../messages/EmojiPickerSheet';
import { useTasksByDate } from '../../hooks/useTasksByDate';
import { useDayViewSwiper } from '../home/views/useDayViewSwiper';
import { useHorizontalArrowNavigation } from '../../hooks/useHorizontalArrowNavigation';
import { parseReactions } from '../../lib/reactionUtils';
import { visibilityIcon } from '../../lib/visibility';
import { getCategoryLabelColor, getReadableTextColor } from '../../constants/colors';
import type { TaskDocument, CategoryDocument } from '../../db/schema';

type Visibility = 'private' | 'followers' | 'public';

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
}

interface FriendDaySlideProps {
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  friendName: string;
  currentUserId: string;
  onReplyToTask?: (task: TaskDocument, categoryColor: string) => void;
  onReactToTask?: (task: TaskDocument, emoji: string) => void;
  onOpenReactions: (task: TaskDocument) => void;
  scrollMode?: 'page' | 'contained';
}

const EMPTY_TASKS: TaskDocument[] = [];

const FriendDaySlide: React.FC<FriendDaySlideProps> = ({
  tasks,
  categories,
  friendName,
  currentUserId,
  onReplyToTask,
  onReactToTask,
  onOpenReactions,
  scrollMode = 'contained',
}) => {
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

  const visibleCategories = useMemo(
    () =>
      categories.filter(
        (category) => (tasksByCategory.get(category.id) ?? EMPTY_TASKS).length > 0
      ),
    [categories, tasksByCategory]
  );

  if (tasks.length === 0) {
    return (
      <div className="text-center py-10 px-4">
        <p className="text-xs text-gray-400 mb-5">{friendName} · 0 tasks</p>
        <p className="text-sm text-gray-400">Nothing shared on this day.</p>
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
                      className={`flex items-start gap-3 px-3 py-2.5 ${
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
                          <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                            <ImageIcon size={11} />
                            <span>Photo attached</span>
                          </div>
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
}) => {
  const [reactionTask, setReactionTask] = useState<TaskDocument | null>(null);
  const tasksByDate = useTasksByDate(tasks);

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
    isDisabled: !!reactionTask,
  });

  const handlePickEmoji = (emoji: string) => {
    if (!reactionTask) return;
    onReactToTask?.(reactionTask, emoji);
    setReactionTask(null);
  };

  const handleSheetHorizontalSwipe = useCallback(
    (direction: 'left' | 'right') => {
      if (direction === 'left') handleNextDay();
      else handlePrevDay();
    },
    [handleNextDay, handlePrevDay]
  );

  useHorizontalArrowNavigation({
    enabled: isOpen && !reactionTask,
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
        const dayTasks = tasksByDate.get(slideDateStrs[index]) ?? EMPTY_TASKS;
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
              <div
                className="flex shrink-0 items-center justify-between gap-2 px-4 py-2"
                data-bottom-sheet-directional-drag-handle={
                  renderMode === 'sheet' ? 'true' : undefined
                }
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
              </div>
              {inWindow && (
                <FriendDaySlide
                  tasks={dayTasks}
                  categories={categories}
                  friendName={friendName}
                  currentUserId={currentUserId}
                  onReplyToTask={onReplyToTask}
                  onReactToTask={onReactToTask}
                  onOpenReactions={setReactionTask}
                  scrollMode={renderMode === 'sheet' ? 'contained' : 'page'}
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
        isLocked={!!reactionTask}
        suspendInteraction={!!reactionTask}
        contentMode="fixed"
        onHorizontalSwipe={handleSheetHorizontalSwipe}
      >
        <div className="flex h-full min-h-0 flex-col">{content}</div>
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
    </>
  );
};
