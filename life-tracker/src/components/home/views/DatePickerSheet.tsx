import React, { useId, useState } from 'react';
import { useRetainedSheetValue } from '../../../hooks/useRetainedSheetValue';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Calendar } from 'lucide-react';
import { usePropSync } from '../../../hooks/usePropSync';
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
  task: incomingTask,
  onDateChange
}) => {
  const { value: task, onExitComplete } = useRetainedSheetValue(incomingTask, isOpen);
  const [editedDate, setEditedDate] = useState<string | null>(null);
  const dateInputId = useId();
  const taskId = task?.id ?? null;

  usePropSync(taskId, () => setEditedDate(null));

  const selectedDate = editedDate ?? task?.date ?? '';

  const handleConfirm = () => {
    if (selectedDate) {
      onDateChange(selectedDate);
    }
  };

  if (!task) return null;

  return (
    <BottomSheet onExitComplete={onExitComplete} isOpen={isOpen} onClose={onClose} title="Change Date" height="auto">
      <div className="pt-2 pb-8 px-4 space-y-4">
        <div>
          <label htmlFor={dateInputId} className="block text-xs text-gray-400 mb-2 ml-1">Select Date</label>
          <input
            id={dateInputId}
            type="date"
            value={selectedDate}
            onChange={(e) => setEditedDate(e.target.value)}
            className="mosaic-native-color-scheme w-full bg-[#1E1E1E] border border-[#333333] rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#555555] focus-visible:ring-2 focus-visible:ring-emerald-500/60 transition-colors"
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
