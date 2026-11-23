import React from 'react';
import { ClipboardList } from 'lucide-react';
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
  pending: 'Pending', accepted: 'Accepted', declined: 'Declined',
  withdrawn: 'Withdrawn', unavailable: 'Unavailable',
} as const;

export const TaskRequestCard: React.FC<Props> = ({
  item, event, isSender, onAccept, onDecline, onWithdraw, busy = false,
}) => (
  <div className={'my-2 flex min-w-0 ' + (isSender ? 'justify-end' : 'justify-start')}>
    {/* Match the existing chat bubble material, including wallpaper-aware
        translucent fills; never create a full-width opaque panel. */}
    <div className={
      'mosaic-chat-text-bubble w-fit min-w-0 max-w-[85%] rounded-2xl border ' +
      'border-[var(--mosaic-border)] px-3 py-3 text-white shadow-sm sm:max-w-sm ' +
      (isSender
        ? 'mosaic-chat-bubble-outgoing bg-surfaceHighlight'
        : 'mosaic-chat-bubble-incoming bg-mosaicIncoming')
    }>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
        <ClipboardList aria-hidden="true" size={14} className="shrink-0 text-emerald-400" />
        <span>{event === 'created' ? 'Task request' : 'Task request · ' + event}</span>
      </div>
      {item ? (
        <>
          <p className="mt-1.5 break-words text-sm font-semibold">{item.title}</p>
          {item.note && <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.note}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
            {item.suggestedDate && <span>Suggested: {item.suggestedDate}</span>}
            <span role="status" className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className={'h-1.5 w-1.5 rounded-full ' +
                (item.status === 'accepted' ? 'bg-emerald-500' : 'bg-gray-400')} />
              {labels[item.status]}
            </span>
          </div>
          {event === 'created' && item.status === 'pending' &&
            (isSender ? Boolean(onWithdraw) : Boolean(onAccept && onDecline)) &&
            (isSender ? (
              <button type="button" disabled={busy} onClick={onWithdraw}
                className="mosaic-material-control mt-3 rounded-lg border border-[var(--mosaic-border-strong)] bg-surfaceHighlight px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#333333] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
                Withdraw
              </button>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" disabled={busy} onClick={onDecline}
                  className="mosaic-material-control rounded-lg border border-[var(--mosaic-border-strong)] bg-surfaceHighlight px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-[#333333] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
                  Decline
                </button>
                <button type="button" disabled={busy} onClick={onAccept}
                  className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-black transition-colors hover:bg-emerald-600 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60">
                  Accept
                </button>
              </div>
            ))}
        </>
      ) : (
        <p className="mt-1 text-xs text-gray-400">
          {item === null ? 'Request unavailable' : 'Loading request…'}
        </p>
      )}
    </div>
  </div>
);
