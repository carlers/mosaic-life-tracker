import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  project: '6b00671500279e901846',
  endpoint: 'https://129-221-244-67.sslip.io/v1',
  send: vi.fn(),
}));
vi.mock('../../src/lib/appwriteConfig', () => ({
  get APPWRITE_PROJECT_ID() { return mocks.project; },
  get APPWRITE_ENDPOINT() { return mocks.endpoint; },
}));
vi.mock('../../src/lib/appAction', () => ({ sendAppAction: mocks.send }));

import { createScratchOwnerRpc } from '../../src/lib/e2ee/ownerCiphertextTransport';

const owner = { projectId: '6b00671500279e901846', ownerId: 'synthetic_owner' };

describe('M2 ciphertext-only owner RPC isolated Scratch boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.project = '6b00671500279e901846';
    mocks.endpoint = 'https://129-221-244-67.sslip.io/v1';
    mocks.send.mockResolvedValue({ ok: true });
  });

  it('permits reviewed owner ciphertext actions only on isolated Scratch', async () => {
    const rpc = createScratchOwnerRpc(owner);
    await expect(rpc.send('read_root')).resolves.toEqual({ ok: true });
    await expect(rpc.send('list', { collection: 'diary' })).resolves.toEqual({ ok: true });
    expect(mocks.send).toHaveBeenCalledWith({
      action: 'e2ee_owner_v1', operation: 'read_root',
      projectId: owner.projectId, ownerId: owner.ownerId,
    });
    expect(mocks.send).toHaveBeenCalledWith({
      action: 'e2ee_owner_v1', operation: 'list', collection: 'diary',
      projectId: owner.projectId, ownerId: owner.ownerId,
    });
    expect(mocks.send).toHaveBeenCalledTimes(2);
    await expect(rpc.send('legacy_plaintext_write')).rejects.toThrow('unavailable');
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });

  it('rejects ordinary Preview, Production, TEST and legacy Scratch aliases before any request', () => {
    for (const target of [
      '6ae94a2100014d01f5ed', // normal Preview; previously misrouted here
      '6ae9599c002ab812f9c3', // Production
      '6ae1bf2e00034572451b', // TEST
      '',
    ]) {
      mocks.project = target;
      expect(() => createScratchOwnerRpc({ ...owner, projectId: target }))
        .toThrow('unavailable');
      expect(() => createScratchOwnerRpc(owner)).toThrow('unavailable');
    }
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('rejects mismatched owner project, shared endpoint drift, and URL changes', () => {
    expect(() => createScratchOwnerRpc({
      ...owner, projectId: '6ae94a2100014d01f5ed',
    })).toThrow('unavailable');
    for (const badEndpoint of [
      'https://appwrite.io/v1',
      'http://129-221-244-67.sslip.io/v1',
      'https://129-221-244-67.sslip.io/v1/',
      '',
    ]) {
      mocks.endpoint = badEndpoint;
      expect(() => createScratchOwnerRpc(owner)).toThrow('unavailable');
    }
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
