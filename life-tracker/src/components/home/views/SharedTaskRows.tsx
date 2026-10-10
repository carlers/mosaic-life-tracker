import React from 'react';
import { useFriends } from '../../../hooks/useFriends';
import type {
  SharedCompletionCommand, SharedTaskItem,
} from '../../../lib/taskShareQueue';

interface SharedTaskRowsProps {
  items: SharedTaskItem[];
  onSetCompleted: (item: SharedTaskItem, desired: boolean) => void | Promise<unknown>;
  pendingFor: (taskId: string) => SharedCompletionCommand | undefined;
  showDate?: boolean;
}

export const SharedTaskRows: React.FC<SharedTaskRowsProps> = ({
  items, onSetCompleted, pendingFor, showDate = false,
}) => {
  const { friends } = useFriends();
  if (!items.length) return null;
  return (
    <section aria-label="Shared tasks" className="mt-3 min-w-0 space-y-2">
      <h3 className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Shared tasks
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
          </div>
        );
      })}
    </section>
  );
};
