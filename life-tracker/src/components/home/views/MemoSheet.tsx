import React, { useRef, useEffect } from 'react';
import { BottomSheet } from '../../ui/BottomSheet';
import { usePropSync } from '../../../hooks/usePropSync';
import type { TaskDocument } from '../../../db/schema';

interface MemoSheetProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskDocument | null;
  onSave: (memo: string, visibility: 'private' | 'followers' | 'public') => void;
}

export const MemoSheet: React.FC<MemoSheetProps> = ({
  isOpen,
  onClose,
  task,
  onSave,
}) => {
  const [editedMemo, setEditedMemo] = React.useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const taskId = task?.id ?? null;

  usePropSync(taskId, () => setEditedMemo(null));

  useEffect(() => {
    if (isOpen && taskId) {
      textareaRef.current?.focus();
    }
  }, [isOpen, taskId]);

  const memo = editedMemo ?? task?.memo ?? '';

  const safeVisibility = ((): 'private' | 'followers' | 'public' => {
    const v = task?.visibility;
    return v === 'private' || v === 'followers' || v === 'public'
      ? v
      : 'private';
  })();

  const handleDone = () => {
    onSave(memo, safeVisibility);
    onClose();
  };

  const handleDelete = () => {
    onSave('', safeVisibility);
    onClose();
  };

  if (!task) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={task.title} height="auto">
      <div className="pt-2 pb-8 px-4">
        <div className="flex items-center justify-between mb-4">
          {task.memo ? (
            <button
              onClick={handleDelete}
              className="text-red-400 font-semibold text-base"
            >
              Delete
            </button>
          ) : (
            <div className="w-12" />
          )}
          <button
            onClick={handleDone}
            className="text-white font-semibold text-base"
          >
            Done
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={memo}
          onChange={(e) => setEditedMemo(e.target.value)}
          placeholder="Enter a memo"
          className="w-full bg-[#1A1A1A] rounded-xl p-4 text-base text-white placeholder-gray-500 focus:outline-none min-h-[200px] resize-none"
        />
      </div>
    </BottomSheet>
  );
};
