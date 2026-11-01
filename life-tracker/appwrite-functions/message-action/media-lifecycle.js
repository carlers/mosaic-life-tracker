'use strict';

// Phase 3 policy kernel ONLY. This module performs no Appwrite calls or mutations.
// A separate, explicitly approved server-owned worker must verify every prerequisite
// again at deletion time; no decision returned here authorizes deletion.
const FILE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;
const KINDS = new Set(['tasks', 'diary', 'profile']);
const COVERAGE_KEYS = Object.freeze([
  'ownerRows',
  'allReferences',
  'crossOwnerReferences',
  'fileRegistry',
  'pendingOperations',
  'offlineClients',
]);

function remoteId(value) {
  return typeof value === 'string' && FILE_ID.test(value) &&
    !value.startsWith('localimg_');
}

function ownerReferenceIndex(ownerId, tables) {
  if (typeof ownerId !== 'string' || !ownerId || !tables ||
    !['tasks', 'diary', 'settings'].every((name) => Array.isArray(tables[name]))) {
    throw new Error('Complete owner table inputs are required');
  }
  const references = [];
  let malformed = 0;
  let pendingUploads = 0;
  const add = (value, kind, deleted) => {
    if (value === null || value === undefined || value === '') return;
    if (typeof value === 'string' && value.startsWith('localimg_')) {
      pendingUploads++;
      return;
    }
    if (!remoteId(value)) {
      malformed++;
      return;
    }
    references.push({ fileId: value, kind, state: deleted ? 'tombstoned' : 'live' });
  };
  for (const name of ['tasks', 'diary', 'settings']) {
    for (const row of tables[name]) {
      if (!row || row.user_id !=¶»§q«^