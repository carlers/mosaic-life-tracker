#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import {
  assertConfirmedProject,
  createAppwriteAdminRequest,
  flagValue,
  parseBackendTarget,
} from './lib/appwrite-backend.mjs';
import { migrateBucketTaskLinksBackend } from './migrate-bucket-task-links.mjs';
import { migrateBucketListBackend } from './migrate-bucket-list.mjs';
import { migrateAccountDeletionBackend } from './migrate-account-deletion.mjs';
import { migrateDiaryCreatedAtBackend } from './migrate-diary-created-at.mjs';
import { migrateDiaryEmojiBackend } from './migrate-diary-emoji.mjs';
import { migrateDiaryPhotosBackend } from './migrate-diary-photos.mjs';
import { migrateDiaryReactionsBackend } from './migrate-diary-reactions.mjs';
import { migrateMessageDiaryReferences } from './migrate-message-diary-references.mjs';
import { migrateMessageChatPhotos } from './migrate-message-chat-photos.mjs';
import { migrateDiaryQuotePrivacy } from './migrate-diary-quote-privacy.mjs';
import { migrateTaskImagesBucketPermissions } from './migrate-task-images-bucket-permissions.mjs';
import { migrateNotificationsBackend } from './migrate-notifications.mjs';
import { migrateNotificationRetentionIndex } from './migrate-notification-retention.mjs';
import { migratePushDetails } from './migrate-push-details.mjs';
import { migrateTaskSharesBackend } from './migrate-task-shares.mjs';
import { migrateSharePermissions } from './migrate-share-permissions.mjs';
import { migrateFriendshipTablePermissions } from './migrate-friendship-permissions.mjs';
import { migrateBugReportsBackend } from './migrate-bug-reports.mjs';

export const APPWRITE_MIGRATIONS = [
  {
    id: '001-account-deletion',
    description: 'Account deletion table and message indexes',
    run: ({ request, log }) =>
      migrateAccountDeletionBackend({ request, log }),
  },
  {
    id: '002-diary-created-at',
    description: 'Diary created_at compatibility column',
    run: ({ request, log, sleep }) =>
      migrateDiaryCreatedAtBackend({ request, log, sleep }),
  },
  {
    id: '003-task-images-bucket-permissions',
    description: 'Remove redundant bucket-wide task image read access',
    run: ({ request, log }) =>
      migrateTaskImagesBucketPermissions({ request, log }),
  },
  {
    id: '004-notifications',
    description: 'Notifications and Web Push subscription tables',
    run: ({ request, log }) =>
      migrateNotificationsBackend({ request, log }),
  },
  {
    id: '005-notification-retention',
    description: 'Index for bounded seven-day notification cleanup',
    run: ({ request, log }) =>
      migrateNotificationRetentionIndex({ request, log }),
  },
  {
    id: '006-push-details',
    description: 'Optional per-device push detail preference (default private)',
    run: ({ request, log, sleep }) => migratePushDetails({ request, log, sleep }),
  },
  {
    id: '007-task-shares',
    description: 'Server-only shared-task invitations and membership',
    run: ({ request, log }) => migrateTaskSharesBackend({ request, log }),
  },
  {
    id: '008-friendship-permissions',
    description: 'Explicit-only removal of legacy broad friendship create grant',
    run: ({ request, log }) => migrateFriendshipTablePermissions({ request, log }),
  },
  {
    id: '009-share-permissions',
    description: 'Optional collaborative title/date edit grants, off by default',
    run: ({ request, log, sleep }) => migrateSharePermissions({ request, log, sleep }),
  },
  { id: '010-bucket-list', description: 'Owner-scoped private aspirations', run: ({ request, log }) => migrateBucketListBackend({ request, log }) },
  { id: '011-bucket-task-links', description: 'Private owner-only aspiration links', run: ({ request, log }) => migrateBucketTaskLinksBackend({ request, log }) },
  { id: '012-diary-emoji', description: 'Optional diary day emoji', run: ({ request, log, sleep }) => migrateDiaryEmojiBackend({ request, log, sleep }) },
  { id: '013-diary-photos', description: 'Private diary photo references', run: ({ request, log, sleep }) => migrateDiaryPhotosBackend({ request, log, sleep }) },
  { id: '014-diary-reactions', description: 'Server-owned diary reaction ledger', run: ({ request, log }) => migrateDiaryReactionsBackend({ request, log }) },
  { id: '015-message-diary-references', description: 'Typed private message diary references', run: ({ request, log, sleep }) => migrateMessageDiaryReferences({ request, log, sleep }) },
  { id: '016-diary-quote-privacy', description: 'Durable diary quote revocation epochs and lookup index', run: ({ request, log, sleep }) => migrateDiaryQuotePrivacy({ request, log, sleep }) },
  { id: '017-message-chat-photos', description: 'Optional private chat media identifiers', run: ({ request, log, sleep }) => migrateMessageChatPhotos({ request, log, sleep }) },
  { id: '018-bug-reports', description: 'Server-only private bug report inbox', run: ({ request, log }) => migrateBugReportsBackend({ request, log }) },
];

export function selectMigrations(argv = []) {
  const only = flagValue(argv, '--only');
  // Permission tightening is intentionally opt-in even for a confirmed
  // normal migration run. Only --only 008 may authorize this security repair.
  if (!only) return APPWRITE_MIGRATIONS.filter(m => m.id !== '008-friendship-permissions');
  const selected = APPWRITE_MIGRATIONS.filter(
    (migration) => migration.id === only
  );
  if (!selected.length) {
    throw new Error(`Unknown Appwrite migration: ${only}`);
  }
  return selected;
}

export async function runAppwriteMigrations({
  request,
  migrations = selectMigrations(),
  log = () => {},
  sleep,
}) {
  const applied = [];
  for (const migration of migrations) {
    log(`${migration.id}: ${migration.description}`);
    await migration.run({
      request,
      log: (message) => log(`  ${message}`),
      sleep,
    });
    applied.push(migration.id);
  }
  return applied;
}

export async function runAppwriteMigrateCli({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = globalThis.fetch,
  log = console.log,
} = {}) {
  const target = parseBackendTarget(argv, env);
  assertConfirmedProject(argv, target.projectId);
  const { projectId: productionProjectId } = JSON.parse(
    await readFile(new URL('../appwrite.config.json', import.meta.url), 'utf8')
  );
  if (typeof productionProjectId !== 'string' || !productionProjectId) {
    throw new Error('Missing Production projectId in appwrite.config.json');
  }
  // Never let an omitted --only silently reconcile every migration on Production.
  if (target.projectId === productionProjectId && !flagValue(argv, '--only')) {
    throw new Error(
      'Production migrations require --only <migration-id>; unscoped runs are forbidden.'
    );
  }
  const migrations = selectMigrations(argv);
  const request = createAppwriteAdminRequest({ ...target, fetchImpl });
  log(
    `Reconciling ${migrations.length} Appwrite migration(s) in ${target.projectId}...`
  );
  const applied = await runAppwriteMigrations({
    request,
    migrations,
    log,
  });
  log(`Appwrite migrations reconciled: ${applied.join(', ')}`);
  return applied;
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;

if (isDirectRun) {
  runAppwriteMigrateCli().catch((cause) => {
    console.error(
      `Appwrite migration failed: ${
        cause instanceof Error ? cause.message : 'unknown error'
      }`
    );
    process.exitCode = 1;
  });
}
