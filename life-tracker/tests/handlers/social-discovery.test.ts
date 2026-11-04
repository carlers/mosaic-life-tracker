import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { invoke, makeMockDb } from '../helpers/invoke-handler';

const fid = (a: string, b: string) => 'fr_' +
  createHash('sha256').update(a + '|' + b).digest('hex').slice(0, 32);
const cid = (id: string) => 'disc_' +
  createHash('sha256').update(id).digest('hex').slice(0, 30);
const missing = () => Promise.reject(Object.assign(new Error('missing'), { code: 404 }));
const link = (a: string, b: string, status = 'accepted') => ({
  $id: fid(a, b), user_id: a, friend_id: b, status, deleted: false,
});
const control = (id: string, allowBrowse = false, allowAppear = false) => ({
  $id: cid(id), user_id: id, allow_browse: allowBrowse, allow_appear: allowAppear,
  updated_at: '2026-11-04T00:00:00.000Z',
});
function graph(options: { browse?: boolean; appear?: boolean; blocked?: boolean; profileDeleted?: boolean; mutual?: boolean; soloB?: boolean; soloC?: boolean } = {}) {
  const db = makeMockDb();
  const rows = [
    link('alice','bob'), link('bob','alice'),
    link('bob','charlie'), link('charlie','bob'),
  ];
  if (options.blocked) rows.push(link('alice','charlie','blocked'));
  if (options.mutual) rows.push(link('alice','charlie'), link('charlie','alice'));
  const keyed = new Map<string, any>(rows.map(r => [r.$id, r]));
  const controls = [
    control('bob', options.browse !== false),
    control('charlie', false, options.appear !== false),
  ];
  for (const item of controls) keyed.set(item.$id, item);
  if (options.soloB) keyed.set('bob_personalSoloMode', { user_id: 'bob', key: 'personalSoloMode', value: 'true', deleted: false });
  if (options.soloC) keyed.set('charlie_personalSoloMode', { user_id: 'charlie', key: 'personalSoloMode', value: 'true', deleted: false });
  keyed.set('profile_charlie', { user_id: 'charlie', username: 'charlie',
    display_name: 'Charlie', avatar_file_id: '', bio: '',
    deleted: options.profileDeleted === true, is_searchable: true,
  });
  db.getRow.mockImplementation(({ rowId }: any) => keyed.has(rowId)
    ? Promise.resolve(keyed.get(rowId)) : missing());
  db.listRows.mockResolvedValue({ rows: [link('bob','charlie')] });
  return db;
}

