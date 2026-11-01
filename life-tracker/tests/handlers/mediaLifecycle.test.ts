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
      setting¶»§q«^