import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createR2Client } from '../appwrite-functions/dr-backup/r2.mjs';
import { parseBackupJson } from '../appwrite-functions/dr-backup/backup.mjs';
import { readHealthConfig } from './dr-health.mjs';
import {
  loadCommittedSnapshot, loadPrivacyDeletedUserIds, parseJsonLines,
  preflightSnapshot, readEncryptionKeyring, scrubDeletedUserRow,
  shouldRestoreFile, stableJson,
} from './dr-restore.mjs';

export function parseAuditArgs(args) {
  if (args.length !== 4 || args[0] !== '--snapshot' || args[2] !== '--expected-source'
      || !/^\d{8}T\d{9}Z$/.test(args[1])
      || !/^[A-Za-z0-9_]{10,36}$/.test(args[3])) {
    throw new Error('Run with --snapshot <backup-id> --expected-source <Appwrite-project-id>');
  }
  return { snapshotId: args[1], source: args[3] };
}

function equalCount(actual, expected) {
  if (!Number.isSafeInteger(expected) || actual !== expected) {
    throw new Error('Encrypted archive count mismatch');
  }
}

export async function inspectSnapshot(snapshot, deleted, source, now = new Date()) {
  const m = snapshot.manifest;
  if (m.source?.projectId !== source) {
    throw new Error('Source project mismatch');
  }
  const completed = new Date(m.completedAt);
  const hours = (now - completed) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) throw new Error('Invalid archive date');

  const archivedUsers = parseJsonLines(await snapshot.readObject(m.auth.usersKey));
  equalCount(archivedUsers.length, m.counts.users);
  const excludedUsers = archivedUsers.filter(u => deleted.has(u.id)).length;

  const summary = [];
  let archivedRows = 0, retainedRows = 0, filteredRows = 0, sanitizedRows = 0;
  for (const db of m.databases || []) {
    for (const table of db.tables || []) {
      const schema = parseBackupJson((await snapshot.readObject(table.schemaKey)).toString('utf8'));
      if (schema.id !== table.id) throw new Error('Encrypted schema mismatch');
      const rows = parseJsonLines(await snapshot.readObject(table.rowsKey));
      equalCount(rows.length, table.rowCount);
      let removed = 0, scrubbed = 0;
      for (const row of rows) {
        const eligible = scrubDeletedUserRow(table.id, row, deleted);
        if (!eligible) removed++;
        else if (stableJson(eligible) !== stableJson(row)) scrubbed++;
      }
      archivedRows += rows.length;
      retainedRows += rows.length - removed;
      filteredRows += removed;
      sanitizedRows += scrubbed;
      summary.push({ table: table.id, archived: rows.length,
        retained: rows.length - removed, excluded: removed, sanitized: scrubbed });
    }
  }
  equalCount((m.databases || []).length, m.counts.databases);
  equalCount(summary.length, m.counts.tables);
  equalCount(archivedRows, m.counts.rows);
  let archivedFiles = 0, excludedFiles = 0;
  for (const bucket of m.storage || []) {
    const cfg = parseBackupJson((await snapshot.readObject(bucket.configKey)).toString('utf8'));
    if (cfg.id !== bucket.id) throw new Error('Encrypted bucket mismatch');
    const files = parseJsonLines(await snapshot.readObject(bucket.filesKey));
    equalCount(files.length, bucket.fileCount);
    archivedFiles += files.length;
    excludedFiles += files.filter(f => !shouldRestoreFile(f, deleted)).length;
  }
  equalCount((m.storage || []).length, m.counts.buckets);
  equalCount(archivedFiles, m.counts.files);
  return {
    status: 'HISTORICAL_R2_READINESS_AUDIT_PASS',
    snapshotId: m.backupId, completedAt: completed.toISOString(),
    ageHours: Math.round(hours * 100) / 100,
    meets36HourFreshness: hours <= 36,
    sourceProjectVerified: true,
    archivedUsers: archivedUsers.length,
    globalDeletionMarkers: deleted.size,
    archivedUsersExcluded: excludedUsers,
    archivedUsersRetained: archivedUsers.length - excludedUsers,
    tableCount: summary.length,
    archivedRows, retainedRows, filteredRows, sanitizedRows,
    archivedFiles, excludedFiles, retainedFiles: archivedFiles - excludedFiles,
    tables: summary.sort((a,b)=>a.table.localeCompare(b.table)),
    fullFileContentIntegrityVerified: true,
    postSnapshotSourceDeltaVerified: false,
    oldPwaServerWriterFenceVerified: false,
    readyForLiveMigration: false,
  };
}

export async function runAudit(args = process.argv.slice(2), env = process.env) {
  const { snapshotId, source } = parseAuditArgs(args);
  const required = ['R2_ACCOUNT_ID','R2_BUCKET','R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY','DR_ENCRYPTION_KEY_B64'];
  if (required.some(name => !env[name])) {
    const file = join(homedir(), '.config/mosaic/dr-recovery.env');
    if (!existsSync(file) || (statSync(file).mode & 0o077) !== 0) {
      throw new Error('Private R2 environment file missing or unsafe permissions');
    }
    process.loadEnvFile(file);
  }
  const cfg = readHealthConfig(env);
  const r2 = createR2Client(cfg.r2);
  const encryptionKeys = readEncryptionKeyring(env);
  const snapshot = await loadCommittedSnapshot({
    r2, prefix: cfg.prefix, snapshotId, encryptionKeys,
  });
  if (snapshot.manifest.source?.projectId !== source) {
    throw new Error('Archived source project mismatch');
  }
  const deleted = await loadPrivacyDeletedUserIds({
    r2, prefix: cfg.prefix, encryptionKeys,
  });
  // Download and authenticate all objects and file bytes before claiming completeness.
  await preflightSnapshot(snapshot);
  return inspectSnapshot(snapshot, deleted, source);
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  runAudit().then(result => console.log(JSON.stringify(result, null, 2))).catch(() => {
    // Never echo credentials, private identifiers, decrypted rows or raw R2 errors.
    console.error('HISTORICAL_R2_READINESS_AUDIT_FAIL: check local private config or archive');
    process.exitCode = 1;
  });
}
