import React from 'react';
import { motion } from 'framer-motion';
import { Check, FileText } from 'lucide-react';
import { useTaskImage } from '../../../hooks/useTaskImage';
import { ReactionRow } from '../../messages/ReactionRow';
import { parseReactions } from '../../../lib/reactionUtils';
import type { TaskDocument } from '../../../db/schema';

interface TaskItemProps {
  task: TaskDocument;
  categoryColor: string;
  currentUserId: string;
  onToggle: (taskId: string) => void;
  onOpenActions: (task: TaskDocument) => void;
  onOpenMemo: (task: TaskDocument) => void;
  onViewImage?: (task: TaskDocument) => void;
  isEditing: boolean;
  editValue: string;
  onEditChange: (value: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  categoryColor,
  currentUserId,
  onToggle,
  onOpenActions,
  onOpenMemo,
  onViewImage,
  isEditing,
  editValue,
  onEditChange,
  onEditSave,
  onEditCancel,
}) => {
  const { imageUrl, isLoading } = useTaskImage(task.image);
  const reactions = parseReactions(task.reactions);

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-2.5 group"
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onToggle(task.id)}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
          aria-pressed={task.completed}
          className="flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all mt-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          style={{
            backgroundColor: task.completed ? categoryColor : 'transparent',
            borderColor: task.completed ? categoryColor : '#333333',
          }}
        >
          {task.completed && (
            <Check
              size={12}
              className="text-white"
              strokeWidth={3}
              aria-hidden="true"
            />
          )}
        </button>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              onBlur={onEditSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onEditSave();
                if (e.key === 'Escape') onEditCancel();
              }}
              autoFocus
              aria-label="Edit task title"
              className="w-full bg-transparent text-base text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 border-b border-blue-500 pb-1"
              onPointerDown={(e) => e.stopPropagation()}
            />
          ) : (
            <>
              <button
                type="button"
                onClick={() => onOpenActions(task)}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label={`${task.title}${
                  task.completed ? ', completed' : ''
                }`}
                className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 rounded"
              >
                <p
                  className={`text-base ${
                    task.completed
                      ? 'text-gray-500 line-through'
                      : 'text-gray-200'
                  }`}
                >
                  {task.title}
                </p>
              </button>
              {task.memo && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenMemo(task);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="Open memo"
                  className="block w-full text-left mt-1 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                >
                  <span className="text-sm text-gray-400 hover:text-gray-300 transition-colors whitespace-pre-wrap">
                    {task.memo}
                  </span>
                </button>
              )}
              {task.image && (
                <div className="mt-2 w-full">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewImage?.(task);
                    }}
                    aria-label="View task photo"
                    className="w-full h-48 md:h-64 lg:h-80 xl:h-96 rounded-lg overflow-hidden border border-[#333333] bg-[#2A2A2A] cursor-pointer relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
                  >
                    {isLoading ? (
                      <div className="w-full h-full bg-gray-500/30 animate-pulse" />
                    ) : imageUrl ? (
                      <img
                        src={imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                    <div
                      className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                      aria-hidden="true"
                    >
                      <span className="text-white text-xs font-medium bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
                        View Photo
                      </span>
                    </div>
                  </button>
                </div>
              )}
              {reactions.length > 0 && (
                <div className="mt-1.5">
                  <ReactionRow
                    reactions={reactions}
                    currentUserId={currentUserId}
                    isOutgoing={false}
                    onToggle={() => {
                      /* Owner cannot toggle others' reactions on their own task */
                    }}
                  />
                </div>
              )}
            </>
          )}
        </div>
        {!isEditing && (
          <div
            className="flex items-center gap-2 flex-shrink-0 pointer-events-none"
            aria-hidden="true"
          >
            {task.memo && !task.image && (
              <FileText size={14} className="text-gray-600" />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
