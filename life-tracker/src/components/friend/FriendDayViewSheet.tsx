import React, { useMemo, useState } from 'react';
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
import { parseReactions } from '../../lib/reactionUtils';
import { visibilityIcon } from '../../lib/visibility';
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
}

interface FriendDaySlideProps {
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  friendName: string;
  currentUserId: string;
  onReplyToTask?: (task: TaskDocument, categoryColor: string) => void;
  onReactToTask?: (task: TaskDocument, emoji: string) => void;
  onOpenReactions: (task: TaskDocument) => void;
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
        <p className="text-xs text-gray-500 mb-5">{friendName} · 0 tasks</p>
        <p className="text-sm text-gray-500">Nothing shared on this day.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 pb-8">
      <p className="text-xs text-gray-500 text-center mb-5">
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
                  {visibilityIcon(catVisibility, 12, 'text-gray-500')}
                  <span
                    className="text-sm font-bold"
                    style={{ color: cat.color }}
                  >
                    {cat.name}
                  </span>
                  <span className="text-sm font-bold text-gray-500">
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
                            className="text-white"
                            strokeWidth={3.5}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm ${
                            task.completed
                              ? 'text-gray-500 line-through'
                              : 'text-gray-200'
                          }`}
                        >
                          {task.title}
                        </p>
                        {task.memo && (
                          <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">
                            {task.memo}
                          </p>
                        )}
                        {task.image && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-gray-600">
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
                              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#252525] transition-colors"
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
                              className="p-1.5 rounded-lg text-gray-500 hover:text-pink-400 hover:bg-[#252525] transition-colors"
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

  return (
    <>
      <BottomSheet
        isOpen={isOpen}
        onClose={onClose}
        title={format(date, 'EEEE, MMMM d, yyyy')}
        height="full"
        isLocked={!!reactionTask}
        suspendInteraction={!!reactionTask}
      >
        <div className="flex items-center justify-between px-4 py-2">
          <button
            type="button"
            onClick={handlePrevDay}
            className="p-2 text-gray-400"
            aria-label="Previous day"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="sr-only" aria-live="polite">
            {format(date, 'EEEE, MMMM d, yyyy')}
          </span>
          <button
            type="button"
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
          {slideDates.map((slideDate, index) => {
            const inWindow = Math.abs(index - activeIndex) <= renderWindow;
            const dayTasks =
              tasksByDate.get(slideDateStrs[index]) ?? EMPTY_TASKS;

            return (
              <SwiperSlide key={slideDate.toISOString()}>
                {inWindow && (
                  <FriendDaySlide
                    tasks={dayTasks}
                    categories={categories}
                    friendName={friendName}
                    currentUserId={currentUserId}
                    onReplyToTask={onReplyToTask}
                    onReactToTask={onReactToTask}
                    onOpenReactions={setReactionTask}
                  />
                )}
              </SwiperSlide>
            );
          })}
        </Swiper>
      </BottomSheet>

      <EmojiPickerSheet
        isOpen={!!reactionTask}
        onClose={() => setReactionTask(null)}
        onPick={handlePickEmoji}
      />
    </>
  );
};
