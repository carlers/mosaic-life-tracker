import { runBackup as defaultRunBackup } from './backup.mjs';

function isAuthorized(req) {
  const trigger = req?.headers?.['x-appwrite-trigger'] || '';
  if (trigger === 'schedule') return true;
  return (
    trigger === 'http' &&
    process.env.DR_ALLOW_MANUAL_EXECUTION === 'true' &&
    Boolean(req?.headers?.['x-appwrite-key'])
  );
}

export function createHandler({ runBackup = defaultRunBackup } = {}) {
  return async ({ req, res, log, error }) => {
    if (!isAuthorized(req)) {
      error('dr-backup: rejected untrusted execution');
      return res.json({ error: 'Forbidden' }, 403);
    }

    const started = Date.now();
    try {
      const result = await runBackup({
        appwriteKey: req.headers['x-appwrite-key'],
      });
      const durationMs = Date.now() - started;
      log(
        `dr-backup: complete backupId=${result.backupId} ` +
          `users=${result.counts?.users ?? 0} rows=${result.counts?.rows ?? 0} ` +
          `files=${result.counts?.files ?? 0} durationMs=${durationMs}`
      );
      return res.json({
        ok: true,
        backupId: result.backupId,
        counts: result.counts,
        retention: result.retention,
        durationMs,
      });
    } catch (err) {
      const durationMs = Date.now() - started;
      error(
        `dr-backup: failed durationMs=${durationMs} errorType=${
          err instanceof Error ? err.name : 'unknown'
        }`
      );
      return res.json({ error: 'Disaster backup failed' }, 500);
    }
  };
}

export default createHandler();
