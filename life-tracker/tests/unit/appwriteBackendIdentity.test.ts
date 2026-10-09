import { describe, expect, it } from 'vitest';
import { classifyAppwriteBackend } from '../../src/lib/appwriteBackendIdentity';

describe('Appwrite build identity', () => {
  it('names the actual effective project and endpoint together', () => {
    expect(classifyAppwriteBackend('6a9703c50016b37110ff', 'https://sgp.cloud.appwrite.io/v1')).toBe('production');
    expect(classifyAppwriteBackend('6a96e82d000d1310b3be', 'https://fra.cloud.appwrite.io/v1/')).toBe('scratch');
  });

  it('does not mislabel crossed projects and regions as production or scratch', () => {
    expect(classifyAppwriteBackend('6a9703c50016b37110ff', 'https://fra.cloud.appwrite.io/v1')).toBe('custom');
    expect(classifyAppwriteBackend('6a96e82d000d1310b3be', 'https://sgp.cloud.appwrite.io/v1')).toBe('custom');
    expect(classifyAppwriteBackend('other', 'https://custom.example/v1')).toBe('custom');
    expect(classifyAppwriteBackend('', 'https://sgp.cloud.appwrite.io/v1')).toBe('unknown');
    expect(classifyAppwriteBackend(undefined, undefined)).toBe('unknown');
  });
});
