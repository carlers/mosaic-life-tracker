import React, { useMemo, useRef, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { useOptionalFriendList } from '../../hooks/useFriends';
import { sendTaskRequest, taskRequestOperationId } from '../../lib/taskRequests';
import { useConnectivity } from '../../hooks/useConnectivity';

export interface SendTaskRequestSheetProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId?: string | null;
  task?: { title: string; date: string } | null;
  onSent?: () => void;
}
export const SendTaskRequestSheet: React.FC<SendTaskRequestSheetProps> = ({
  isOpen,onClose,recipientId,task,onSent,
}) => {
  const friends = useOptionalFriendList();
  const {status:connection} = useConnectivity();
  const accepted = useMemo(()=>friends.filter(friend=>friend.status==='accepted' && !friend.isDeleted),[friends]);
  const [selectedRecipient,setSelectedRecipient] = useState(recipientId || '');
  const [title,setTitle] = useState(task?.title || '');
  const [note,setNote] = useState('');
  const [date,setDate] = useState(task?.date || '');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const command = useRef('');
  const resetCommand=()=>{command.current='';setError('');};
  const submit = async (event:React.FormEvent)=>{
    event.preventDefault();
    if (busy || connection!=='online') return;
    if (!command.current) command.current=taskRequestOperationId();
    setBusy(true);setError('');
    try {
      await sendTaskRequest({
        recipientId:selectedRecipient,title:title.trim(),note:note.trim(),
        suggestedDate:date,operationId:command.current,
      });
      onClose();onSent?.();
    } catch(e) {
      setError(e instanceof Error ? e.message : 'Task request could not be sent.');
    } finally {setBusy(false);}
  };
  return <BottomSheet isOpen={isOpen} onClose={onClose} title="Send task to a friend" height="auto" backdropBlur>
    <form onSubmit={event=>void submit(event)} className="space-y-4 px-4 pb-8 pt-2">
      <label className="block text-sm text-secondary">Recipient
        <select aria-label="Recipient" required disabled={busy || Boolean(recipientId)}
          value={selectedRecipient} onChange={event=>{setSelectedRecipient(event.target.value);resetCommand();}}
          className="mt-2 w-full rounded-xl bg-surfaceHighlight p-3 text-foreground">
          <option value="">Select a friend</option>
          {accepted.map(friend=><option key={friend.friendId} value={friend.friendId}>{friend.friendDisplayName || friend.friendUsername || 'Friend'}</option>)}
        </select>
      </label>
      <label className="block text-sm text-secondary">Task title
        <input required maxLength={255} value={title}
          onChange={event=>{setTitle(event.target.value);resetCommand();}}
          className="mt-2 w-full rounded-xl bg-surfaceHighlight p-3 text-foreground" />
      </label>
      <label className="block text-sm text-secondary">Suggested date (optional)
        <input type="date" value={date} onChange={event=>{setDate(event.target.value);resetCommand();}}
          className="mt-2 w-full rounded-xl bg-surfaceHighlight p-3 text-foreground" />
      </label>
      <label className="block text-sm text-secondary">Note (optional)
        <textarea maxLength={1000} rows={2} value={note}
          onChange={event=>{setNote(event.target.value);resetCommand();}}
          className="mt-2 w-full rounded-xl bg-surfaceHighlight p-3 text-foreground" />
      </label>
      <p className="text-xs text-secondary">Your friend must accept before this becomes their own independent task. Private category, memo and photo data are never sent.</p>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <button type="submit" disabled={busy || connection!=='online' || !selectedRecipient || !title.trim() || title.trim().length>255}
        className="w-full rounded-xl bg-accent px-4 py-3 font-medium text-black disabled:opacity-50">
        {busy?'Sending…':'Send request'}
      </button>
    </form>
  </BottomSheet>;
};
