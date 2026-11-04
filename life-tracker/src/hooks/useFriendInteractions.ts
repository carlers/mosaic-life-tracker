import { useEffect, useMemo, useState } from 'react';
import { getDatabase } from '../db/database';
import type { MessageDocument, FriendshipDocument } from '../db/schema';
import { useAuth } from './useAuth';
import { rankFriendInteractions, type FriendInteraction } from '../lib/friendSort';

const EMPTY = new Map<string, FriendInteraction>();
/** No chat hydration on Home; bounded local subscription only while Closest is active. */
export function useFriendInteractions(active: boolean, friends: readonly FriendshipDocument[]) {
  const { user } = useAuth();
  const uid = user?.$id;
  const [snapshot, setSnapshot] = useState<{ owner: string; docs: MessageDocument[] } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !uid) return;
    let alive = true;
    let sub: { unsubscribe: () => void } | undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString();
    (async () => {
      try {
        const query = getDatabase().messages.find({
          selector: { userId: uid, isDeleted: false, createdAt: { $gte: cutoff } },
          sort: [{ createdAt: 'desc' }], limit: 5000,
        });
        const subscription = query.$.subscribe(docs => {
          if (alive) setSnapshot({ owner: uid, docs: docs as MessageDocument[] });
        });
        if (alive) sub = subscription;
        else subscription.unsubscribe();
      } catch {
        if (alive) setSnapshot({ owner: uid, docs: [] });
      }
    })();
    return () => { alive = false; sub?.unsubscribe(); window.clearInterval(timer); };
  }, [active, uid]);
  return useMemo(() => active && uid && snapshot?.owner === uid
    ? rankFriendInteractions(snapshot.docs, uid, friends, now) : EMPTY,
    [active, uid, snapshot, friends, now]);
}
