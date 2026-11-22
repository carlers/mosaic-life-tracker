import { describe, expect, it } from 'vitest';
import {
  assertPendingPilotCiphertext, savePendingPilotCiphertext, listPendingPilotCiphertext,
} from '../../src/lib/crypto/pilotDeviceStore';

const owner = { projectId: '6b00671500279e901846', ownerId: 'synthetic_owner' };
const valid = {
  opId: 'o_' + 'a'.repeat(32),
  rowId: 'p_' + 'b'.repeat(32),
  expectedRevision: null,
  deleted: false,
  envelope: {
    v: 1 as const, alg: 'A256GCM' as const,
    kid: 'k_' + 'c'.repeat(32), revision: 'r_' + 'd'.repeat(32),
    iv: 'AAAAAAAAAAAAAAAA', ct: 'A'.repeat(64),
  },
};

describe('synthetic Diary ciphertext-only immutable outbox', () => {
  it('accepts only the scoped opaque intent and authenticated ciphertext envelope', () => {
    expect(() => assertPendingPilotCiphertext(owner, valid)).not.toThrow();
    expect(() => assertPendingPilotCiphertext(owner, {
      ...valid, expectedRevision: 'r_' + 'e'.repeat(32),
      deleted: true,
    })).not.toThrow();
    for (const bad of [
      { ...valid, opId: 'unscoped' },
      { ...valid, rowId: 'plain-task-id' },
      { ...valid, expectedRevision: 'not-a-revision' },
      { ...valid, deleted: 'false' },
      { ...valid, plaintext: 'private note' },
      { ...valid, envelope: { ...valid.envelope, content: 'private note' } },
      { ...valid, envelope: { ...valid.envelope, kid: 'other-user-key' } },
      { ...valid, envelope: { ...valid.envelope, revision: 'invalid' } },
      { ...valid, envelope: { ...valid.envelope, iv: 'invalid' } },
      { ...valid, envelope: { ...valid.envelope, ct: 'x' } },
      { ...valid, envelope: { ...valid.envelope, alg: 'none' } },
    ]) {
      expect(() => assertPendingPilotCiphertext(owner, bad as never))
        .toThrow('Invalid encrypted pending write.');
    }
    expect(() => assertPendingPilotCiphertext({ ...owner, ownerId: '' }, valid))
      .toThrow();
  });

  it('denies unclassified plaintext before opening IndexedDB', async () => {
    await expect(savePendingPilotCiphertext(owner, {
      ...valid, plaintext: 'secret test note',
    } as never)).rejects.toThrow('Invalid encrypted pending write.');
    // With no IndexedDB in Node, valid intents cannot be assumed queued.
    if (typeof indexedDB === 'undefined') {
      await expect(savePendingPilotCiphertext(owner, valid))
        .rejects.toThrow('Encrypted local storage unavailable.');
      await expect(listPendingPilotCiphertext(owner))
        .rejects.toThrow('Encrypted local storage unavailable.');
    }
  });
});
