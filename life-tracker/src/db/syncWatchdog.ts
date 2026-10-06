export const SYNC_WATCHDOG_INTERVAL_MS = 120_000;

export function startSyncWatchdog(input: {
  shouldRun: () => boolean;
  onTick: () => void;
  intervalMs?: number;
}): () => void {
  const timer = window.setInterval(() => {
    if (input.shouldRun()) input.onTick();
  }, input.intervalMs ?? SYNC_WATCHDOG_INTERVAL_MS);

  return () => window.clearInterval(timer);
}
