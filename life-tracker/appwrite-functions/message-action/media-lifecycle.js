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
      if (!row || row.user_id !== ownerId) {
        throw new Error('Owner table contains an untrusted row');
      }
      if (typeof row.deleted !== 'boolean') {
        malformed++;
      }
      const deleted = row.deleted !== false;
      if (name === 'tasks') {
        add(row.image, 'tasks', deleted);
      } else if (name === 'diary') {
        if (row.photos == null || row.photos === '') continue;
        let photos;
        try { photos = JSON.parse(row.photos); } catch { malformed++; continue; }
        if (!Array.isArray(photos) || photos.length > 5 ||
          new Set(photos).size !== photos.length ||
          photos.some((id) => typeof id !== 'string')) {
          malformed++;
          continue;
        }
        for (const id of photos) add(id, 'diary', deleted);
      } else if (row.key === 'profileImageId') {
        let imageId = row.value;
        if (typeof imageId === 'string') {
          try {
            const parsed = JSON.parse(imageId);
            if (typeof parsed === 'string' || parsed === null) imageId = parsed;
            else { malformed++; continue; }
          } catch { /* Legacy plain file ID. */ }
        }
        add(imageId, 'profile', deleted);
      }
    }
  }
  return { ownerId, references, malformed, pendingUploads };
}

function assessMediaLifecycle(evidence) {
  const protect = (state, reason) => ({ state, reason, action: 'preserve', deletionAuthorized: false });
  if (!evidence || !remoteId(evidence.fileId) ||
    typeof evidence.ownerId !== 'string' || !evidence.ownerId) {
    return protect('unknown-protected', 'invalid-identity');
  }
  const { ownerId, fileId, index, file, provenance, coverage } = evidence;
  if (!index || index.ownerId !== ownerId || !Array.isArray(index.references)) {
    return protect('unknown-protected', 'missing-owner-index');
  }
  if (index.references.some((ref) => !ref || !remoteId(ref.fileId) ||
    !KINDS.has(ref.kind) || !['live', 'tombstoned'].includes(ref.state))) {
    return protect('unknown-protected', 'malformed-reference-index');
  }
  const refs = index.references.filter((ref) => ref.fileId === fileId);
  if (refs.some((ref) => ref.state === 'live')) {
    return protect('live-referenced', 'live-owner-reference');
  }
  if (refs.some((ref) => ref.state === 'tombstoned')) {
    return protect('pending-removal', 'tombstone-may-replay');
  }
  if (evidence.pendingUpload === true || evidence.pendingRemoval === true ||
    Number(index.pendingUploads) > 0) {
    return protect('pending-upload', 'unsettled-media-operation');
  }
  if (typeof evidence.crossOwnerReferenceCount === 'number' &&
    evidence.crossOwnerReferenceCount > 0) {
    return protect('shared-referenced', 'other-owner-reference');
  }
  if (index.malformed !== 0 || evidence.crossOwnerReferenceCount !== 0) {
    return protect('unknown-protected', 'unclassified-references');
  }
  if (!file || file.$id !== fileId || !Array.isArray(file.$permissions)) {
    return protect('unknown-protected', 'missing-file-metadata');
  }
  const update = `update("user:${ownerId}")`;
  const del = `delete("user:${ownerId}")`;
  if (!file.$permissions.includes(update) || !file.$permissions.includes(del) ||
    file.$permissions.some((permission) =>
      /^(update|delete)\(/.test(permission) && permission !== update && permission !== del)) {
    return protect('unknown-protected', 'ambiguous-file-grants');
  }
  // ACL control is NOT proof of upload provenance. The owner index must be
  // independently and durably maintained by trusted backend code.
  if (!provenance || provenance.authoritative !== true ||
    provenance.ownerId !== ownerId || provenance.fileId !== fileId) {
    return protect('unknown-protected', 'unproven-provenance');
  }
  if (!coverage || !COVERAGE_KEYS.every((key) => coverage[key] === true)) {
    return protect('unknown-protected', 'incomplete-server-coverage');
  }
  // Candidate != safe to delete: no grace/lease, CAS, old-PWA replay, or
  // worker recheck protocol exists yet. This never gives deletion permission.
  return protect('orphan-candidate', 'requires-grace-and-server-recheck');
}

module.exports = { ownerReferenceIndex, assessMediaLifecycle, COVERAGE_KEYS };
