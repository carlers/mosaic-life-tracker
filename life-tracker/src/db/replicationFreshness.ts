interface PilotReplication {
  reSync: () => void;
  awaitInSync: () => Promise<true>;
}

interface PilotCollection {
  database: {
    isLeader: () => boolean;
    waitForLeadership: () => Promise<boolean>;
  };
}

// RxDB's cross-tab election may take more than one second, especially when
// a mobile PWA is resuming. Leave time for a legitimate handoff while still
// bounding the wait well inside the caller's full freshness deadline.
const LOCAL_LEADERSHIP_GRACE_MS = 10_000;

async function waitForPilotLeadership(
  label: string,
  collection: PilotCollection,
  timeoutMs: number
): Promise<void> {
  if (collection.database.isLeader()) return;

  const electionWaitMs = Math.min(Math.max(1, timeoutMs), LOCAL_LEADERSHIP_GRACE_MS);
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      collection.database.waitForLeadership(),
      new Promise<never>((_, reject) => {
        timer = globalThis.setTimeout(() => {
          reject(
            new Error(
              `Fresh ${label} sync timed out waiting for local database leadership. A Mosaic tab or installed app on this device may still be active; retry after the handoff.`
            )
          );
        }, electionWaitMs);
      }),
    ]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }

  if (!collection.database.isLeader()) {
    throw new Error(
      `Fresh ${label} sync could not confirm local database leadership. A different local Mosaic window may be active; retry after the handoff.`
    );
  }
}

export async function awaitPilotReplicationFreshness(
  label: string,
  replication: PilotReplication,
  collection: PilotCollection,
  timeoutMs: number
): Promise<void> {
  const startedAt = Date.now();
  await waitForPilotLeadership(label, collection, timeoutMs);

  const remainingMs = timeoutMs - (Date.now() - startedAt);
  if (remainingMs <= 0) {
    throw new Error(
      `Fresh ${label} sync timed out. Check your connection and retry.`
    );
  }

  replication.reSync();

  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      replication.awaitInSync(),
      new Promise<never>((_, reject) => {
        timer = globalThis.setTimeout(() => {
          reject(
            new Error(
              `Fresh ${label} sync timed out. Check your connection and retry.`
            )
          );
        }, Math.max(1, remainingMs));
      }),
    ]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}
