import React, { useState } from 'react';
import { useSharedTasks } from '../../hooks/useSharedTasks';
import { useFriends } from '../../hooks/useFriends';
import type { SharedTaskItem } from '../../lib/taskShareQueue';

export const SharedTaskInvitationInbox: React.FC = () => {
  const { items, online, isLoading, error, updateMembership,
    pendingMembershipFor, reload } = useSharedTasks('received');
  const { friends } = useFriends();
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState('');
  const invitations = items.filter(item => item.status === 'pending');
  if (!invitations.length && !isLoading && !feedback && !error) return null;
  const act = async (item: SharedTaskItem, operation: 'accept' | 'decline') => {
    setBusy(item.id);
    setFeedback('');
    try {
      const outcome = await updateMembership(item, operation);
      setFeedback(outcome.status === 'pending' ? 'Invitation action queued for sync.' :
        outcome.status === 'rejected' ? outcome.reason || 'Invitation changed. Refresh and try again.' :
          operation === 'accept' ? 'Task added to your calendar.' : 'Invitation declined.');
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Could not update invitation.');
    } finally { setBusy(''); }
  };
  return (
    <section aria-label="Task invitations" className="px-4 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Task invitations ({invitations.length})</h2>
        <button type="button" onClick={() => void reload().catch(() => setFeedback('Could not refresh invitations.'))}
          disabled={!online || isLoading} className="text-xs text-gray-400 underline disabled:opacity-40">Refresh</button>
      </div>
      {!online && <p role="status" className="pb-2 text-xs text-amber-400">Offline — invitations may be outdated; actions can be queued.</p>}
      {(feedback || error) && <p role="status" aria-live="polite" className="pb-2 text-xs text-gray-400">{feedback || error}</p>}
      {isLoading && <p role="status" className="pb-2 text-xs text-gray-400">Checking invitations…</p>}
      <div className="space-y-2">
        {invitations.map(item => {
          const owner = friends.find(friend => friend.friendId === item.ownerId);
          const name = owner?.friendDisplayName || owner?.friendUsername || 'a friend';
          const pending = Boolean(pendingMembershipFor(item.taskId));
          return (
            <article key={item.id} className="rounded-xl bg-surfaceHighlight p-3">
              <p className="text-xs text-gray-400">{name} invited you to share a task</p>
              <p className="mt-1 text-sm font-medium">{item.title}</p>
              <p className="mt-1 text-xs text-gray-400">{item.date}</p>
              {pending && <p role="status" className="mt-1 text-xs text-amber-400">Action pending sync</p>}
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" disabled={Boolean(busy) || pending}
                  className="rounded-lg bg-surface px-3 py-2 text-sm disabled:opacity-50"
                  onClick={() => void act(item, 'decline')}>Decline</button>
                <button type="button" disabled={Boolean(busy) || pending}
                  className="rounded-lg bg-surface px-3 py-2 text-sm disabled:opacity-50"
                  onClick={() => void act(item, 'accept')}>Accept</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
