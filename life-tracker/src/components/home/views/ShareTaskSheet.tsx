import React, { useState } from 'react';
import { BottomSheet } from '../../ui/BottomSheet';
import { useFriends } from '../../../hooks/useFriends';
import { useSharedTasks } from '../../../hooks/useSharedTasks';
import { setSharedTaskPermissions } from '../../../lib/taskShareQueue';
import type { TaskDocument } from '../../../db/schema';

interface ShareTaskSheetProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskDocument | null;
}

export const ShareTaskSheet: React.FC<ShareTaskSheetProps> = ({
  isOpen, onClose, task,
}) => {
  const { friends } = useFriends();
  const { items, invite, updateMembership, online, error: loadError,
    isLoading, reload } = useSharedTasks('owned', isOpen);
  const [workingId, setWorkingId] = useState('');
  const [feedback, setFeedback] = useState('');

  const members = task ? items.filter(item => item.taskId === task.id &&
    item.ownerId === task.userId) : [];

  const onInvite = async (friendId: string) => {
    if (!task || !online) return;
    setWorkingId(friendId);
    try {
      await invite(task.id, friendId);
      setFeedback('Invitation sent.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Invitation failed.');
    } finally {
      setWorkingId('');
    }
  };
  const onRevoke = async (memberId: string) => {
    const item = members.find(member => member.inviteeId === memberId);
    if (!item || !online) return;
    setWorkingId(memberId);
    try {
      await updateMembership(item, 'revoke');
      setFeedback('Share removed.');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Could not remove share.');
    } finally {
      setWorkingId('');
    }
  };

  const changePermission = async (memberId: string, field: 'title' | 'date', enabled: boolean) => {
    const item = members.find(row => row.inviteeId === memberId);
    if (!item || !online) return;
    setWorkingId(memberId);
    try {
      await setSharedTaskPermissions(item,
        field === 'title' ? enabled : item.allowTitleEdit === true,
        field === 'date' ? enabled : item.allowDateEdit === true);
      await reload();
      setFeedback('Collaborator permissions saved.');
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Could not update permissions.');
    } finally { setWorkingId(''); }
  };
  const close = () => { setFeedback(''); onClose(); };
  return (
    <BottomSheet isOpen={isOpen} onClose={close} title="Share task" height="auto" backdropBlur>
      <div className="space-y-4 px-4 pb-8 pt-2">
        <p className="text-sm text-gray-300">
          Share this task's title, date and completion with friends. You can allow each friend to edit the shared title or date. Memo, photos and
          category information remain private.
        </p>
        {!online && (
          <p role="status" className="text-sm text-amber-400">
            Connect to invite or remove collaborators.
          </p>
        )}
        {isLoading && <p role="status" className="text-xs text-gray-400">Loading collaborators…</p>}
        {(loadError || feedback) && (
          <p role="status" aria-live="polite" className="text-sm text-gray-300">
            {feedback || loadError}
          </p>
        )}
        {friends.length === 0 && (
          <p className="text-sm text-gray-400">
            Add friends from Explore before sharing tasks.
          </p>
        )}
        <ul className="space-y-2" aria-label="Friends available to share with">
          {friends.map(friend => {
            const member = members.find(item => item.inviteeId === friend.friendId);
            const busy = Boolean(workingId);
            return (
              <li key={friend.friendId} className="flex items-center gap-3 rounded-xl bg-surfaceHighlight px-3 py-3">
                <span className="min-w-0 flex-1 truncate text-sm text-white">
                  {friend.friendDisplayName || friend.friendUsername || 'Friend'}
                </span>
                {member && (
                  <span className="shrink-0 text-xs text-gray-400">
                    {member.status === 'accepted' ? 'Sharing' : 'Invited'}
                  </span>
                )}
                {member && (
                  <div className="flex shrink-0 flex-col gap-1 text-xs text-gray-400">
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={member.allowTitleEdit}
                        disabled={!online || busy}
                        onChange={event => void changePermission(friend.friendId, 'title', event.target.checked)} />
                      Edit title
                    </label>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={member.allowDateEdit}
                        disabled={!online || busy}
                        onChange={event => void changePermission(friend.friendId, 'date', event.target.checked)} />
                      Change date
                    </label>
                  </div>
                )}
                <button type="button"
                  disabled={!online || busy}
                  onClick={() => member ? onRevoke(friend.friendId) : onInvite(friend.friendId)}
                  className="rounded-lg bg-surface px-3 py-2 text-xs font-medium text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-emerald-500"
                  aria-label={member ? `Remove ${friend.friendDisplayName || friend.friendUsername} from task` :
                    `Invite ${friend.friendDisplayName || friend.friendUsername} to task`}>
                  {workingId === friend.friendId ? 'Saving…' : member ? 'Remove' : 'Invite'}
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => void reload().catch(err =>
          setFeedback(err instanceof Error ? err.message : 'Could not refresh shares.'))}
          disabled={!online || isLoading}
          className="text-sm text-gray-400 underline disabled:opacity-50">
          Refresh
        </button>
      </div>
    </BottomSheet>
  );
};
