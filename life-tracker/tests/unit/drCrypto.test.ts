import { describe, expect, it } from 'vitest';
import {
  decodeMasterKey,
  decryptBuffer,
  encryptBuffer,
  sha256Hex,
} from '../../appwrite-functions/dr-backup/crypto.mjs';

describe('DR encryption envelope', () => {
  const key = Buffer.alloc(32, 7);

  it('round-trips compressed data and carries the key version', () => {
    const plain = Buffer.from('private mosaic backup payload'.repeat(50));
    const encrypted = encryptBuffer(plain, {
      key,
      keyVersion: 'v1',
      aad: 'mosaic-dr/v1/snapshots/example/users.enc',
      compress: true,
    });

    expect(encrypted.equals(plain)).toBe(false);
    const result = decryptBuffer(encrypted, {
      key,
      aad: 'mosaic-dr/v1/snapshots/example/users.enc',
    });

    expect(result.keyVersion).toBe('v1');
    expect(result.compressed).toBe(true);
    expect(result.plain.equals(plain)).toBe(true);
    expect(sha256Hex(result.plain)).toBe(sha256Hex(plain));
  });

  it('rejects substitution under a different object key', () => {
    const encrypted = encryptBuffer(Buffer.from('secret'), {
      key,
      keyVersion: 'v1',
      aad: 'original-key',
    });

    expect(() =>
      decryptBuffer(encrypted, { key, aad: 'different-key' })
    ).toThrow();
  });

  it('requires an exact 256-bit base64 master key', () => {
    expect(decodeMasterKey(Buffer.alloc(32, 1).toString('base64'))).toHaveLength(32);
    expect(() => decodeMasterKey(Buffer.alloc(31).toString('base64'))).toThrow(
      /32 bytes/
    );
    expect(() => decodeMasterKey('not-base64')).toThrow();
  });
});
