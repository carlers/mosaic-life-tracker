import React, { useState, useEffect } from 'react';
import { BottomSheet } from '../../ui/BottomSheet';
import { EyeOff, Eye } from 'lucide-react';
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
  onSave
}) => {
  const [memo, setMemo] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'followers' | 'public'>('private');

  useEffect(() => {
    if (task) {
      setMemo(task.memo || '');
      setVisibility(task.visibility || 'private');
    }
  }, [task, isOpen]);

  const handleDone = () => {
    onSave(memo, visibility);
    onClose();
  };

  const handleDelete = () => {
    onSave('', visibility);
    onClose();
  };

  if (!task) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={task.title} height="auto">
      <div className="pt-2 pb-8 px-4">
        {/* Header with Delete (conditional) and Done */}
        <div className="flex items-center justify-between mb-4">
          {task.memo ? (
            <button
              onClick={handleDelete}
              className="text-red-400 font-semibold text-base"
            >
              Delete
            </button>
          ) : (
            <div className="w-12" /> // Spacer to keep "Done" aligned
          )}
          <button
            onClick={handleDone}
            className="text-white font-semibold text-base"
          >
            Done
          </button>
        </div>

        {/* Memo Textarea */}
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="Enter a memo"
          autoFocus
          className="w-full bg-[#1A1A1A] rounded-xl p-4 text-base text-white placeholder-gray-500 focus:outline-none min-h-[200px] resize-none mb-6"
        />

        {/* Visibility Toggle */}
        <div className="flex items-center justify-end gap-3">
          <span className="text-sm text-gray-400">Visible to me only</span>
          <button
            onClick={() => setVisibility(visibility === 'private' ? 'public' : 'private')}
            className={`relative w-12 h-7 rounded-full transition-colors ${
              visibility === 'private' ? 'bg-gray-600' : 'bg-blue-500'
            }`}
          >
            <div
              className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                visibility === 'private' ? 'left-1' : 'left-6'
              }`}
            />
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
              {visibility === 'private' ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};