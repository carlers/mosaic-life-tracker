import React from 'react';
import type { TaskRequestItem, TaskRequestEvent } from '../../lib/taskRequests';
interface Props {
  item: TaskRequestItem | null | undefined;
  event: TaskRequestEvent | '';
  isSender: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onWithdraw?: () => void;
  busy?: boolean;
}
const labels = {
  pending:'Pending',accepted:'Accepted',declined:'Declined',
  withdrawn:'Withdrawn',unavailable:'Unavailable',
} as const;
export const TaskRequestCard:React.FC<Props>=({
  item,event,isSender,onAccept,onDecline,onWithdraw,busy=false,
})=><div className={'my-2 flex '+(isSender?'justify-end':'justify-start')}>
  <div className="mosaic-chat-text-bubble w-full max-w-[85%] rounded-2xl border border-surfaceHighlight bg-surface px-4 py-3 text-foreground">
    <p className="text-xs font-semibold text-secondary">{event==='created'?'Task request':'Task request · '+event}</p>
    {item ? <>
      <div className="mt-1 break-words font-medium">{item.title}</div>
      {item.note && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.note}</p>}
      {item.suggestedDate && <p className="mt-2 text-xs text-secondary">Suggested: {item.suggestedDate}</p>}
      <p className="mt-2 text-xs text-secondary" role="status">{labels[item.status]}</p>
      {event==='created' && item.status==='pending' && (isSender ? Boolean(onWithdraw) : Boolean(onAccept && onDecline)) && (isSender
        ? <button disabled={busy} type="button" onClick={onWithdraw}
            className="mt-3 rounded-lg border border-surfaceHighlight px-3 py-2 text-sm disabled:opacity-50">Withdraw</button>
        : <div className="mt-3 flex gap-2">
            <button disabled={busy} type="button" onClick={onDecline}
              className="rounded-lg border border-surfaceHighlight px-3 py-2 text-sm disabled:opacity-50">Decline</button>
            <button disabled={busy} type="button" onClick={onAccept}
              className="rounded-lg bg-accent px-3 py-2 text-sm text-black disabled:opacity-50">Accept</button>
          </div>)}
    </> : <p className="mt-1 text-sm text-secondary">{item===null?'Request unavailable':'Loading request…'}</p>}
  </div>
</div>;
