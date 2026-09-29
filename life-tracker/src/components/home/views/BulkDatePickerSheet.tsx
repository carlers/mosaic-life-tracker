import React, { useId, useState } from 'react';
import { Calendar } from 'lucide-react';
import { BottomSheet } from '../../ui/BottomSheet';
import { Button } from '../../ui/Button';

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
  const inputId = useId();

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Change Date" height="auto" preventDismiss={isWorking}>
      <div className="space-y-4 px-4 pb-8 pt-2">
        <p className="text-center text-xs text-gray-400">Move {count} selected {count === 1 ? 'task' : 'tasks'}.</p>
        <div>
          <label htmlFor={inputId} className="mb-2 ml-1 block text-xs text-gray-400">Select Date</label>
          <input
            id={inputId}
            type="date"
            value={date}
            disabled={isWorking}
            onChange={(event) => setDate(event.target.value)}
            className="mosaic-native-color-scheme w-full rounded-xl border border-[#333333] bg-[#1E1E1E] p-3 text-sm text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          />
        </div>
        <Button variant="primary" className="w-full gap-2 py-3" disabled={!date || isWorking} onClick={() => onSave(date)}>
          <Calendar size={18} />
          {isWorking ? 'Moving…' : 'Confirm Date'}
        </Button>
      </div>
    </BottomSheet>
  );
};