const previousFlag = process.env.MOSAIC_SOCIAL_DISCOVERY_ENABLED;
const previousSecret = process.env.MOSAIC_SOCIAL_DISCOVERY_CURSOR_SECRET;
beforeEach(() => {
  process.env.MOSAIC_SOCIAL_DISCOVERY_ENABLED = 'true';
  process.env.MOSAIC_SOCIAL_DISCOVERY_CURSOR_SECRET = 'synthetic-key-32-bytes-minimum-not-for-prod';
});
afterEach(() => {
  if (previousFlag === undefined) delete process.env.MOSAIC_SOCIAL_DISCOVERY_ENABLED;
  else process.env.MOSAIC_SOCIAL_DISCOVERY_ENABLED = previousFlag;
  if (previousSecret === undefined) delete process.env.MOSAIC_SOCIAL_DISCOVERY_CURSOR_SECRET;
  else process.env.MOSAIC_SOCIAL_DISCOVERY_CURSOR_SECRET = previousSecret;
});
describe('private friends-of-friends discovery', () => {
  it('returns only eligible projected profiles, not friendship edges', async () => {
    const db = graph();
    const result = await invoke({ userId: 'alice', mockDb: db,
      body: { action: 'list_friend_connections', viaFriendId: 'bob' } });
    expect(result.status).toBe(200);
    expect(result.body.items).toEqual([{
      user_id: 'charlie', username: 'charlie', display_name: 'Charlie',
      avatar_file_id: '', relationship: 'none',
    }]);
    expect(JSON.stringify(result.body)).not.toContain('accepted');
  });
  it.each([
    [{ browse: false }, 404],
    [{ appear: false }, 200],
    [{ blocked: true }, 200],
    [{ profileDeleted: true }, 200],
    [{ soloB: true }, 404],
    [{ soloC: true }, 200],
  ])('does not expose disallowed graph data: %j', async (options, expectedStatus) => {
    const db = graph(options);
    const result = await invoke({ userId: 'alice', mockDb: db,
      body: { action: 'list_friend_connections', viaFriendId: 'bob' } });
    expect(result.status).toBe(expectedStatus);
    if (expectedStatus === 200) expect(result.body.items).toEqual([]);
  });
  it('includes already accepted friends when browsing, but excludes them from suggestions', async () => {
    const db = graph({ mutual: true });
    const browsing = await invoke({ userId: 'alice', mockDb: db,
      body: { action: 'list_friend_connections', viaFriendId: 'bob' } });
    expect(browsing.status).toBe(200);
    expect(browsing.body.items[0]?.relationship).toBe('friends');
    const suggested = await invoke({ userId: 'alice', mockDb: db,
      body: { action: 'list_friend_connections', viaFriendId: 'bob', suggestionsOnly: true } });
    expect(suggested.status).toBe(200);
    expect(suggested.body.items).toEqual([]);
  });
  it('requires a current reciprocally accepted A-B friendship before scanning', async () => {
    const db = graph();
    db.getRow.mockImplementation(({ rowId }: any) =>
      rowId === fid('alice','bob') ? missing() : Promise.resolve({}));
    const result = await invoke({ userId: 'alice', mockDb: db,
      body: { action: 'list_friend_connections', viaFriendId: 'bob' } });
    expect(result.status).toBe(404);
    expect(db.listRows).not.toHaveBeenCalled();
  });
  it('encrypts page cursors and binds them to the authenticated viewer', async () => {
    const db = graph();
    const result = await invoke({ userId: 'alice', mockDb: db,
      body: { action: 'list_friend_connections', viaFriendId: 'bob', limit: 1 } });
    expect(result.status).toBe(200);
    const token = result.body.nextCursor;
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    expect(decoded).not.toContain(fid('bob', 'charlie'));
    expect(decoded).not.toContain('alice');
    const rejected = await invoke({ userId: 'eve', mockDb: db,
      body: { action: 'list_friend_connections', viaFriendId: 'bob', cursor: token } });
    expect(rejected.status).toBe(400);
  });
  it('refuses untrusted cursor input and unknown callers', async () => {
    const db = graph();
    expect((await invoke({ userId: 'alice', mockDb: db, body: {
      action: 'list_friend_connections', viaFriendId: 'bob', cursor: 'fake.payload',
    } })).status).toBe(400);
    expect((await invoke({ mockDb: db, body: {
      action: 'list_friend_connections', viaFriendId: 'bob',
    } })).status).toBe(401);
  });
  it('rechecks candidate consent before returning a page', async () => {
    const db = graph();
    const original = db.getRow.getMockImplementation();
    let candidateConsentReads = 0;
    db.getRow.mockImplementation((args: any) => {
      if (args.rowId === cid('charlie') && ++candidateConsentReads > 1) {
        return Promise.resolve(control('charlie', false, false));
      }
      return original(args);
    });
    const response = await invoke({ userId: 'alice', mockDb: db,
      body: { action: 'list_friend_connections', viaFriendId: 'bob' } });
    expect(response.status).toBe(200);
    expect(response.body.items).toEqual([]);
    expect(candidateConsentReads).toBeGreaterThanOrEqual(2);
  });
  it('defaults a missing owner controls row to two disabled preferences', async () => {
    const db = graph();
    const response = await invoke({ userId: 'alice', mockDb: db,
      body: { action: 'get_social_discovery_controls' } });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, allowBrowse: false, allowAppear: false, version: '' });
  });
  it('writes only the authenticated owner row with no direct user permissions', async () => {
    const db = graph();
    const response = await invoke({ userId: 'alice', mockDb: db,
      body: { action: 'set_social_discovery_controls', field: 'allowAppear', value: true, expectedVersion: '' } });
    expect(response.status).toBe(200);
    expect(db.createRow).toHaveBeenCalledWith(expect.objectContaining({
      rowId: cid('alice'), tableId: 'social_discovery_controls', permissions: [],
      data: expect.objectContaining({ user_id: 'alice', allow_browse: false, allow_appear: true }),
    }));
  });
  it('fails closed when discovery has not been enabled on the server', async () => {
    process.env.MOSAIC_SOCIAL_DISCOVERY_ENABLED = 'false';
    const result = await invoke({ userId: 'alice', mockDb: graph(),
      body: { action: 'list_friend_connections', viaFriendId: 'bob' } });
    expect(result.status).toBe(503);
  });
});
