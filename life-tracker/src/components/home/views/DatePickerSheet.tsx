import React, { useState } from 'react';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Calendar } from 'lucide-react';
import type { TaskDocument } from '../../../db/schema';

interface DatePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskDocument | null;
  onDateChange: (newDate: string) => void;
}

export const DatePickerSheet: React.FC<DatePickerSheetProps> = ({
  isOpen,
  onClose,
  task,
  onDateChange
}) => {
  const [syncedTaskId, setSyncedTaskId] = useState<string | null>(null);
  const [editedDate, setEditedDate] = useState<string | null>(null);

  const taskId = task?.id ?? null;
  if (taskId !== syncedTaskId) {
    setSyncedTaskId(taskId);
    setEditedDate(null);
  }

  const selectedDate = editedDate ?? task?.date ?? '';

  const handleConfirm = () => {
    if (selectedDate) {
      onDateChange(selectedDate);
    }
  };

  if (!task) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Change Date" height="auto">
      <div className="pt-2 pb-8 px-4 space-y-4">
        <div>
          <label className="block text-xs text-gray-500 mb-2 ml-1">Select Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setEditedDate(e.target.value)}
            className="w-full bg-[#1E1E1E] border border-[#333333] rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#555555] transition-colors [color-scheme:dark]"
          />
        </div>
        <Button variant="primary" className="w-full gap-2 py-3" onClick={handleConfirm} disabled={!selectedDate}>
          <Calendar size={18} />
          Confirm Date
        </Button>
      </div>
    </BottomSheet>
  );
};