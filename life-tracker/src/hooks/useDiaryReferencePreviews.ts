import { useEffect, useMemo, useState } from 'react';
import type { MessageDocument } from '../db/schema';
import { sendAppAction } from '../lib/appAction';

export type DiaryReferencePreview = { date: string; excerpt: string };

/** Private, short-lived Chat preview. Never trust persisted diaryRefExcerpt. */
export function useDiaryReferencePreviews(
  messages: MessageDocument[],
  userId: string,
  online: boolean,
): Record<string, DiaryReferencePreview> {
  const referenceIds = useMemo(() =>
    messages.filter(m => m.diaryRefId && !m.isUnsent && !m.isDeleted &&
      m.deliveryStatus === 'delivered').map(m => m.id).join('|'), [messages]);
  const scope = userId + ':' + (online ? 'online' : 'offline') + ':' + referenceIds;
  const [state, setState] = useState<{ scope: string; previews: Record<string, DiaryReferencePreview> }>({
    scope: '', previews: {},
  });
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const refresh = async () => {
      if (!userId || !online || document.hidden || inFlight) return;
      inFlight = true;
      setState({ scope, previews: {} }); // Clear before checking authorization.
      try {
        const ids = referenceIds ? referenceIds.split('|') : [];
        const next: Record<string, DiaryReferencePreview> = {};
        for (let i = 0; i < ids.length; i += 25) {
          const batch = ids.slice(i, i + 25);
          const result = await sendAppAction({
            action: 'get_diary_reference_previews', messageIds: batch,
          });
          if (cancelled) return;
          const values = result.previews;
          if (!values || typeof values !== 'object' || Array.isArray(values))
            throw new Error('Invalid diary preview response');
          for (const id of batch) {
            const item = (values as Record<string, unknown>)[id];
            if (!item || typeof item !== 'object') continue;
            const preview = item as Record<string, unknown>;
            if (typeof preview.date === 'string' &&
                typeof preview.excerpt === 'string' && preview.excerpt.length <= 120) {
              next[id] = { date: preview.date, excerpt: preview.excerpt };
            }
          }
        }
        if (!cancelled) setState({ scope, previews: next });
      } catch {
        if (!cancelled) setState({ scope, previews: {} });
      } finally {
        inFlight = false;
      }
    };
    void refresh();
    const onVisibility = () => {
      if (document.hidden) setState({ scope, previews: {} });
      else void refresh();
    };
    const onFocus = () => { void refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    const interval = window.setInterval(() => { void refresh(); }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [referenceIds, userId, online]);
  return online && state.scope === scope ? state.previews : {};
}
