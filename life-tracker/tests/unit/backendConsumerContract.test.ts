import { describe, expect, it, vi } from 'vitest';
import { subscribedTableIds } from '../../scripts/check-scratch-client-compat.mjs';
import {
  needsConsumerCompatibilityCheck,
  validateConsumerPolicy,
  parseCompatibilityArgs,
  checkPinnedConsumers,
} from '../../scripts/check-backend-consumer-compat.mjs';

const a = 'a'.repeat(40);
const b = 'b'.repeat(40);
const policy = {
  version: 1,
  consumers: [{ label: 'current baseline', sha: a }],
  legacyPendingRetirement: [{
    label: 'unretired old PWA',
    sha: b,
    requirement: 'Owner must verify device retirement in #889',
  }],
};

describe('future client/backend contract gate (#914)', () => {
  it('runs only for backend contracts, Function sources, policy or checker changes', () => {
    for (const path of [
      'life-tracker/infrastructure/mosaic-backend.mjs',
      'life-tracker/scripts/migrate-diary-emoji.mjs',
      'life-tracker/scripts/appwrite-migrate.mjs',
      'life-tracker/src/lib/syncMapping.ts',
      'life-tracker/src/db/schema.ts',
      'life-tracker/src/db/replicationIds.ts',
      'life-tracker/appwrite-functions/message-action/main.js',
      'life-tracker/config/backend-client-compatibility.json',
    ]) expect(needsConsumerCompatibilityCheck([path])).toBe(true);
    for (const path of [
      'life-tracker/src/components/home/TaskBlock.tsx',
      'life-tracker/docs/PLAN.md',
      'life-tracker/assets/diary.webp',
      'life-tracker/scripts/check-build-size.mjs',
    ]) expect(needsConsumerCompatibilityCheck([path])).toBe(false);
  });

  it('pins each supported and pending-retirement client uniquely, failing closed on bad policy', () => {
    expect(validateConsumerPolicy(policy)).toBe(policy);
    expect(() => validateConsumerPolicy({ ...policy, consumers: [] })).toThrow(/nonempty consumers/);
    expect(() => validateConsumerPolicy({
      ...policy, legacyPendingRetirement: [{ label: 'old', sha: a, requirement: 'retire' }],
    })).toThrow(/uniquely pinned/);
    expect(() => validateConsumerPolicy({
      ...policy, consumers: [{ label: 'floating', sha: 'main' }],
    })).toThrow(/uniquely pinned/);
    expect(() => validateConsumerPolicy({
      ...policy, legacyPendingRetirement: [{ label: 'old', sha: b }],
    })).toThrow(/release-blocking requirement/);
  });

  it('derives exact subscriptions from old immutable source, never a new manifest', () => {
    const readSource = vi.fn((_sha: string, path: string) => {
      expect(path).toBe('life-tracker/src/db/replicationIds.ts');
      return "export const SYNCED_COLLECTION_NAMES = ['tasks', 'diary', 'messages'] as const;";
    });
    expect(subscribedTableIds({ sha: a, readSource })).toEqual(['tasks', 'diary', 'messages']);
    expect(readSource).toHaveBeenCalledWith(a, 'life-tracker/src/db/replicationIds.ts');
  });

  it('rejects unknown, duplicate and empty historical subscriptions, never silently skipping them', () => {
    const test = (source: string) =>
      subscribedTableIds({ sha: a, readSource: () => source });
    expect(() => test("export const SYNCED_COLLECTION_NAMES = ['tasks', 'futureThing'] as const;"))
      .toThrow(/Unknown immutable subscription/);
    expect(() => test("export const SYNCED_COLLECTION_NAMES = ['tasks', 'tasks'] as const;"))
      .toThrow(/invalid immutable sync subscription list/);
    expect(() => test("export const SYNCED_COLLECTION_NAMES = [] as const;"))
      .toThrow(/invalid immutable sync subscription list/);
  });

  it('evaluates the exact declared tables and reports per-client failures without hiding remaining clients', () => {
    const subscriptions = vi.fn(({ sha }) => sha === a ? ['tasks'] : ['messages']);
    const checkSource = vi.fn(({ sha }) =>
      sha === a ? ['tasks: writer emits undeclared column'] : []);
    const secondPolicy = {
      version: 1,
      consumers: [{ label: 'old tasks', sha: a }, { label: 'old messages', sha: b }],
      legacyPendingRetirement: [],
    };
    const result = checkPinnedConsumers({
      policy: secondPolicy,
      subscriptions,
      checkSource,
      readSource: () => '',
    });
    expect(result.checked.map(item => item.tableIds)).toEqual([['tasks'], ['messages']]);
    expect(result.failures).toEqual(['old tasks: tasks: writer emits undeclared column']);
    expect(checkSource).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid CLI refs and cannot be made to skip a changed contract', () => {
    expect(parseCompatibilityArgs(['--base', 'HEAD^'])).toEqual({ base: 'HEAD^', all: false });
    expect(parseCompatibilityArgs(['--all'])).toEqual({ base: 'HEAD^', all: true });
    expect(() => parseCompatibilityArgs(['--base', '--all'])).toThrow();
    expect(() => parseCompatibilityArgs(['--base', '; rm -rf /'])).toThrow(/Invalid Git base/);
    expect(() => parseCompatibilityArgs(['--ignore-failure'])).toThrow(/Usage/);
  });
});
