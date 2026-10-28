import { describe, expect, it } from 'vitest';
import {
  assertHostedPostRegistryCatalog, preflightHostedPostRegistry,
  checkHostedSignedRegistry, checkHostedAtomicCategory,
} from '../../supabase-poc/hosted-post-registry.mjs';

const runId = 'a'.repeat(24);
const ia = '11111111-1111-4111-8111-111111111111';
const ib = '22222222-2222-4222-8222-222222222222';
const installationId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const users = () => [
  { id: ia, email: 'mosaic-hosted-' + runId + '-a@example.org', token: 'fixture-token-alice-signed-123456' },
  { id: ib, email: 'mosaic-hosted-' + runId + '-b@example.org', token: 'fixture-token-bob-signed-12345678' },
];
const ok = data => ({ ok: true, status: 200, data });
const denied = (status = 403, code = '42501') => ({ ok: false, status, data: { code } });
const catalog = () => ({
  migrations: 21, staged: 5, release_evidence: false,
  writer_guard: false, category_retirement: true,
  category_cascade: true, task_assignment_guard: true, registry_private: true,
});

function registryFake({ release = false } = {}) {
  const [a, b] = users();
  const states = new Map([[a.token, 'unconfirmed'], [b.token, 'unconfirmed']]);
  let metadataCalls = 0;
  const mapping = token => {
    const user = token === a.token ? a : b;
    const state = states.get(token);
    return {
      version: 1, provider: 'supabase-cloud', providerUserId: user.id,
      mosaicAccountId: 'sb_' + user.id.replaceAll('-', ''),
      installationId, mappingVersion: 1, provenance: 'server-enrolled',
      historyState: state, consentVersion: state === 'unconfirmed' ? null : 1,
    };
  };
  const api = async (path, args = {}) => {
    const token = args.token;
    if (['mosaic_accounts','provider_accounts','identity_audit','identity_installation']
      .some(name => path === '/rest/v1/' + name + '?select=*'))
      return denied(404, 'PGRST106');
    if (path === '/auth/v1/user' && args.method === 'PUT') {
      metadataCalls++;
      return ok({ id: ia });
    }
    if (!states.has(token)) return denied(401);
    if (path === '/rest/v1/rpc/mosaic_account_status') {
      const body = args.body;
      if (Object.hasOwn(body, 'p_owner_id')) return denied(404, 'PGRST202');
      const start = body.p_start_mode;
      if (start && !['fresh','recovery-pending'].includes(start)) return denied(400, '22023');
      const before = states.get(token);
      if (start && start !== before) {
        if (before !== 'unconfirmed' && !(before === 'fresh' && start === 'recovery-pending'))
          return denied();
        states.set(token, start);
      }
      return ok(mapping(token));
    }
    if (path === '/rest/v1/rpc/mosaic_personal_readiness') {
      if (states.get(token) === 'unconfirmed') return denied();
      return ok({ ...mapping(token), personalReady: release });
    }
    throw new Error('Unexpected mock API path');
  };
  return { api, metadataCalls: () => metadataCalls, states };
}

