import React from 'react';
import { BottomSheet } from '../../ui/BottomSheet';
import { visibilityOptionIcon, type TaskVisibility } from '../../../lib/visibility';

interface BulkVisibilitySheetProps {
  isOpen: boolean;
  count: number;
  onClose: () => void;
  onSave: (visibility: '' | TaskVisibility) => void;
  isWorking?: boolean;
}

const OPTIONS: Array<{ value: '' | TaskVisibility; label: string; description: string }> = [
  { value: '', label: 'Default', description: 'Each task follows its own category' },
  { value: 'private', label: 'Private', description: 'Only visible to you' },
  { value: 'followers', label: 'Friends', description: 'Visible to accepted friends' },
  { value: 'public', label: 'Public', description: 'Visible to anyone' },
];

export const BulkVisibilitySheet: React.FC<BulkVisibilitySheetProps> = ({
  isOpen,
  count,
  onClose,
  onSave,
  isWorking = false,
}) => (
  <BottomSheet isOpen={isOpen} onClose={onClose} title="Visibility" height="auto" preventDismiss={isWorking}>
    <div className="space-y-2 px-4 pb-8 pt-2">
      <p className="mb-4 text-center text-xs text-gray-400">Change visibility for {count} selected {count === 1 ? 'task' : 'tasks'}.</p>
      {OPTIONS.map((option) => (
        <button
          key={option.value || 'default'}
          type="button"
          disabled={isWorking}
          onClick={() => onSave(option.value)}
          className="flex w-full items-center gap-3 rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-3 text-left transition-colors hover:bg-[#222222] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2A2A2A]" aria-hidden="true">
            {visibilityOptionIcon(option.value || 'followers', 16, 'text-gray-300')}
          </span>
          <span>
            <span className="block text-sm font-medium text-white">{option.label}</span>
            <span className="mt-0.5 block text-xs text-gray-400">{option.description}</span>
          </span>
        </button>
      ))}
    </div>
  </BottomSheet>
);
