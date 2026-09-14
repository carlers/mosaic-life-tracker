import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Check, Image as ImageIcon, MessageSquare } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';
import type { TaskDocument, CategoryDocument } from '../../db/schema';

interface FriendDayViewSheetProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  tasks: TaskDocument[];
  categories: CategoryDocument[];
  friendName: string;
  onReplyToTask?: (task: TaskDocument, categoryColor: string) => void;
}

const EMPTY_TASKS: TaskDocument[] = [];

export const FriendDayViewSheet: React.FC<FriendDayViewSheetProps> = ({
  isOpen,
  onClose,
  date,
  tasks,
  categories,
  friendName,
  onReplyToTask,
}) => {
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

  if (!date) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} height="auto">
      <div className="pt-1 pb-8 px-4">
        <div className="text-center mb-5">
          <h2 className="text-white text-lg font-semibold tracking-tight">
            {headerLabel}
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {friendName} · {totalTasks} {totalTasks === 1 ? 'task' : 'tasks'}
          </p>
        </div>

        {totalTasks === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-gray-500">Nothing shared on this day.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {visibleCategories.map((cat) => {
              const catTasks = tasksByCategory.get(cat.id) || EMPTY_TASKS;
              return (
                <div key={cat.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-xs font-bold text-white">
                      {cat.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {catTasks.length}
                    </span>
                  </div>
                  <div className="bg-[#1A1A1A] rounded-xl border border-[#2A2A2A] overflow-hidden">
                    {catTasks.map((task, idx) => {
                      const tappable = !!onReplyToTask;
                      return (
                        <motion.div
                          key={task.id}
                          whileTap={tappable ? { scale: 0.99 } : undefined}
                          onClick={
                            tappable
                              ? () => onReplyToTask!(task, cat.color)
                              : undefined
                          }
                          className={`flex items-start gap-3 px-3 py-2.5 ${
                            idx > 0 ? 'border-t border-[#2A2A2A]' : ''
                          } ${
                            tappable
                              ? 'cursor-pointer hover:bg-[#222222] transition-colors'
                              : ''
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
                          </div>
                          {tappable && (
                            <MessageSquare
                              size={14}
                              className="text-gray-600 flex-shrink-0 mt-0.5"
                            />
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BottomSheet>
  );
};