function categoryFake({ cascade = true, allowDeletedAssignment = false } = {}) {
  const [a, b] = users();
  a.category = { owner_id: ia, id: 'hc_' + runId + '_a', is_deleted: false, change_seq: '1' };
  a.task = { owner_id: ia, id: 'ht_' + runId + '_a', is_deleted: false, change_seq: '1' };
  b.category = { owner_id: ib, id: 'hc_' + runId + '_b', is_deleted: false,
    retired_on: '', change_seq: '1' };
  b.task = { owner_id: ib, id: 'ht_' + runId + '_b', is_deleted: false,
    category_id: b.category.id, change_seq: '1' };
  let category = { ...b.category };
  let task = { ...b.task };
  const rows = async (user, domain) => {
    if (user.id === ia) return [{ ...(domain === 'tasks' ? a.task : a.category) }];
    return [{ ...(domain === 'tasks' ? task : category) }];
  };
  const cas = async (user, domain, row, patch) => {
    if (user.id === ia) return ok(null);
    if (domain !== 'category' || row.id !== b.category.id)
      throw new Error('Wrong disposable category operation');
    if (patch.retired_on !== undefined) {
      category = { ...category, retired_on: patch.retired_on, change_seq: '2' };
      return ok({ ...category });
    }
    if (patch.is_deleted === true) {
      category = { ...category, is_deleted: true, change_seq: '3' };
      if (cascade) task = { ...task, is_deleted: true, change_seq: '4' };
      return ok({ ...category });
    }
    if (patch.is_deleted === false) return denied(400, '23514');
    throw new Error('Unknown CAS patch');
  };
  const api = async path => {
    if (path === '/rest/v1/mosaic_candidate_tasks')
      return allowDeletedAssignment ? ok([{ id: 'invalid' }]) : denied(409, '23503');
    throw new Error('Unexpected mock assignment path');
  };
  return { api, rows, cas, users: [a, b] };
}

describe('current hosted 21-migration signed post-registry release gate', () => {
  it('preflights the EXACT installed schema and missing release fence before fixtures', async () => {
    expect(assertHostedPostRegistryCatalog([catalog()])).toBe(true);
    let observed = '';
    const client = { sql: async query => { observed = query; return [catalog()]; } };
    await expect(preflightHostedPostRegistry(client)).resolves.toBe(true);
    expect(observed).toContain('20261028070024');
    expect(observed).toContain('personal_release_evidence IS NOT NULL');
    expect(observed).toContain('mosaic_candidate_category_task_tombstone');
    for (const bad of [
      { migrations: 20 }, { staged: 4 }, { release_evidence: true },
      { writer_guard: true }, { registry_private: false },
      { category_cascade: false }, { category_retirement: false },
      { task_assignment_guard: false },
    ]) {
      expect(() => assertHostedPostRegistryCatalog([{ ...catalog(), ...bad }]))
        .toThrow('refuse disposable fixtures');
    }
  });

  it('requires separate signed server mappings, resists metadata spoofing and refuses release', async () => {
    const fake = registryFake();
    const result = await checkHostedSignedRegistry({ api: fake.api, runId, users: users() });
    expect(result.registryOwners).toBe(2);
    expect(result.consentedFixtureOwners).toBe(2);
    expect(result.releaseNotActivated).toBe(true);
    expect(fake.metadataCalls()).toBe(1);
    expect([...fake.states.values()]).toEqual(['recovery-pending','fresh']);
  });

  it('rejects a forged ready installation, wrong fixture user and missing actual consent', async () => {
    const fake = registryFake({ release: true });
    await expect(checkHostedSignedRegistry({ api: fake.api, runId, users: users() }))
      .rejects.toThrow('Unreleased installation');
    const owner = users();
    owner[1].email = 'someone-else@example.org';
    await expect(checkHostedSignedRegistry({ api: fake.api, runId, users: owner }))
      .rejects.toThrow('run-marked disposable owners');
  });

  it('proves category retirement is not deletion and atomic cascade blocks resurrection', async () => {
    const fake = categoryFake();
    const result = await checkHostedAtomicCategory({ ...fake, runId });
    expect(result).toMatchObject({
      retiredMetadataPreserved: true, atomicCascade: true,
      deletedAssignmentDenied: true, crossOwnerUnchanged: true,
    });
  });

  it('refuses an incomplete cascade or a new assignment to a deleted category', async () => {
    await expect(checkHostedAtomicCategory({ ...categoryFake({cascade:false}), runId }))
      .rejects.toThrow('cascade task tombstone');
    await expect(checkHostedAtomicCategory({
      ...categoryFake({allowDeletedAssignment:true}), runId,
    })).rejects.toThrow('Deleted-category assignment');
  });
});
