import React, { useState } from 'react';
import { TaskDateEditor } from './TaskDateEditor';
import { ArrowRight, CalendarDays, Eye } from 'lucide-react';
import { BottomSheet } from '../../ui/BottomSheet';

interface BulkTaskActionSheetProps {
  isOpen: boolean;
  count: number;
  onClose: () => void;
  onMoveCategory: () => void;
  onChangeDate: (date: string) => Promise<unknown> | unknown;
  onDoToday: () => void;
  onDoTomorrow: () => void;
  onVisibility: () => void;
  isWorking?: boolean;
}

export const BulkTaskActionSheet: React.FC<BulkTaskActionSheetProps> = ({
  isOpen,
  count,
  onClose,
  onMoveCategory,
  onChangeDate,
  onDoToday,
  onDoTomorrow,
  onVisibility,
  isWorking = false,
}) => {
  const [dateMode, setDateMode] = useState(false);
  const dismiss = () => { setDateMode(false); onClose(); };
  const actions = [
    { label: 'Move to Category', icon: ArrowRight, action: onMoveCategory },
    { label: 'Change Date', icon: CalendarDays, action: () => setDateMode(true) },
    { label: 'Do It Today', icon: ArrowRight, action: onDoToday },
    { label: 'Do It Tomorrow', icon: ArrowRight, action: onDoTomorrow },
    { label: 'Visibility', icon: Eye, action: onVisibility },
  ];

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`${count} ${count === 1 ? 'Task' : 'Tasks'} Selected`}
      height="auto"
      backdropBlur
      preventDismiss={isWorking}
    >
      {dateMode ? (
        <TaskDateEditor initialDate=""
          onCancel={() => setDateMode(false)}
          onSave={async date => { await onChangeDate(date); dismiss(); }} />
      ) : <div className="space-y-1 px-4 pb-8 pt-2">
        {actions.map(({ label, icon: Icon, action }) => (
          <button
            key={label}
            type="button"
            disabled={isWorking}
            onClick={action}
            className="flex w-full items-center gap-4 rounded-xl px-2 py-3.5 text-white transition-colors hover:bg-[#252525] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-400" aria-hidden="true">
              <Icon size={16} className="text-black" />
            </span>
            <span className="text-base font-medium">{label}</span>
          </button>
        ))}
      </div>}
    </BottomSheet>
  );
};
