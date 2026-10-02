interface PilotReplication {
  reSync: () => void;
  awaitInSync: () => Promise<true>;
}

interface PilotCollection {
  database: {
    isLeader: () => boolean;
  };
}

export async function awaitPilotReplicationFreshness(
  label: string,
  replication: PilotReplication,
  collection: PilotCollection,
  timeoutMs: number
): Promise<void> {
  if (!collection.database.isLeader()) {
    throw new Error(
      `Fresh ${label} sync is owned by another Mosaic tab. Close other Mosaic tabs and retry this operation.`
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
        }, Math.max(1, timeoutMs));
      }),
    ]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}
