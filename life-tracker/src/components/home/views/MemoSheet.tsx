import React, { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '../../ui/BottomSheet';
import { usePropSync } from '../../../hooks/usePropSync';
import type { TaskDocument } from '../../../db/schema';

type MemoVisibility = '' | 'private' | 'followers' | 'public';
type MemoMode = 'view' | 'edit';

interface MemoSheetProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskDocument | null;
  onSave: (memo: string, visibility: MemoVisibility) => void;
  initialMode?: MemoMode;
}

export const MemoSheet: React.FC<MemoSheetProps> = ({
  isOpen,
  onClose,
  task,
  onSave,
  initialMode = 'edit',
}) => {
  const [editedMemo, setEditedMemo] = useState<string | null>(null);
  const [mode, setMode] = useState<MemoMode>(initialMode);
  const [privateOnlyOverride, setPrivateOnlyOverride] = useState<boolean | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const taskId = task?.id ?? null;

  usePropSync(taskId, () => {
    setEditedMemo(null);
    setMode(initialMode);
    setPrivateOnlyOverride(null);
  });

  useEffect(() => {
    if (isOpen && mode === 'edit' && taskId) textareaRef.current?.focus();
  }, [isOpen, mode, taskId]);

  if (!task) return null;

  const memo = editedMemo ?? task.memo ?? '';
  const originalVisibility: MemoVisibility =
    task.visibility === 'private' || task.visibility === 'followers' || task.visibility === 'public'
      ? task.visibility
      : '';
  const privateOnly = privateOnlyOverride ?? originalVisibility === 'private';
  const saveVisibility: MemoVisibility = privateOnly
    ? 'private'
    : originalVisibility === 'private'
      ? ''
      : originalVisibility;

  const handleDone = () => {
    onSave(memo, saveVisibility);
    onClose();
  };
  const handleDelete = () => {
    onSave('', saveVisibility);
    onClose();
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={task.title} height="auto">
      <div className="px-4 pb-8 pt-2">
        {mode === 'view' ? (
          <button
            type="button"
            aria-label="Edit memo"
            onClick={() => setMode('edit')}
            className="w-full whitespace-pre-wrap rounded-xl bg-[#1A1A1A] p-4 text-left text-base text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
          >
            {memo || 'Add a memo'}
          </button>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              {task.memo ? (
                <button type="button" onClick={handleDelete} className="text-base font-semibold text-red-400">
                  Delete
                </button>
              ) : (
                <div className="w-12" />
              )}
              <button type="button" onClick={handleDone} className="text-base font-semibold text-white">
                Done
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={memo}
              onChange={(e) => setEditedMemo(e.target.value)}
              placeholder="Enter a memo"
              aria-label="Memo"
              className="min-h-[200px] w-full resize-none rounded-xl bg-[#1A1A1A] p-4 text-base text-white placeholder-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            />
            <button
              type="button"
              role="switch"
              aria-checked={privateOnly}
              aria-label="Visible to me only"
              onClick={() => setPrivateOnlyOverride(!privateOnly)}
              className="mt-4 flex w-full items-center justify-between rounded-xl border border-[#333333] bg-[#1A1A1A] px-4 py-3 text-sm text-white"
            >
              <span>Visible to me only</span>
              <span aria-hidden="true" className={`relative h-6 w-11 rounded-full transition-colors ${privateOnly ? 'bg-emerald-500' : 'bg-[#444444]'}`}>
                <span aria-hidden="true" className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${privateOnly ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </span>
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  );
};
