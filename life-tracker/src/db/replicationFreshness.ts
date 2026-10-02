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

async function waitForPilotLeadership(
  label: string,
  collection: PilotCollection,
  timeoutMs: number
): Promise<void> {
  if (collection.database.isLeader()) return;

  const electionWaitMs = Math.min(Math.max(1, timeoutMs), 1_000);
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      collection.database.waitForLeadership(),
      new Promise<never>((_, reject) => {
        timer = globalThis.setTimeout(() => {
          reject(
            new Error(
              `Fresh ${label} sync is owned by another Mosaic tab. Close other Mosaic tabs and retry this operation.`
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
      `Fresh ${label} sync is owned by another Mosaic tab. Close other Mosaic tabs and retry this operation.`
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
