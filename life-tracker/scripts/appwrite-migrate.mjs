#!/usr/bin/env node
import {
  assertConfirmedProject,
  createAppwriteAdminRequest,
  flagValue,
  parseBackendTarget,
} from './lib/appwrite-backend.mjs';
import { migrateAccountDeletionBackend } from './migrate-account-deletion.mjs';
import { migrateDiaryCreatedAtBackend } from './migrate-diary-created-at.mjs';

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
];

export function selectMigrations(argv = []) {
  const only = flagValue(argv, '--only');
  if (!only) return APPWRITE_MIGRATIONS;
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
  migrations = APPWRITE_MIGRATIONS,
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
