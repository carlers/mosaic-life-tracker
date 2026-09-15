import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import {
  Check,
  Image as ImageIcon,
  MessageSquare,
  Heart,
  Eye,
  EyeOff,
  Users,
} from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import { ReactionRow } from '../messages/ReactionRow';
import { EmojiPickerSheet } from '../messages/EmojiPickerSheet';
import { parseReactions } from '../../lib/reactionUtils';
import type { TaskDocument, CategoryDocument } from '../../db/schema';

type Visibility = 'private' | 'followers' | 'public';

interface FriendDayViewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  friendName: string;
  currentUserId: string;
  onReplyToTask?: (task: TaskDocument, categoryColor: string) => void;
  onReactToTask?: (task: TaskDocument, emoji: string) => void;
}

const EMPTY_TASKS: TaskDocument[] = [];

function getVisibilityIcon(v: Visibility) {
  switch (v) {
    case 'public':
      return <Eye size={12} className="text-gray-500" />;
    case 'followers':
      return <Users size={12} className="text-gray-500" />;
    case 'private':
      return <EyeOff size={12} className="text-gray-500" />;
  }
}

export const FriendDayViewSheet: React.FC<FriendDayViewSheetProps> = ({
  isOpen,
  onClose,
  date,
  tasks,
  categories,
  friendName,
  currentUserId,
  onReplyToTask,
  onReactToTask,
}) => {
  const [reactionTask, setReactionTask] = useState<TaskDocument | null>(null);

  const dateStr = date ? format(date, 'yyyy-MM-dd') : null;
  const headerLabel = date ? format(date, 'EEEE, MMMM d') : '';

  const tasksByCategory = useMemo(() => {
    if (!dateStr) return new Map<string, TaskDocument[]>();
    const map = new Map<string, TaskDocument[]>();
    for (const t of tasks) {
      if (t.date !== dateStr) continue;
      const arr = map.get(t.categoryId) || [];
      arr.push(t);
      map.set(t.categoryId, arr);
    }
    return map;
  }, [tasks, dateStr]);

  const visibleCategories = useMemo(() => {
    if (!dateStr) return [];
    return categories.filter(
      (c) => (tasksByCategory.get(c.id) || EMPTY_TASKS).length > 0
    );
  }, [categories, tasksByCategory, dateStr]);

  const totalTasks = useMemo(
    () =>
      Array.from(tasksByCategory.values()).reduce((n, arr) => n + arr.length, 0),
    [tasksByCategory]
  );

  const handlePickEmoji = (emoji: string) => {
    if (!reactionTask) return;
    onReactToTask?.(reactionTask, emoji);
    setReactionTask(null);
  };

  return (
    <>
      <BottomSheet isOpen={isOpen} onClose={onClose} height="full">
        <div className="pt-1 pb-8 px-4 min-h-full">
          {date && (
            <>
              <div className="text-center mb-5">
                <h2 className="text-white text-lg font-semibold tracking-tight">
                  {headerLabel}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {friendName} · {totalTasks}{' '}
                  {totalTasks === 1 ? 'task' : 'tasks'}
                </p>
              </div>

              {totalTasks === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-500">
                    Nothing shared on this day.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {visibleCategories.map((cat) => {
                    const catTasks =
                      tasksByCategory.get(cat.id) || EMPTY_TASKS;
                    const catVisibility: Visibility =
                      (cat.visibility as Visibility) || 'private';
                    return (
                      <div key={cat.id}>
                        <div className="flex items-center mb-2">
                          <div className="inline-flex items-center gap-2 bg-black rounded-full pl-3.5 pr-4 py-2">
                            {getVisibilityIcon(catVisibility)}
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
                            const canInteract =
                              !!onReplyToTask || !!onReactToTask;
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
                                    borderColor: task.completed
                                      ? cat.color
                                      : '#444444',
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
                                        onToggle={(emoji) =>
                                          onReactToTask?.(task, emoji)
                                        }
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
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onReplyToTask(task, cat.color);
                                        }}
                                        onPointerDown={(e) =>
                                          e.stopPropagation()
                                        }
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
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setReactionTask(task);
                                        }}
                                        onPointerDown={(e) =>
                                          e.stopPropagation()
                                        }
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
              )}
            </>
          )}
        </div>
      </BottomSheet>

      <EmojiPickerSheet
        isOpen={!!reactionTask}
        onClose={() => setReactionTask(null)}
        onPick={handlePickEmoji}
      />
    </>
  );
};