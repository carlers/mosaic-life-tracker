import { describe, expect, it, vi } from 'vitest';
import { scrubDiaryChatQuotes, runDiaryQuoteScrub } from '../../scripts/scrub-diary-chat-quotes.mjs';

const diary = {
  $id: 'diary_private', user_id: 'owner_a', visibility: 'private',
  deleted: false, quote_epoch: 0, $updatedAt: '2026-10-01T00:00:00.000Z',
};
const message = (id: string, overrides: Record<string, unknown> = {}) => ({
  $id: id, user_id: 'person_a', sender_id: 'person_a',
  recipient_id: 'owner_a', direction: 'outgoing',
  content: 'Independent authored text', reactions: 'heart',
  diary_ref_id: diary.$id, diary_ref_owner_id: diary.user_id,
  diary_ref_date: '2026-10-01', diary_ref_excerpt: 'Copied private diary',
  ...overrides,
});

describe('scratch-only historical diary Chat excerpt backfill', () => {
  it('dry-runs with zero writes and no private text in logs', async () => {
    const request = vi.fn(async (method: string, path: string) => {
      if (method !== 'GET') throw Error('Dry run wrote to the server');
      if (path.includes('/messages/rows?'))
        return { rows: [message('msg_copy_a'), message('rmsg_copy_b')] };
      if (path.endsWith('/diary/rows/diary_private')) return diary;
      throw Error('Unexpected API path');
    });
    const log = vi.fn();
    const result = await scrubDiaryChatQuotes({ request, log });
    expect(result).toMatchObject({
      apply: false, scanned: 2, wouldRedact: 2, redacted: 0,
      wouldFence: 1, fenced: 0, completed: true, nextCursor: '',
    });
    expect(request.mock.calls.every(([method]) => method === 'GET')).toBe(true);
    expect(JSON.stringify(log.mock.calls)).not.toContain('Copied private diary');
    expect(JSON.stringify(log.mock.calls)).not.toContain('owner_a');
  });

  it('scrubs both copies, retains authored message bodies and fences once', async () => {
    const writes: Array<{ path: string; data: any }> = [];
    const request = vi.fn(async (method: string, path: string, body?: any) => {
      if (method === 'GET' && path.includes('/messages/rows?'))
        return { rows: [message('msg_copy_a'), message('rmsg_copy_b')] };
      if (method === 'GET' && path.endsWith('/diary/rows/diary_private'))
        return diary;
      if (method === 'PATCH') {
        writes.push({ path, data: body.data });
        return { total: 1 };
      }
      throw Error('Unexpected API request');
    });
    const result = await scrubDiaryChatQuotes({ request, apply: true });
    expect(result).toMatchObject({ redacted: 2, fenced: 1, completed: true });
    expect(writes).toHaveLength(3);
    const messages = writes.filter(w => w.path.includes('/messages/rows/'));
    expect(messages).toHaveLength(2);
    for (const w of messages) {
      expect(w.data).toMatchObject({
        diary_ref_excerpt: '', diary_ref_date: '',
      });
      expect(w.data).not.toHaveProperty('content');
      expect(w.data).not.toHaveProperty('reactions');
      expect(w.data).not.toHaveProperty('user_id');
    }
    const fence = writes.find(w => w.path.endsWith('/diary/rows'));
    expect(fence?.data).toEqual({ quote_epoch: 1 });
  });

  it('redacts public snapshots without invalidating currently shared quotes', async () => {
    const request = vi.fn(async (method: string, path: string, body?: any) => {
      if (method === 'GET' && path.includes('/messages/rows?'))
        return { rows: [message('msg_shared')] };
      if (method === 'GET')
        return { ...diary, visibility: 'followers' };
      if (method === 'PATCH') {
        expect(path).toContain('/messages/rows/msg_shared');
        expect(body.data).toMatchObject({ diary_ref_excerpt: '' });
        expect(body.data).not.toHaveProperty('diary_ref_date');
        return {};
      }
      throw Error('Unexpected API request');
    });
    const result = await scrubDiaryChatQuotes({ request, apply: true });
    expect(result).toMatchObject({ redacted: 1, fenced: 0 });
  });

  it('rejects the production endpoint and requires exact scratch confirmation before writes', async () => {
    const env = { APPWRITE_API_KEY: 'fixture-only' };
    await expect(runDiaryQuoteScrub({
      env, argv: ['--project', 'prod', '--endpoint', 'https://sgp.cloud.appwrite.io/v1'],
    })).rejects.toThrow(/scratch project/);
    await expect(runDiaryQuoteScrub({
      env, argv: ['--project', '6a96e82d000d1310b3be',
        '--endpoint', 'https://fra.cloud.appwrite.io/v1', '--apply'],
    })).rejects.toThrow(/confirm-project/);
  });
});
