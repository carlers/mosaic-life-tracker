import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';
import { TaskDateCalendar } from './TaskDateCalendar';

interface BulkDatePickerSheetProps {
  isOpen: boolean;
  count: number;
  onClose: () => void;
  onSave: (date: string) => void;
  isWorking?: boolean;
}

export const BulkDatePickerSheet: React.FC<BulkDatePickerSheetProps> = ({
  isOpen,
  count,
  onClose,
  onSave,
  isWorking = false,
}) => {
  const [date, setDate] = useState('');

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Change Date" height="auto" preventDismiss={isWorking}>
      <div className="space-y-4 px-4 pb-8 pt-2">
        <p className="text-center text-xs text-gray-400">Move {count} selected {count === 1 ? 'task' : 'tasks'}.</p>
        <TaskDateCalendar value={date} onChange={setDate} disabled={isWorking} />
        <Button variant="primary" className="w-full gap-2 py-3" disabled={!date || isWorking} onClick={() => onSave(date)}>
          <Calendar size={18} />
          {isWorking ? 'Moving…' : 'Confirm Date'}
        </Button>
      </div>
    </BottomSheet>
  );
};
