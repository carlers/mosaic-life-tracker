import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const requireCjs = createRequire(import.meta.url);
const { ownerReferenceIndex, assessMediaLifecycle, COVERAGE_KEYS }: any =
  requireCjs('../../appwrite-functions/message-action/media-lifecycle.js');

const owner = 'actor_a';
const fileId = 'img_abc';
const emptyRows = () => ({ tasks: [], diary: [], settings: [] });
const coverage = Object.fromEntries(COVERAGE_KEYS.map((key: string) => [key, true]));
const evidence = (overrides: Record<string, unknown> = {}) => ({
  ownerId: owner, fileId,
  index: ownerReferenceIndex(owner, emptyRows()),
  file: { $id: fileId, $permissions: [
    `read("users")`, `update("user:${owner}")`, `delete("user:${owner}")`,
  ] },
  provenance: { authoritative: true, ownerId: owner, fileId },
  coverage,
  crossOwnerReferenceCount: 0,
  ...overrides,
});

describe('Phase 3 cloud media lifecycle kernel (no delete capability)', () => {
  it('deduplicates at classification, retains tombstones, and records pending local uploads', () => {
    const index = ownerReferenceIndex(owner, {
      tasks: [
        { user_id: owner, deleted: false, image: fileId },
        { user_id: owner, deleted: false, image: fileId },
        { user_id: owner, deleted: true, image: 'img_old' },
        { user_id: owner, deleted: false, image: 'localimg_staged' },
      ],
      diary: [{ user_id: owner, deleted: false, photos: JSON.stringify([fileId, 'img_diary']) }],
      settings: [{ user_id: owner, deleted: false, key: 'profileImageId', value: JSON.stringify('img_profile') }],
    });
    expect(index.references.filter((r: {fileId: string}) => r.fileId === fileId)).toHaveLength(3);
    expect(index.references).toContainEqual({fileId: 'img_old', kind: 'tasks', state: 'tombstoned'});
    expect(index.pendingUploads).toBe(1);
    expect(assessMediaLifecycle(evidence({ index })).state).toBe('live-referenced');
  });

  it('rejects cross-account row contamination without returning any file identity', () => {
    expect(() => ownerReferenceIndex(owner, {
      ...emptyRows(), tasks: [{user_id: 'other', image: 'private_photo', deleted: false}],
    })).toThrow('untrusted row');
  });

  it('protects malformed Diary JSON, invalid IDs and unknown deletion state', () => {
    const index = ownerReferenceIndex(owner, {
      ...emptyRows(),
      diary: [{user_id: owner, deleted: false, photos: '{malformed'}],
    });
    expect(index.malformed).toBe(1);
    expect(assessMediaLifecycle(evidence({index})).state).toBe('unknown-protected');
    expect(assessMediaLifecycle(evidence({fileId: 'localimg_pending'})).state).toBe('unknown-protected');
  });

  it('never authorizes deleting any referenced or tombstoned file', () => {
    for (const deleted of [false, true]) {
      const index = ownerReferenceIndex(owner, {
        ...emptyRows(), tasks: [{user_id: owner, deleted, image: fileId}],
      });
      const result = assessMediaLifecycle(evidence({index}));
      expect(result).toMatchObject({
        state: deleted ? 'pending-removal' : 'live-referenced',
        action: 'preserve', deletionAuthorized: false,
      });
    }
  });

  it('never infers ownership from friend-readable file ACLs alone', () => {
    expect(assessMediaLifecycle(evidence({provenance: null}))).toMatchObject({
      state: 'unknown-protected', reason: 'unproven-provenance',
    });
    expect(assessMediaLifecycle(evidence({file: {
      $id: fileId, $permissions: ['read("users")','update("user:other")','delete("user:other")'],
    }}))).toMatchObject({state: 'unknown-protected',reason:'ambiguous-file-grants'});
  });

  it('protects files when unknown or other-user references may exist', () => {
    expect(assessMediaLifecycle(evidence({crossOwnerReferenceCount: 1}))).toMatchObject({
      state:'shared-referenced',action:'preserve',
    });
    expect(assessMediaLifecycle(evidence({crossOwnerReferenceCount: undefined})).state)
      .toBe('unknown-protected');
    expect(assessMediaLifecycle(evidence({coverage:{...coverage, crossOwnerReferences:false}})).state)
      .toBe('unknown-protected');
  });

  it('protects pending media and incomplete owner/old-client/upload coverage', () => {
    expect(assessMediaLifecycle(evidence({pendingUpload:true})).state).toBe('pending-upload');
    expect(assessMediaLifecycle(evidence({pendingRemoval:true})).state).toBe('pending-upload');
    for (const key of COVERAGE_KEYS) {
      expect(assessMediaLifecycle(evidence({coverage:{...coverage,[key]:false}})).state)
        .toBe('unknown-protected');
    }
  });

  it('classifies a hypothetical fully evidenced unreferenced file only as a nondeletable candidate', () => {
    expect(assessMediaLifecycle(evidence())).toEqual({
      state:'orphan-candidate',reason:'requires-grace-and-server-recheck',
      action:'preserve',deletionAuthorized:false,
    });
  });

  it('refuses malformed reference proof even when the other gates report complete', () => {
    expect(assessMediaLifecycle(evidence({index: {
      ownerId:owner,malformed:0,pendingUploads:0,
      references:[{fileId:'bad/id',kind:'tasks',state:'live'}],
    }})).state).toBe('unknown-protected');
  });
});
