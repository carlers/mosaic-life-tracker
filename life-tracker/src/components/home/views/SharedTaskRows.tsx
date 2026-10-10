import React, { useState } from 'react';
import { MoreHorizontal, UsersRound } from 'lucide-react';
import { BottomSheet } from '../../ui/BottomSheet';
import { useFriends } from '../../../hooks/useFriends';
import type {
  SharedCompletionCommand, SharedTaskItem,
} from '../../../lib/taskShareQueue';

interface SharedTaskRowsProps {
  items: SharedTaskItem[];
  onSetCompleted: (item: SharedTaskItem, desired: boolean) => void | Promise<unknown>;
  pendingFor: (taskId: string) => SharedCompletionCommand | undefined;
  showDate?: boolean;
  onLeave?: (item: SharedTaskItem) => void | Promise<unknown>;
}

export const SharedTaskRows: React.FC<SharedTaskRowsProps> = ({
  items, onSetCompleted, pendingFor, showDate = false, onLeave,
}) => {
  const { friends } = useFriends();
  const [selected, setSelected] = useState<SharedTaskItem | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  if (!items.length) return null;
  return (
    <section aria-label="Shared tasks" className="mt-3 min-w-0 space-y-2">
      <h3 className="flex items-center gap-1 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        <UsersRound size={13} aria-hidden="true" /> Shared with me
      </h3>
      {items.map(item => {
        const pending = pendingFor(item.taskId);
        const owner = friends.find(friend => friend.friendId === item.ownerId);
        return (
          <div key={item.id} className="flex min-w-0 items-center gap-3 rounded-xl bg-surfaceHighlight p-3">
            <button type="button"
              aria-pressed={pending?.completed ?? item.completed}
              aria-label={`${(pending?.completed ?? item.completed) ? 'Mark incomplete' : 'Mark complete'}: ${item.title}`}
              disabled={Boolean(pending)}
              onClick={() => void onSetCompleted(item, !item.completed)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#444444] bg-surface text-white disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-emerald-500">
              {(pending?.completed ?? item.completed) ? '✓' : ''}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{item.title}</p>
              <p className="truncate text-xs text-gray-400">
                Shared by {owner?.friendDisplayName || owner?.friendUsername || 'friend'}
                {showDate ? ` · ${item.date}` : ''}
              </p>
              {pending && (
                <p className="text-xs text-amber-400" role="status">
                  Pending sync · not yet confirmed
                </p>
              )}
            </div>
            {onLeave && (
              <button type="button" onClick={() => { setFeedback(''); setSelected(item); }}
                aria-label={'Manage shared task ' + item.title}
                className="shrink-0 rounded-lg p-1.5 text-gray-400 focus-visible:outline-2 focus-visible:outline-emerald-500">
                <MoreHorizontal size={18} />
              </button>
            )}
          </div>
        );
      })}
      {onLeave && <BottomSheet isOpen={Boolean(selected)} onClose={() => setSelected(null)}
        title="Shared task" height="auto">
        <div className="space-y-3 px-4 pb-8 pt-2">
          <p className="text-sm">{selected?.title}</p>
          <p className="text-xs text-gray-400">Shared by {friends.find(f => f.friendId === selected?.ownerId)?.friendDisplayName ||
            friends.find(f => f.friendId === selected?.ownerId)?.friendUsername || 'a friend'}. Only the owner can edit details.</p>
          {feedback && <p role="status" className="text-sm text-gray-400">{feedback}</p>}
          <button type="button" disabled={!selected || leaving}
            className="w-full rounded-lg bg-surfaceHighlight p-3 text-left text-sm disabled:opacity-50"
            onClick={() => {
              if (!selected) return;
              setLeaving(true);
              void Promise.resolve(onLeave(selected)).then(() => setSelected(null))
                .catch(cause => setFeedback(cause instanceof Error ? cause.message : 'Could not leave task.'))
                .finally(() => setLeaving(false));
            }}>Leave shared task</button>
        </div>
      </BottomSheet>}
    </section>
  );
};
