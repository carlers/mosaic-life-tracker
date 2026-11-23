'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const run = require('./main.js');

const env = {
  APPWRITE_FUNCTION_PROJECT_ID: '6ae94a2100014d01f5ed',
  APPWRITE_FUNCTION_API_ENDPOINT: 'https://example.org/v1',
  MOSAIC_FLOPPY_PREVIEW_ENABLED: 'true',
  FLOPPY_PILOT_USER_ID: 'verified_user',
  FLOPPY_ORIGIN: 'https://floppy.example.org',
  FLOPPY_READ_TOKEN: 'read_only_example_token',
};
const headers = {
  'x-appwrite-user-id': 'verified_user',
  'x-appwrite-user-jwt': 'example_jwt',
};
const movie = {
  media_type: 'movie', instance_id: 12, played_at_local: '2026-11-23T20:00:00+08:00',
  play_count: 2, title: 'Example', score: 8, notes: 'PRIVATE',
  item: { source: 'tmdb', media_id: '123', title: 'Example', image: 'https://tracker.invalid/pixel' },
};
async function execute(body, overrides = {}) {
  const calls = [];
  let status;
  let reply;
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return { ok: true, text: async () => JSON.stringify({ $id: 'verified_user' }) };
    return {
      ok: true,
      text: async () => JSON.stringify({
        results: [movie],
        pagination: { total: 1, offset: body.offset || 0, limit: 100 },
      }),
    };
  };
  await run({
    req: { headers: { ...headers, ...overrides.headers }, bodyJson: body },
    res: { json: (value, code, h) => { status = code; reply = value; return { value, code, h }; } },
  }, { env: { ...env, ...overrides.env }, fetchImpl: overrides.fetchImpl || fetchImpl });
  return { status, reply, calls };
}
test('validDay rejects overflow and origin is fixed HTTPS only', () => {
  assert.equal(run._test.validDay('2026-02-30'), false);
  assert.equal(run._test.validOrigin('http://127.0.0.1:8000'), null);
  assert.equal(run._test.validOrigin('https://localhost/'), null);
  assert.equal(run._test.validOrigin('https://evil.example/redirect'), null);
  assert.equal(run._test.validOrigin('https://floppy.example.org'), 'https://floppy.example.org');
});
test('different Appwrite environment fails closed before any provider call', async () => {
  const result = await execute({ action: 'history', day: '2026-11-23' }, {
    env: { APPWRITE_FUNCTION_PROJECT_ID: '6ae9599c002ab812f9c3' },
  });
  assert.equal(result.status, 503);
  assert.equal(result.calls.length, 0);
});
test('wrong or missing owner authentication fails closed', async () => {
  const result = await execute({ action: 'history', day: '2026-11-23' }, {
    headers: { 'x-appwrite-user-id': 'someone_else' },
  });
  assert.equal(result.status, 403);
  assert.equal(result.calls.length, 0);
});
test('bad JWT cannot authorize even a matching owner header', async () => {
  const result = await execute({ action: 'history', day: '2026-11-23' }, {
    fetchImpl: async () => ({ ok: true, text: async () => JSON.stringify({ $id: 'wrong_user' }) }),
  });
  assert.equal(result.status, 403);
});
test('read-only day scope, sanitized fields and no secrets in response', async () => {
  const result = await execute({ action: 'history', day: '2026-11-23' });
  assert.equal(result.status, 200);
  assert.equal(result.calls.length, 2);
  assert.match(result.calls[1].url, /start_date=2026-11-23/);
  assert.match(result.calls[1].url, /types=movie%2Cepisode/);
  assert.match(result.calls[1].url, /flat=1/);
  assert.equal(result.calls[1].options.redirect, 'error');
  assert.equal(result.reply.results[0].item.source, 'tmdb');
  assert.equal(result.reply.results[0].play_count, 2);
  assert.equal(JSON.stringify(result.reply).includes('PRIVATE'), false);
  assert.equal(JSON.stringify(result.reply).includes('tracker.invalid'), false);
  assert.equal(JSON.stringify(result.reply).includes(env.FLOPPY_READ_TOKEN), false);
});
test('invalid requests do not reach the provider', async () => {
  const result = await execute({ action: 'history', day: '2026-02-30' });
  assert.equal(result.status, 400);
  assert.equal(result.calls.length, 1); // only JWT verification
});
test('upstream errors do not disclose provider response body', async () => {
  let calls = 0;
  const result = await execute({ action: 'history', day: '2026-11-23' }, {
    fetchImpl: async () => ++calls === 1
      ? { ok: true, text: async () => JSON.stringify({ $id: 'verified_user' }) }
      : { ok: false, status: 500, text: async () => 'secret provider trace' },
  });
  assert.equal(result.status, 502);
  assert.equal(JSON.stringify(result.reply).includes('secret'), false);
});
