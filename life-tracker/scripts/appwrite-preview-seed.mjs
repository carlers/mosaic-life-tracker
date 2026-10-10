#!/usr/bin/env node
// Optional synthetic, reusable Preview accounts. Never clone production users.
import { createHash } from 'node:crypto';
import { Permission, Role } from 'node-appwrite';
import { createBootstrapServices } from './lib/mosaic-bootstrap.mjs';
import { assertConfirmedProject, parseBackendTarget } from './lib/appwrite-backend.mjs';
import { assertScratchPreviewTarget } from './appwrite-preview-prepare.mjs';

// New identities avoid colliding with older synthetic profiles whose noncanonical
// row IDs cannot be reconciled in-place due to unique profile-user indexes.
export const PREVIEW_IDENTITIES = [
  { id: 'mosaic_preview_actor_406', email: 'mosaic.preview.actor406@example.com', name: 'Scratch Actor', username: 'scratch_actor406' },
  { id: 'mosaic_preview_friend_406', email: 'mosaic.preview.friend406@example.com', name: 'Scratch Friend', username: 'scratch_friend406' },
  { id: 'mosaic_preview_other_406', email: 'mosaic.preview.other406@example.com', name: 'Scratch Other', username: 'scratch_other406' },
];

// Match the canonical reciprocal row IDs used by the server friendship handler.
function friendshipId(owner, friend) {
  return 'fr_' + createHash('sha256').update(owner + '|' + friend).digest('hex').slice(0, 32);
}

function is404(error) {
  return Number(error?.code ?? error?.status) === 404;
}

// Validate every synthetic row ID before creating accounts, so seeding never
// partially succeeds due to an Appwrite row ID longer than 36 characters.
function fixtureRowId(tableId, ownerId) {
  const prefixes = { profiles: 'profile_', categories: 'cat_', diary: 'diary_', tasks: 'task_' };
  const rowId = prefixes[tableId] + ownerId;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_]{0,35}$/.test(rowId)) {
    throw new Error('Invalid scratch fixture row ID for ' + tableId);
  }
  return rowId;
}

async function ensureUser(users, user, password) {
  try {
    const existing = await users.get({ userId: user.id });
    if (existing.email !== user.email) throw new Error('Existing fixture user identity mismatch: ' + user.id);
    return false;
  } catch (error) {
    if (!is404(error)) throw error;
  }
  await users.create({ userId: user.id, email: user.email, password, name: user.name });
  return true;
}

async function ensureRow(tablesDB, tableId, rowId, data, ownerId) {
  try {
    const existing = await tablesDB.getRow({ databaseId: 'life_tracker', tableId, rowId });
    const current = existing.data ?? existing;
    if (current.user_id !== ownerId) throw new Error('Existing fixture row owner mismatch: ' + rowId);
    return false;
  } catch (error) {
    if (!is404(error)) throw error;
  }
  await tablesDB.createRow({
    databaseId: 'life_tracker', tableId, rowId, data,
    permissions: tableId === 'friendships'
      ? [Permission.read(Role.user(ownerId))]
      : [
        Permission.read(Role.user(ownerId)),
        Permission.update(Role.user(ownerId)),
        Permission.delete(Role.user(ownerId)),
      ],
  });
  return true;
}

export async function seedPreviewFixtures({ users, tablesDB, password, log = console.log, now = new Date().toISOString() }) {
  if (typeof password !== 'string' || password.length < 12) {
    throw new Error('MOSAIC_SCRATCH_TEST_PASSWORD must have at least 12 characters.');
  }
  // Preflight all IDs before any writes to avoid partially seeded identities.
  for (const user of PREVIEW_IDENTITIES) {
    for (const tableId of ['profiles', 'categories', 'diary', 'tasks']) {
      fixtureRowId(tableId, user.id);
    }
  }
  const result = { users: 0, rows: 0 };
  for (const user of PREVIEW_IDENTITIES) {
    if (await ensureUser(users, user, password)) result.users++;
  }
  for (const user of PREVIEW_IDENTITIES) {
    const id = user.id;
    const rows = [
      ['profiles', fixtureRowId('profiles', id), { user_id: id, username: user.username, display_name: user.name, created_at: now, updated_at: now, deleted: false }],
      ['categories', fixtureRowId('categories', id), { user_id: id, name: 'Synthetic Preview', color: '#059669', order: 0, visibility: 'followers', updated_at: now, deleted: false }],
      ['diary', fixtureRowId('diary', id), { user_id: id, date: now.slice(0, 10), content: 'Synthetic preview diary', visibility: 'private', created_at: now, updated_at: now, deleted: false }],
      ['tasks', fixtureRowId('tasks', id), { user_id: id, title: 'Synthetic completion test', category_id: fixtureRowId('categories', id), date: now.slice(0, 10), created_at: now, updated_at: now, is_completed: false, visibility: 'followers', deleted: false }],
    ];
    for (const [table, rowId, data] of rows) {
      if (await ensureRow(tablesDB, table, rowId, data, id)) result.rows++;
    }
  }
  // Actor is reciprocally friends with both others; the two recipients
  // are not automatically friends with one another.
  for (const friend of PREVIEW_IDENTITIES.slice(1)) {
    for (const [user, peer] of [[PREVIEW_IDENTITIES[0], friend], [friend, PREVIEW_IDENTITIES[0]]]) {
      const data = {
        user_id: user.id, friend_id: peer.id,
        friend_username: peer.username, friend_display_name: peer.name,
        status: 'accepted', created_at: now, updated_at: now, deleted: false,
      };
      if (await ensureRow(tablesDB, 'friendships', friendshipId(user.id, peer.id), data, user.id)) result.rows++;
    }
  }
  log('Scratch synthetic fixtures ready: new users=' + result.users + ', new rows=' + result.rows);
  return result;
}

export async function runPreviewSeed({
  argv = process.argv.slice(2), env = process.env, services,
  log = console.log,
} = {}) {
  const target = parseBackendTarget(argv, env);
  assertScratchPreviewTarget(argv, target);
  assertConfirmedProject(argv, target.projectId);
  if (!env.MOSAIC_SCRATCH_TEST_PASSWORD) throw new Error('Set MOSAIC_SCRATCH_TEST_PASSWORD in the local shell; never commit or log it.');
  return seedPreviewFixtures({
    ...(services || createBootstrapServices(target)),
    password: env.MOSAIC_SCRATCH_TEST_PASSWORD, log,
  });
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  runPreviewSeed().catch(error => {
    console.error('Scratch synthetic seed failed: ' + error.message);
    process.exitCode = 1;
  });
}
