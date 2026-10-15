import type { FC } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import type { ChatSyncStage } from '../../lib/chatReconcile';

type DisplayStage = ChatSyncStage | 'failed';
interface ChatSyncSheetProps {
  isOpen: boolean;
  onClose: () => void;
  stage: DisplayStage;
  repaired: number | null;
  error: string | null;
}

const steps = [
  'Sending queued messages',
  'Reconciling server copies',
  'Refreshing local messages',
] as const;

const stepNumber: Record<ChatSyncStage, number> = {
  sending: 0,
  repairing: 1,
  receiving: 2,
  complete: 3,
};

export const ChatSyncSheet: FC<ChatSyncSheetProps> = ({
  isOpen, onClose, stage, repaired, error,
}) => {
  const activeStep = stage === 'failed' ? -1 : stepNumber[stage];
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Chat Sync" height="auto">
      <div className="px-4 pt-2 pb-8 space-y-3">
        <p role="status" aria-live="polite" className="text-sm text-gray-300">
          {stage === 'complete'
            ? 'Chat messages are up to date on this device.'
            : stage === 'failed'
              ? 'Chat sync stopped before completion.'
              : 'Synchronizing this conversation…'}
        </p>
        <ol aria-label="Chat sync progress" className="space-y-2">
          {steps.map((label, index) => {
            const done = stage === 'complete' || activeStep > index;
            const current = activeStep === index;
            return (
              <li key={label} className="rounded-lg bg-[#1A1A1A] p-3 flex items-center justify-between gap-3">
                <span className="text-sm text-white">{label}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  {done ? 'Done' : current ? 'In progress' : stage === 'failed' ? 'Stopped' : 'Waiting'}
                </span>
              </li>
            );
          })}
        </ol>
        {repaired !== null && (
          <p className="text-xs text-gray-400">
            Server copies recovered: {repaired}
          </p>
        )}
        {error && (
          <div role="alert" className="rounded-lg border border-red-900/40 bg-[#1A1A1A] p-3">
            <p className="text-sm text-red-400 break-words">{error}</p>
          </div>
        )}
      </div>
    </BottomSheet>
  );
};
