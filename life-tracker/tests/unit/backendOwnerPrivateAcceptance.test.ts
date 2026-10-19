import { describe, expect, it } from 'vitest';
import {
  OWNER_PRIVATE_ACCEPTANCE_DOMAINS, runOwnerPrivateProviderAcceptance,
} from '../provider/ownerPrivateAcceptance.mjs';

const principals = {
  a: { id: '11111111-1111-4111-8111-111111111111' },
  b: { id: '22222222-2222-4222-8222-222222222222' },
};
function createFixtureRows() {
  return Object.fromEntries(['a', 'b'].map(label => {
    const owner_id = principals[label as 'a' | 'b'].id;
    return [label, {
      categories: [
        { owner_id, id: 'category_' + label, name: 'initial', is_deleted: false },
        { owner_id, id: 'category_old_' + label, name: 'old', is_deleted: true },
      ],
    }];
  }));
}
function memoryAdapter(options: { leak?: boolean; ignoreRevision?: boolean; unsafeRevision?: boolean; reverseCursor?: boolean; dropTombstone?: boolean } = {}) {
  const rows = new Map<string, Record<string, unknown>>();
  let revision = 0;
  return {
    async create(_domain: string, principal: { id: string }, row: Record<string, unknown>) {
      if (principal.id !== row.owner_id) throw new Error('owner mismatch');
      revision += 1;
      const value = { ...row, change_seq: options.unsafeRevision ? Number.MAX_SAFE_INTEGER + 1 : String(revision) };
      rows.set(principal.id + ':' + row.id, value);
      return { ...value };
    },
    async read(_domain: string, principal: { id: string }, ownerId: string) {
      return [...rows.values()].filter(row => row.owner_id === ownerId &&
        (options.leak || row.owner_id === principal.id)).map(row => ({ ...row }));
    },
    async forgedInsert() { return 'denied'; },
    async anonRead() { return 'denied'; },
    async anonCas() { return 'denied'; },
    async directWrite() { return 'denied'; },
    async cas(_domain: string, principal: { id: string }, id: string,
      expectedRevision: string, patch: Record<string, unknown>) {
      const key = principal.id + ':' + id;
      const existing = rows.get(key);
      if (!existing || (!options.ignoreRevision && existing.change_seq !== expectedRevision))
        return { state: 'conflict' as const };
      revision += 1;
      const value = { ...existing, ...patch, change_seq: String(revision) };
      rows.set(key, value);
      return { state: 'applied' as const, row: { ...value } };
    },
    async changes(_domain: string, principal: { id: string }, after: string) {
      const selected = [...rows.values()].filter(row => row.owner_id === principal.id &&
        BigInt(row.change_seq as string) > BigInt(after) &&
        (!options.dropTombstone || row.is_deleted !== true))
        .sort((a, b) => Number(BigInt(a.change_seq as string) - BigInt(b.change_seq as string)));
      if (options.reverseCursor) selected.reverse();
      return selected.map(row => ({ ...row }));
    },
  };
}

describe('portable signed-provider acceptance contract (#967/#975)', () => {
  it('rejects unsupported domains rather than granting six unimplemented parity passes', async () => {
    expect(OWNER_PRIVATE_ACCEPTANCE_DOMAINS).toEqual(['categories', 'tasks']);
    for (const domain of ['diary', 'settings', 'friendships', 'messages', 'bucketList', 'bucketTaskLinks']) {
      await expect(runOwnerPrivateProviderAcceptance({
        domain, principals, fixtures: createFixtureRows(), adapter: memoryAdapter(),
      })).rejects.toThrow('lacks a reviewed signed private-owner backend contract');
    }
  });

  it('accepts private-owner semantics with active/tombstone replay and stale CAS', async () => {
    const result = await runOwnerPrivateProviderAcceptance({
      domain: 'categories', principals,
      fixtures: createFixtureRows(),
      adapter: memoryAdapter(),
    });
    expect(result).toEqual({
      domain: 'categories', signedOwners: 2, recordsCreated: 4, checks: 15,
    });
  });

  it('fails closed if an otherwise functional adapter leaks cross-owner reads', async () => {
    await expect(runOwnerPrivateProviderAcceptance({
      domain: 'categories', principals,
      fixtures: createFixtureRows(), adapter: memoryAdapter({ leak: true }),
    })).rejects.toThrow('cross-owner signed read leaked');
  });

  it('rejects an unsafe numeric int8 revision instead of silently rounding a cursor', async () => {
    await expect(runOwnerPrivateProviderAcceptance({
      domain: 'categories', principals,
      fixtures: createFixtureRows(), adapter: memoryAdapter({ unsafeRevision: true }),
    })).rejects.toThrow('unsafe numeric provider revision');
  });

  it('rejects an out-of-order cursor page even when all rows belong to the right owner', async () => {
    await expect(runOwnerPrivateProviderAcceptance({
      domain: 'categories', principals,
      fixtures: createFixtureRows(), adapter: memoryAdapter({ reverseCursor: true }),
    })).rejects.toThrow('cursor was duplicate, unordered, or stale');
  });

  it('detects a missing tombstone during incremental replay', async () => {
    await expect(runOwnerPrivateProviderAcceptance({
      domain: 'categories', principals,
      fixtures: createFixtureRows(), adapter: memoryAdapter({ dropTombstone: true }),
    })).rejects.toThrow('incremental replay lost the tombstone');
  });

  it('fails closed if a provider ignores the expected CAS revision', async () => {
    await expect(runOwnerPrivateProviderAcceptance({
      domain: 'categories', principals,
      fixtures: createFixtureRows(), adapter: memoryAdapter({ ignoreRevision: true }),
    })).rejects.toThrow('stale signed CAS');
  });
});
