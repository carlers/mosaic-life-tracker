/**
 * Durable, owner-scoped local UI state for outgoing sends rejected by the server.
 * Intentionally never replicated: shipped clients accept only pending/delivered.
 * Stores message IDs, not message content or backend response bodies.
 */
const STORAGE_PREFIX = 'mosaic_denied_outgoing_v1_';
const MAX_IDS_PER_OWNER = 500;
const cache = new Map<string, string[]>();
const listeners = new Set<() => void>();

// Installed once even when ChatPage is not mounted: background delivery and
// another tab must not use stale cached denial IDs after a storage change.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key.startsWith(STORAGE_PREFIX)) {
      cache.clear();
      listeners.forEach(listener => listener());
    }
  });
}

function readIds(ownerId: string): string[] {
  if (!ownerId) return [];
  const cached = cache.get(ownerId);
  if (cached) return cached;
  let ids: string[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + ownerId);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      ids = parsed.filter((id): id is string =>
        typeof id === 'string' && id.length > 0 && id.length <= 255
      ).slice(-MAX_IDS_PER_OWNER);
    }
  } catch {
    // Storage may be unavailable (private browsing/quota). Keep session state.
  }
  cache.set(ownerId, ids);
  return ids;
}

function persist(ownerId: string, ids: string[]): void {
  cache.set(ownerId, ids);
  try {
    if (ids.length) {
      localStorage.setItem(STORAGE_PREFIX + ownerId, JSON.stringify(ids));
    } else {
      localStorage.removeItem(STORAGE_PREFIX + ownerId);
    }
  } catch {
    // Session cache still prevents unintended automatic retries this session.
  }
  listeners.forEach(listener => listener());
}

export function isDeniedOutgoing(ownerId: string, messageId: string): boolean {
  return readIds(ownerId).includes(messageId);
}

export function markDeniedOutgoing(ownerId: string, messageId: string): void {
  if (!ownerId || !messageId || isDeniedOutgoing(ownerId, messageId)) return;
  persist(ownerId, [...readIds(ownerId), messageId].slice(-MAX_IDS_PER_OWNER));
}

export function clearDeniedOutgoing(ownerId: string, messageId: string): void {
  if (!isDeniedOutgoing(ownerId, messageId)) return;
  persist(ownerId, readIds(ownerId).filter(id => id !== messageId));
}

export function subscribeDeniedOutgoing(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function __resetDeniedOutgoingForTests(): void {
  cache.clear();
}
