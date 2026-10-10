import React, { useState } from 'react';
import { SharedTaskRows } from '../home/views/SharedTaskRows';
import { useSharedTasks } from '../../hooks/useSharedTasks';
import type { SharedTaskItem } from '../../lib/taskShareQueue';

export const SharedTasksSection: React.FC = () => {
  const { items, activeItems, isLoading, online, error, pendingFor,
    updateMembership, updateCompletion, reload } = useSharedTasks('received');
  const [working, setWorking] = useState('');
  const [message, setMessage] = useState('');
  const invitations = items.filter(item => item.status === 'pending');

  const manage = async (
    item: SharedTaskItem, operation: 'accept' | 'decline' | 'leave'
  ) => {
    if (!online) return;
    setWorking(item.id);
    setMessage('');
    try {
      await updateMembership(item, operation);
      setMessage(operation === 'accept' ? 'Task shared.' :
        operation === 'leave' ? 'Left shared task.' : 'Invitation declined.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Shared task action failed.');
    } finally {
      setWorking('');
    }
  };

  const complete = async (item: SharedTaskItem, desired: boolean) => {
    try {
      const result = await updateCompletion(item, desired);
      setMessage(result.status === 'pending' ? 'Completion queued. Connect to synchronize.' :
        result.status === 'rejected' ? (result.reason || 'Completion conflict; refresh and retry.') :
          'Completion synchronized.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Completion could not be queued.');
    }
  };

  return (
    <section className="space-y-2" aria-labelledby="shared-tasks-heading">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 id="shared-tasks-heading" className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          Shared tasks ({activeItems.length})
        </h2>
        <button type="button" disabled={!online || isLoading} onClick={() =>
          void reload().catch(err => setMessage(err instanceof Error ? err.message : 'Refresh failed.'))}
          className="rounded-lg px-2 py-1 text-xs text-gray-400 underline disabled:opacity-50">
          Refresh
        </button>
      </div>
      {!online && <p role="status" className="px-1 text-xs text-amber-400">
        Offline: shared tasks may be out of date. Completions can be queued.
      </p>}
      {isLoading && <p role="status" className="px-1 text-xs text-gray-400">
        Checking shared tasks…
      </p>}
      {(message || error) && <p role="status" aria-live="polite" className="px-1 text-sm text-gray-300">
        {message || error}
      </p>}
      {invitations.length > 0 && (
        <div className="space-y-2">
          <h3 className="px-1 text-xs font-semibold text-gray-300">
            Task invitations ({invitations.length})
          </h3>
          {invitations.map(item => (
            <div key={item.id} className="rounded-xl bg-surfaceHighlight p-3">
              <p className="truncate text-sm text-white">{item.title}</p>
              <p className="text-xs text-gray-400">{item.date} · From a friend</p>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" disabled={!online || Boolean(working)}
                  onClick={() => void manage(item, 'decline')}
                  className="rounded-lg bg-surface px-3 py-2 text-sm text-white disabled:opacity-50">
                  Decline
                </button>
                <button type="button" disabled={!online || Boolean(working)}
                  onClick={() => void manage(item, 'accept')}
                  className="rounded-lg bg-surface px-3 py-2 text-sm text-white disabled:opacity-50">
                  Accept
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {activeItems.length > 0 ? (
        <>
          <SharedTaskRows items={activeItems} showDate pendingFor={pendingFor} onSetCompleted={complete} />
          <details className="space-y-2 px-1 text-sm text-gray-400">
            <summary className="cursor-pointer py-2">Manage shared tasks</summary>
            {activeItems.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-xs text-gray-300">{item.title}</span>
                <button type="button" onClick={() => void manage(item, 'leave')}
                  disabled={!online || Boolean(working)}
                  className="rounded-lg bg-surfaceHighlight px-3 py-2 text-xs text-white disabled:opacity-50">
                  Leave
                </button>
              </div>
            ))}
          </details>
        </>
      ) : invitations.length === 0 && !isLoading && (
        <p className="px-1 text-xs text-gray-400">No shared tasks yet.</p>
      )}
    </section>
  );
};
