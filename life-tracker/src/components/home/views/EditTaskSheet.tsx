import React, { useState } from 'react';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Save } from 'lucide-react';
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
  const [syncedTaskId, setSyncedTaskId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState<string | null>(null);
  const [editedMemo, setEditedMemo] = useState<string | null>(null);

  const taskId = task?.id ?? null;
  if (taskId !== syncedTaskId) {
    setSyncedTaskId(taskId);
    setEditedTitle(null);
    setEditedMemo(null);
  }

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
          label="Title"
          value={title}
          onChange={(e) => setEditedTitle(e.target.value)}
          autoFocus={initialFocus === 'title'}
        />
        <div>
          <label className="block text-xs text-gray-500 mb-2 ml-1">Memo / Notes</label>
          <textarea
            value={memo}
            onChange={(e) => setEditedMemo(e.target.value)}
            autoFocus={initialFocus === 'memo'}
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