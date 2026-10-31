import { describe, expect, it, vi, afterEach } from 'vitest';
import { parseChatPhotoScratchArgs, prepareChatPhotoScratch } from '../../scripts/appwrite-chat-photo-scratch-ready.mjs';
const project = '6a96e82d000d1310b3be';
const endpoint = 'https://fra.cloud.appwrite.io/v1';
const sha = 'a'.repeat(40);
const argv = ['--project', project, '--endpoint', endpoint,
  '--confirm-project', project, '--git-sha', sha];
const env = { APPWRITE_API_KEY: 'synthetic-test-only' };
afterEach(() => { process.exitCode = 0; });

describe('guarded chat photo Scratch backend activation', () => {
  it('requires the explicit verified Scratch target and matching confirmation', () => {
    expect(parseChatPhotoScratchArgs(argv, env).sha).toBe(sha);
    expect(() => parseChatPhotoScratchArgs([...argv.slice(0,4), '--git-sha', sha], env))
      .toThrow(/confirm-project/);
    expect(() => parseChatPhotoScratchArgs(
      argv.map(v => v === project ? 'production' : v), env))
      .toThrow(/Scratch|scratch/);
  });
  it('rejects an absent or nonexact SHA before any writes', async () => {
    const migrate = vi.fn();
    await expect(prepareChatPhotoScratch({
      argv, env, sourceGit: () => 'b'.repeat(40), migrate,
    })).rejects.toThrow(/HEAD/);
    expect(migrate).not.toHaveBeenCalled();
  });
  it('requires old-client compatibility before schema writes', async () => {
    const migrate = vi.fn();
    await expect(prepareChatPhotoScratch({
      argv, env, sourceGit: args => args[0] === 'rev-parse' ? sha : '',
      migrate, runCompatibility: () => { throw Error('incompatible'); },
    })).rejects.toThrow(/incompatible/);
    expect(migrate).not.toHaveBeenCalled();
  });
  it('runs checked migration/config/deploy/activation and proves active deployment', async () => {
    const calls: string[] = [];
    const functions = { get: vi.fn().mockResolvedValue({ deploymentId: 'previous' }) };
    const result = await prepareChatPhotoScratch({
      argv, env, log: vi.fn(),
      sourceGit: args => args[0] === 'rev-parse' ? sha : '',
      runCompatibility: () => { calls.push('compat'); },
      services: () => ({ functions }) as never,
      migrate: async ({ argv }: { argv: string[] }) => {
        expect(argv).toContain('016-message-chat-photos'); calls.push('migrate');
      },
      configureDeployActivate: async ({ argv }: { argv: string[] }) => {
        calls.push(argv[0]);
        return argv[0] === 'deploy' ? { deploymentId: 'reviewed' } : {};
      },
      ready: async () => { calls.push('ready'); return { diffs: [] }; },
    });
    expect(result.deploymentId).toBe('reviewed');
    expect(calls).toEqual(['compat','migrate','configure','ready','deploy','activate','ready']);
  });
});
