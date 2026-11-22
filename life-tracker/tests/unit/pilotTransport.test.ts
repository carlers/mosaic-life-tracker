import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('../../src/lib/appwriteConfig', () => ({
  APPWRITE_PROJECT_ID: '6b00671500279e901846',
  APPWRITE_ENDPOINT: 'https://129-221-244-67.sslip.io/v1',
}));
vi.mock('../../src/lib/appAction', () => ({ sendAppAction: mocks.send }));

import {
  assertPilotScratch, fetchPilotRoot, fetchPilotRootState, rotatePilotRecovery,
} from '../../src/lib/crypto/pilotTransport';

const owner = { projectId: '6b00671500279e901846', ownerId: 'synthetic_mfa_owner' };
const envelope = {
  v: 1 as const, alg: 'A256GCM' as const,
  kid: 'k_' + 'a'.repeat(32), iv: 'AAAAAAAAAAAAAAAA',
  ct: 'A'.repeat(64),
};
const replacement = { ...envelope, iv: 'AQEBAQEBAQEBAQEB' };

describe('isolated Scratch pilot recovery transport — owner-bound CAS', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an authoritative positive generation without exposing a recovery secret', async () => {
    mocks.send.mockResolvedValue({ ok: true, generation: 3, envelope });
    await expect(fetchPilotRootState(owner)).resolves.toEqual({ generation: 3, envelope });
    await expect(fetchPilotRoot(owner)).resolves.toEqual(envelope);
    expect(mocks.send).toHaveBeenCalledWith({
      action: 'e2ee_diary_pilot', operation: 'read_root', ownerId: owner.ownerId,
    });
  });

  it('refuses missing, invalid, and fractional recovery generations', async () => {
    for (const generation of [undefined, null, 0, -1, 2.5, '1']) {
      mocks.send.mockResolvedValue({ ok: true, generation, envelope });
      await expect(fetchPilotRootState(owner)).rejects.toThrow();
    }
    mocks.send.mockResolvedValue({ ok: false, generation: 1, envelope });
    await expect(fetchPilotRootState(owner)).rejects.toThrow();
  });

  it('replaces only the opaque recovery wrapper under generation CAS, never the root', async () => {
    mocks.send.mockResolvedValue({ ok: true, status: 'updated', generation: 2 });
    await expect(rotatePilotRecovery(owner, { generation: 1, envelope }, replacement))
      .resolves.toBeUndefined();
    expect(mocks.send).toHaveBeenCalledWith({
      action: 'e2ee_diary_pilot', operation: 'rotate_recovery', ownerId: owner.ownerId,
      expectedEnvelope: envelope, expectedGeneration: 1, envelope: replacement,
    });
    const request = JSON.stringify(mocks.send.mock.calls[0][0]);
    expect(request).not.toContain('saved-independent-key');
    expect(request).not.toContain('account-root-plaintext');
    expect(request).not.toContain('pin');
  });

  it('accepts only the exact idempotent update/duplicate acknowledgement', async () => {
    const expected = { generation: 5, envelope };
    for (const result of [
      { ok: false, status: 'updated', generation: 6 },
      { ok: true, status: 'conflict', generation: 6 },
      { ok: true, status: 'updated', generation: 5 },
      { ok: true, status: 'updated', generation: 7 },
      { ok: true, status: 'duplicate' },
    ]) {
      mocks.send.mockResolvedValue(result);
      await expect(rotatePilotRecovery(owner, expected, replacement)).rejects.toThrow();
    }
    mocks.send.mockResolvedValue({ ok: true, status: 'duplicate', generation: 6 });
    await expect(rotatePilotRecovery(owner, expected, replacement)).resolves.toBeUndefined();
  });

  it('denies wrong project scope before invoking any backend action', async () => {
    const wrong = { ...owner, projectId: '6ae94a2100014d01f5ed' };
    expect(() => assertPilotScratch(wrong)).toThrow();
    await expect(fetchPilotRootState(wrong)).rejects.toThrow();
    await expect(rotatePilotRecovery(wrong, { generation: 1, envelope }, replacement))
      .rejects.toThrow();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
