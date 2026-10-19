import { describe, expect, it, vi } from 'vitest';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';
import type { CandidateIdentity, CandidateCategoryRow, CandidateTaskRow } from '../../supabase-poc/candidateMapping';
import { createCandidateCreateTransport } from '../../supabase-poc/candidateCreateTransport';
import { CandidateAuthError, CandidateHttpError } from '../../supabase-poc/candidateHttpTransport';

const alice: CandidateIdentity = {
  legacyUserId: 'legacy_alice',
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const bob = '22222222-2222-4222-8222-222222222222';
const session = { userId: alice.supabaseUserId, sessionEpoch: 2, accessToken: 'signed_auth_token' };
const category: CategoryDocument = {
  id: 'category_1', userId: 'legacy_alice', name: 'Personal', color: '#123456',
  order: 3, visibility: 'private', icon: undefined, updatedAt: '2026-10-19', isDeleted: false,
};
const row: CandidateCategoryRow = {
  owner_id: alice.supabaseUserId, id: category.id, name: category.name,
  color: category.color, order_index: category.order, visibility: category.visibility,
  icon: null, updated_at: category.updatedAt, is_deleted: false,
  change_seq: '9007199254740993', server_updated_at: '2026-10-19T00:00:00Z',
};
const task: TaskDocument = {
  id: 'task_1', userId: alice.legacyUserId, title: 'Hello', completed: false,
  categoryId: category.id, order: 0, tags: undefined, date: '2026-10-19',
  memo: undefined, image: undefined, createdAt: '2026-10-18',
  completedAt: undefined, updatedAt: '2026-10-19', source: undefined,
  routineId: undefined, reminderTime: undefined, reactions: undefined,
  visibility: 'private', isDeleted: false,
};
const taskRow: CandidateTaskRow = {
  owner_id: alice.supabaseUserId, id: task.id, title: task.title, completed: false,
  category_id: category.id, order_index: 0, tags: null, task_date: task.date,
  memo: null, image: null, created_at: task.createdAt, completed_at: null,
  updated_at: task.updatedAt, source: null, routine_id: null, reminder_time: null,
  reactions: null, visibility: task.visibility, is_deleted: false,
  change_seq: '2', server_updated_at: 'now',
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
function setup(responses: Response[]) {
  const fetcher = vi.fn(async () => responses.shift() ?? json(null, 503));
  const getVerifiedSession = vi.fn().mockResolvedValue(session);
  return {
    fetcher, getVerifiedSession,
    transport: createCandidateCreateTransport({
      baseUrl: 'https://candidate.example', publishableKey: 'sb_publishable_testonly',
      session: { getVerifiedSession }, fetcher: fetcher as typeof fetch,
    }),
  };
}

describe('Supabase candidate new-row/master transport (#967, mock HTTP)', () => {
  it('creates owner-only category without client-owned revision or upsert', async () => {
    const { transport, fetcher } = setup([json([row], 201)]);
    expect(await transport.createCategory(category, alice)).toEqual({
      state: 'created', row, revision: '9007199254740993',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://candidate.example/rest/v1/mosaic_candidate_categories');
    expect(init).toMatchObject({
      method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store',
      headers: {
        apikey: 'sb_publishable_testonly', Authorization: 'Bearer signed_auth_token',
        Prefer: 'return=representation', 'Content-Type': 'application/json',
      },
    });
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      owner_id: alice.supabaseUserId, id: 'category_1', order_index: 3,
    });
    expect(body).not.toHaveProperty('change_seq');
    expect(body).not.toHaveProperty('server_updated_at');
    expect(init.headers).not.toHaveProperty('resolution');
  });

  it('reads current owner master on a duplicate create, without retrying POST', async () => {
    const { transport, fetcher } = setup([json({ code: '23505' }, 409), json([row])]);
    expect(await transport.createCategory(category, alice)).toEqual({
      state: 'conflict', row, revision: '9007199254740993',
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    const [getUrl, init] = fetcher.mock.calls[1] as unknown as [string, RequestInit];
    expect(init.method).toBe('GET');
    const url = new URL(getUrl);
    expect(url.pathname).toBe('/rest/v1/mosaic_candidate_categories');
    expect(url.searchParams.get('id')).toBe('eq.category_1');
    expect(url.searchParams.get('owner_id')).toBe('eq.' + alice.supabaseUserId);
  });

  it('returns null for absent master, but rejects 409 without a visible master', async () => {
    const result = setup([json([])]);
    expect(await result.transport.readTaskMaster(task.id, alice)).toBeNull();
    await expect(setup([json(null, 409), json([])]).transport.createTask(task, alice))
      .rejects.toThrow('without accessible owner master');
  });

  it('creates task and refuses foreign, invalid, unsafe or forged authoritative rows', async () => {
    const { transport } = setup([json([taskRow], 201)]);
    await expect(transport.createTask(task, alice)).resolves.toMatchObject({
      state: 'created', revision: '2',
    });
    for (const bad of [
      { ...row, owner_id: bob }, { ...row, id: 'category_2' },
      { ...row, change_seq: '0' }, { ...row, change_seq: 9007199254740993 },
      { ...row, is_deleted: null },
    ]) {
      await expect(setup([json([bad], 201)]).transport.createCategory(category, alice))
        .rejects.toThrow();
    }
  });

  it('rejects unsafe local identity and IDs before network', async () => {
    const { transport, fetcher } = setup([]);
    await expect(transport.createCategory({ ...category, userId: 'not-alice' }, alice))
      .rejects.toThrow();
    for (const id of ['', '_bad', 'hyphen-id', 'a'.repeat(37)]) {
      await expect(transport.createCategory({ ...category, id }, alice)).rejects.toThrow();
    }
    await expect(transport.readTaskMaster('invalid-id', alice)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects account or token switches and never acknowledges ambiguous writes', async () => {
    const rotated = setup([json([row], 201)]);
    rotated.getVerifiedSession.mockResolvedValueOnce(session).mockResolvedValue({
      ...session, accessToken: 'rotated_even_without_epoch',
    });
    await expect(rotated.transport.createCategory(category, alice))
      .rejects.toBeInstanceOf(CandidateAuthError);

    const expired = setup([json({ message: 'JWT denied' }, 401)]);
    await expect(expired.transport.createCategory(category, alice))
      .rejects.toBeInstanceOf(CandidateAuthError);

    const offline = setup([json({ message: 'offline' }, 503)]);
    await expect(offline.transport.createCategory(category, alice))
      .rejects.toBeInstanceOf(CandidateHttpError);
    expect(offline.fetcher).toHaveBeenCalledTimes(1);
  });

  it('blocks unsafe origins and any legacy JWT or secret key', () => {
    const opts = {
      baseUrl: 'https://candidate.example', publishableKey: 'sb_publishable_ok',
      session: { getVerifiedSession: async () => session },
    };
    for (const baseUrl of ['http://untrusted.example', 'https://user:pass@candidate.example',
      'https://candidate.example/tenant', 'https://candidate.example?x=token']) {
      expect(() => createCandidateCreateTransport({ ...opts, baseUrl })).toThrow();
    }
    for (const publishableKey of ['sb_secret_private', 'eyJfakelegacy.jwt.signature', '']) {
      expect(() => createCandidateCreateTransport({ ...opts, publishableKey })).toThrow();
    }
  });
});
