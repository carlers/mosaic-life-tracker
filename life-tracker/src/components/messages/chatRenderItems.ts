import { format, isSameDay, subDays } from 'date-fns';
import type { MessageDocument } from '../../db/schema';
import { stickerSummary } from '../../lib/stickerProtocol';

export const TIMESTAMP_GAP_MS = 5 * 60 * 1000;

export type RenderItem =
  | { kind: 'divider'; key: string; label: string }
  | {
      kind: 'message';
      key: string;
      message: MessageDocument;
      showTimestamp: boolean;
    };

export function dateDividerLabel(date: Date): string {
  const now = new Date();
  if (isSameDay(date, now)) return 'Today';
  if (isSameDay(date, subDays(now, 1))) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

export function messageMatchesQuery(
  m: MessageDocument,
  query: string
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (stickerSummary(m.content).toLowerCase().includes(q)) return true;
  if (m.taskRefTitle && m.taskRefTitle.toLowerCase().includes(q)) return true;
  if (m.replyToContent && m.replyToContent.toLowerCase().includes(q))
    return true;
  return false;
}

export function buildRenderItems(
  messages: MessageDocument[],
  isFiltering: boolean,
  query: string
): RenderItem[] {
  const items: RenderItem[] = [];
  let lastDate: Date | null = null;
  let lastTimestamp = 0;

  for (const m of messages) {
    if (isFiltering && !messageMatchesQuery(m, query)) continue;

    const created = new Date(m.createdAt);
    const createdMs = created.getTime();

    if (!isFiltering) {
      if (!lastDate || !isSameDay(created, lastDate)) {
        items.push({
          kind: 'divider',
          key: `divider-${m.id}`,
          label: dateDividerLabel(created),
        });
        lastTimestamp = 0;
      } else if (createdMs - lastTimestamp > TIMESTAMP_GAP_MS) {
        items.push({
          kind: 'divider',
          key: `divider-${m.id}`,
          label: format(created, 'h:mm a'),
        });
      }
    }

    items.push({
      kind: 'message',
      key: `message-${m.id}`,
      message: m,
      showTimestamp: !isFiltering && createdMs - lastTimestamp > TIMESTAMP_GAP_MS,
    });

    lastDate = created;
    lastTimestamp = createdMs;
  }

  return items;
}
