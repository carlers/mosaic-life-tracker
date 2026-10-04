import { runBackup as defaultRunBackup } from './backup.mjs';
import { recordPrivacyDeletion as defaultRecordPrivacyDeletion } from './privacy-deletion.mjs';

function isAuthorized(req) {
  const trigger = req?.headers?.['x-appwrite-trigger'] || '';
  if (trigger === 'schedule') return true;
  return (
    trigger === 'http' &&
    process.env.DR_ALLOW_MANUAL_EXECUTION === 'true' &&
    Boolean(req?.headers?.['x-appwrite-key'])
  );
}

function safeFailureDetails(err) {
  const message = err instanceof Error ? err.message : '';
  let stage =
    err && typeof err === 'object' && typeof err.backupStage === 'string'
      ? err.backupStage
      : 'unknown';
  let code = 'unknown';

  if (/DR encryption key/i.test(message)) {
    stage = 'config';
    code = 'config_encryption_key';
  } else if (/Missing required DR variable|Invalid DR numeric variable/i.test(message)) {
    stage = 'config';
    code = 'config_missing_or_invalid';
  } else if (/Invalid R2 endpoint|Missing R2 configuration/i.test(message)) {
    stage = 'config';
    code = 'config_r2';
  } else {
    const r2Http = message.match(
      /^R2 (?:GET|PUT|HEAD|DELETE) failed with HTTP (\d{3})(?: code=([A-Za-z0-9._-]+))?/
    );
    if (r2Http) {
      const s3Code = r2Http[2] || '';
      const knownCodes = {
        AccessDenied: 'r2_access_denied',
        SignatureDoesNotMatch: 'r2_signature_mismatch',
        ExpiredRequest: 'r2_expired_request',
        NotEntitled: 'r2_not_entitled',
        Unauthorized: 'r2_unauthorized',
        NoSuchBucket: 'r2_no_such_bucket',
      };
      code = knownCodes[s3Code] || `r2_http_${r2Http[1]}`;
    } else if (
      /R2 verification failed|DR blob hash metadata mismatch/i.test(message)
    ) {
      code = 'r2_verification';
    } else if (/Missing Appwrite execution key/i.test(message)) {
      code = 'appwrite_key';
    } else if (/Appwrite pagination stalled/i.test(message)) {
      code = 'appwrite_pagination';
    } else {
      const appwriteHttpCode =
        err &&
        typeof err === 'object' &&
        Number.isInteger(Number(err.code)) &&
        Number(err.code) >= 400 &&
        Number(err.code) <= 599
          ? Number(err.code)
          : null;
      if (appwriteHttpCode) code = `appwrite_http_${appwriteHttpCode}`;
    }
  }

  return { stage, code };
}

export function createHandler({
  runBackup = defaultRunBackup,
  recordPrivacyDeletion = defaultRecordPrivacyDeletion,
} = {}) {
  return async ({ req, res, log, error }) => {
    let payload = {};
    try {
      payload =
        typeof req?.body === 'string' && req.body
          ? JSON.parse(req.body)
          : req?.body || {};
    } catch {
      return res.json({ error: 'Bad Request' }, 400);
    }

    if (payload?.action === 'record_privacy_deletion') {
      if (!req?.headers?.['x-appwrite-key']) {
        error('dr-backup: rejected privacy marker without server key');
        return res.json({ error: 'Forbidden' }, 403);
      }
      const started = Date.now();
      try {
        await recordPrivacyDeletion(payload.userId);
        log(
          `dr-backup: privacy deletion marker persisted durationMs=${Date.now() - started}`
        );
        return res.json({ ok: true }, 200);
      } catch (err) {
        const failure = safeFailureDetails(err);
        error(
          `dr-backup: privacy marker failed stage=${failure.stage} code=${failure.code}`
        );
        return res.json(
          {
            error: 'Privacy deletion marker failed',
            stage: failure.stage,
            code: failure.code,
          },
          500
        );
      }
    }

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
      const failure = safeFailureDetails(err);
      error(
        `dr-backup: failed durationMs=${durationMs} stage=${failure.stage} code=${failure.code}`
      );
      return res.json(
        {
          error: 'Disaster backup failed',
          stage: failure.stage,
          code: failure.code,
        },
        500
      );
    }
  };
}

export default createHandler();
