import { describe, expect, it } from 'vitest';
import { classifyAppwriteBackend, classifySupabaseBackend } from '../../src/lib/appwriteBackendIdentity';

describe('backend build identity', () => {
  it('names verified Oracle and legacy Cloud targets separately', () => {
    expect(classifyAppwriteBackend('6ae9599c002ab812f9c3', 'https://129-221-244-67.sslip.io/v1')).toBe('appwrite-oracle-production');
    expect(classifyAppwriteBackend('6ae94a2100014d01f5ed', 'https://129-221-244-67.sslip.io/v1/')).toBe('appwrite-oracle-scratch');
    expect(classifyAppwriteBackend('6a9703c50016b37110ff', 'https://sgp.cloud.appwrite.io/v1')).toBe('appwrite-cloud-production');
    expect(classifyAppwriteBackend('6a96e82d000d1310b3be', 'https://FRA.CLOUD.APPWRITE.IO/v1///')).toBe('appwrite-cloud-scratch');
  });

  it('rejects crossed, spoofed, unknown and missing targets', () => {
    const oracle = 'https://129-221-244-67.sslip.io/v1';
    const cloud = 'https://fra.cloud.appwrite.io/v1';
    expect(classifyAppwriteBackend('6ae9599c002ab812f9c3', cloud)).toBe('appwrite-custom');
    expect(classifyAppwriteBackend('6ae94a2100014d01f5ed', cloud)).toBe('appwrite-custom');
    expect(classifyAppwriteBackend('6a96e82d000d1310b3be', oracle)).toBe('appwrite-custom');
    expect(classifyAppwriteBackend('other', 'https://custom.example/v1')).toBe('appwrite-custom');
    expect(classifyAppwriteBackend('6a96e82d000d1310b3be', cloud + '.attacker.invalid')).toBe('appwrite-custom');
    expect(classifyAppwriteBackend('', oracle)).toBe('unknown');
    expect(classifyAppwriteBackend(undefined, undefined)).toBe('unknown');
  });

  it('requires verified Supabase project and URL pairs before displaying an environment', () => {
    const verified = {
      production: { projectId: 'test-prod', endpoint: 'https://prod.example.supabase.co' },
      scratch: { projectId: 'test-scratch', endpoint: 'https://scratch.example.supabase.co' },
    };
    expect(classifySupabaseBackend('test-prod', 'https://prod.example.supabase.co/', verified)).toBe('supabase-production');
    expect(classifySupabaseBackend('test-scratch', 'https://scratch.example.supabase.co', verified)).toBe('supabase-scratch');
    expect(classifySupabaseBackend('test-prod', 'https://scratch.example.supabase.co', verified)).toBe('supabase-custom');
    expect(classifySupabaseBackend('test-prod', 'https://prod.example.supabase.co', {})).toBe('supabase-custom');
    expect(classifySupabaseBackend(null, null, verified)).toBe('unknown');
  });
});
