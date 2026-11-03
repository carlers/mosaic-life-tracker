import { describe, expect, it } from 'vitest';
import { classifyAppwriteBackend } from '../../src/lib/appwriteBackendIdentity';

describe('Appwrite build identity', () => {
  it('names the actual effective project and endpoint together', () => {
    expect(classifyAppwriteBackend('6ae9599c002ab812f9c3', 'https://129-221-244-67.sslip.io/v1')).toBe('production');
    expect(classifyAppwriteBackend('6a9703c50016b37110ff', 'https://sgp.cloud.appwrite.io/v1')).toBe('custom');
    expect(classifyAppwriteBackend('6ae94a2100014d01f5ed', 'https://129-221-244-67.sslip.io/v1/')).toBe('scratch');
    expect(classifyAppwriteBackend('6a96e82d000d1310b3be', 'https://fra.cloud.appwrite.io/v1/')).toBe('scratch');
  });

  it('does not mislabel crossed projects and regions as production or scratch', () => {
    expect(classifyAppwriteBackend('6ae9599c002ab812f9c3', 'https://fra.cloud.appwrite.io/v1')).toBe('custom');
    // Scratch and Production share one Oracle host but have different project IDs.
    expect(classifyAppwriteBackend('6ae94a2100014d01f5ed', 'https://129-221-244-67.sslip.io/v1')).toBe('scratch');
    expect(classifyAppwriteBackend('6a96e82d000d1310b3be', 'https://129-221-244-67.sslip.io/v1')).toBe('custom');
    expect(classifyAppwriteBackend('other', 'https://custom.example/v1')).toBe('custom');
    expect(classifyAppwriteBackend('', 'https://129-221-244-67.sslip.io/v1')).toBe('unknown');
    expect(classifyAppwriteBackend(undefined, undefined)).toBe('unknown');
  });
});
