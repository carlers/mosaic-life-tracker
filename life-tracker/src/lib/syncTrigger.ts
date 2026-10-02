const LOCAL_MUTATION_SYNC_DELAY_MS = 300;

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function requestSyncAfterLocalMutation(userId: string): void {
  if (!userId) return;

  const existing = pendingTimers.get(userId);
  if (existing !== undefined) {
    clearTimeout(existing);
  }

  const timer = globalThis.setTimeout(() => {
    pendingTimers.delete(userId);
    void import('../db/sync')
      .then(({ initializeSync }) => initializeSync(userId))
      .catch((error) => {
        console.error('[Sync] Local-mutation sync failed:', error);
      });
  }, LOCAL_MUTATION_SYNC_DELAY_MS);

  pendingTimers.set(userId, timer);
}

export function __resetLocalMutationSyncForTests(): void {
  for (const timer of pendingTimers.values()) {
    clearTimeout(timer);
  }
  pendingTimers.clear();
}
