import React, { useState } from 'react';
import { useRetainedSheetValue } from '../../../hooks/useRetainedSheetValue';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { Calendar } from 'lucide-react';
import { usePropSync } from '../../../hooks/usePropSync';
import { TaskDateCalendar } from './TaskDateCalendar';
import type { TaskDocument } from '../../../db/schema';

type DateTarget = Pick<TaskDocument, 'id' | 'date'>;

interface DatePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  task: DateTarget | null;
  onDateChange: (newDate: string) => void;
  isWorking?: boolean;
}

export const DatePickerSheet: React.FC<DatePickerSheetProps> = ({
  isOpen,
  onClose,
  task: incomingTask,
  onDateChange,
  isWorking = false,
}) => {
  const { value: task, onExitComplete } = useRetainedSheetValue(incomingTask, isOpen);
  const [editedDate, setEditedDate] = useState<string | null>(null);
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
    <BottomSheet onExitComplete={onExitComplete} isOpen={isOpen} onClose={onClose} title="Change Date" height="auto" preventDismiss={isWorking}>
      <div className="pt-2 pb-8 px-4 space-y-4">
        <TaskDateCalendar value={selectedDate} onChange={setEditedDate} disabled={isWorking} />
        <Button variant="primary" className="w-full gap-2 py-3" onClick={handleConfirm} disabled={!selectedDate || isWorking}>
          <Calendar size={18} />
          Confirm Date
        </Button>
      </div>
    </BottomSheet>
  );
};
