import React, { useRef, useEffect, useState } from 'react';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Save } from 'lucide-react';
import { usePropSync } from '../../../hooks/usePropSync';
import type { TaskDocument } from '../../../db/schema';

interface EditTaskSheetProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskDocument | null;
  onSave: (updates: Partial<TaskDocument>) => void;
  initialFocus?: 'title' | 'memo';
}

export const EditTaskSheet: React.FC<EditTaskSheetProps> = ({
  isOpen,
  onClose,
  task,
  onSave,
  initialFocus = 'title'
}) => {
  const [editedTitle, setEditedTitle] = useState<string | null>(null);
  const [editedMemo, setEditedMemo] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const memoTextareaRef = useRef<HTMLTextAreaElement>(null);

  const taskId = task?.id ?? null;
  usePropSync(taskId, () => {
    setEditedTitle(null);
    setEditedMemo(null);
  });

  useEffect(() => {
    if (isOpen && taskId) {
      if (initialFocus === 'memo') {
        memoTextareaRef.current?.focus();
      } else {
        titleInputRef.current?.focus();
      }
    }
  }, [isOpen, taskId, initialFocus]);

  const title = editedTitle ?? task?.title ?? '';
  const memo = editedMemo ?? task?.memo ?? '';

  const handleSave = () => {
    if (title.trim()) {
      onSave({ title: title.trim(), memo: memo.trim() });
      onClose();
    }
  };

  if (!task) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={initialFocus === 'memo' ? 'Add Memo' : 'Edit Task'} height="auto">
      <div className="pt-2 pb-8 px-1 space-y-4">
        <Input
          ref={titleInputRef}
          label="Title"
          value={title}
          onChange={(e) => setEditedTitle(e.target.value)}
        />
        <div>
          <label className="block text-xs text-gray-500 mb-2 ml-1">Memo / Notes</label>
          <textarea
            ref={memoTextareaRef}
            value={memo}
            onChange={(e) => setEditedMemo(e.target.value)}
            placeholder="Add details to this task..."
            className="w-full bg-[#1E1E1E] border border-[#333333] rounded-xl p-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#555555] transition-colors min-h-[100px] resize-none"
          />
        </div>
        <Button variant="primary" className="w-full gap-2 py-3" onClick={handleSave} disabled={!title.trim()}>
          <Save size={18} />
          Save Changes
        </Button>
      </div>
    </BottomSheet>
  );
};
