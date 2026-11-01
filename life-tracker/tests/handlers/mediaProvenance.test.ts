import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import { invoke, makeMockDb, makeMockStorage } from '../helpers/invoke-handler';

const req = createRequire(import.meta.url);
const { reserveMediaUpload, confirmMediaUpload, RESERVATION_MS } =
  req('../../appwrite-functions/message-action/media-provenance.js');

const owner = 'synthetic_owner', stranger = 'synthetic_stranger', now = 1_784_000_000_000;
const id = 'img_' + 'a'.repeat(32);
const validFile = {
  $id: id, $createdAt: new Date(now + 1000).toISOString(),
  sizeOriginal: 167, mimeType: 'image/webp',
  $permissions: ['read("users")', `update("user:${owner}")`, `delete("user:${owner}")`],
};
const row = {
  $id: id, file_id: id, owner_id: owner, purpose: 'tasks', status: 'reserved',
  reserved_at: new Date(now).toISOString(), expires_at: new Date(now + RESERVATION_MS).toISOString(),
};

describe('server-minted media upload provenance (no physical deletion)', () => {
  it('mints a non-client-controlled owner-scoped opaque reservation with no permissions', async () => {
    const db = makeMockDb();
    const r = await reserveMediaUpload({ db, callerId: owner, purpose: 'tasks', now });
    expect(r.status).toBe(200);
    expect(r.body.fileId).toMatch(/^img_[0-9a-f]{32}$/);
    expect(r.body.deletionAuthorized).toBe(false);
    const args = db.createRow.mock.calls[0][0];
    expect(args.tableId).toBe('media_uploads');
    expect(args.permissions).toEqual([]);
    expect(args.ro¶»§q«^