'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const run = require('./main.js');

const env = {
  APPWRITE_FUNCTION_PROJECT_ID: '6ae94a2100014d01f5ed',
  APPWRITE_FUNCTION_API_ENDPOINT: 'https://129-221-244-67.sslip.io/v1',
  MOSAIC_FLOPPY_PREVIEW_ENABLED: 'true',
  FLOPPY_PILOT_USER_ID: 'verified_user',
  FLOPPY_ORIGIN: 'https://floppy.synthetic-tailnet.ts.net:8443',
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
  assert.equal(run._test.validOrigin('https://floppy.example.org'), null);
  assert.equal(run._test.validOrigin('https://floppy.synthetic-tailnet.ts.net'), null);
  assert.equal(run._test.validOrigin('https://floppy.synthetic-tailnet.ts.net:443'), null);
  assert.equal(run._test.validOrigin('https://floppy.synthetic-tailnet.ts.net:8444'), null);
  assert.equal(run._test.validOrigin('https://floppy.synthetic-tailnet.ts.net:8443/path'), null);
  assert.equal(run._test.validOrigin('https://floppy.synthetic-tailnet.ts.net.evil.org:8443'), null);
  assert.equal(run._test.validOrigin('https://user:pass@floppy.synthetic-tailnet.ts.net:8443'), null);
  assert.equal(run._test.validOrigin('https://floppy.synthetic-tailnet.ts.net:8443'),
    'https://floppy.synthetic-tailnet.ts.net:8443');
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
  assert.match(result.calls[1].url, /^https:\/\/floppy\.synthetic-tailnet\.ts\.net:8443\/api\/v1\/history\/\?/);
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

test('filtered provider rows preserve upstream pagination progress without exposing private fields', async () => {
  let calls = 0;
  const result = await execute({ action: 'history', day: '2026-11-23' }, {
    fetchImpl: async () => ++calls === 1
      ? { ok: true, text: async () => JSON.stringify({ $id: 'verified_user' }) }
      : { ok: true, text: async () => JSON.stringify({
          results: [
            { media_type: 'book', notes: 'PRIVATE_BOOK', item: { title: 'Private title' } },
            movie,
            { media_type: 'game', notes: 'PRIVATE_GAME' },
          ],
          pagination: { total: 4, offset: 0, limit: 100 },
        }) },
  });
  assert.equal(result.status, 200);
  assert.equal(result.reply.results.length, 1);
  assert.equal(result.reply.pagination.scanned, 3);
  assert.equal(result.reply.pagination.total, 4);
  assert.equal(JSON.stringify(result.reply).includes('PRIVATE_'), false);
});

test('upstream empty page before the advertised end fails closed', async () => {
  let calls = 0;
  const result = await execute({ action: 'history', day: '2026-11-23' }, {
    fetchImpl: async () => ++calls === 1
      ? { ok: true, text: async () => JSON.stringify({ $id: 'verified_user' }) }
      : { ok: true, text: async () => JSON.stringify({
          results: [], pagination: { total: 2, offset: 0, limit: 100 },
        }) },
  });
  assert.equal(result.status, 502);
  assert.equal(result.reply.error, 'Floppy API contract changed');
});

test('other Scratch identity and an unconfigured pilot make no network requests', async () => {
  for (const value of ['6b00671500279e901846', '6ae9599c002ab812f9c3']) {
    const blocked = await execute({ action: 'history', day: '2026-11-23' }, {
      env: { APPWRITE_FUNCTION_PROJECT_ID: value },
    });
    assert.equal(blocked.status, 503);
    assert.equal(blocked.calls.length, 0);
  }
  const disabled = await execute({ action: 'status' }, {
    env: { MOSAIC_FLOPPY_PREVIEW_ENABLED: 'false' },
  });
  assert.equal(disabled.status, 503);
  assert.equal(disabled.calls.length, 0);
});

test('provider credential and account identity are never included in status response', async () => {
  const result = await execute({ action: 'status' });
  assert.equal(result.status, 200);
  assert.deepEqual(result.reply, { available: true });
  assert.equal(result.calls.length, 1); // Appwrite identity only
  assert.equal(JSON.stringify(result.reply).includes(env.FLOPPY_READ_TOKEN), false);
  assert.equal(JSON.stringify(result.reply).includes(env.FLOPPY_PILOT_USER_ID), false);
});

test('provider 401 and 429 failures are classified without returning private details', async () => {
  for (const [providerStatus, expectedCode, expectedError] of [
    [401, 424, 'Reconnect Floppy'],
    [429, 429, 'Floppy is rate limiting requests'],
  ]) {
    let calls = 0;
    const result = await execute({ action: 'history', day: '2026-11-23' }, {
      fetchImpl: async () => ++calls === 1
        ? { ok: true, text: async () => JSON.stringify({ $id: 'verified_user' }) }
        : { ok: false, status: providerStatus, text: async () => 'PRIVATE_SERVER_MESSAGE' },
    });
    assert.equal(result.status, expectedCode);
    assert.equal(result.reply.error, expectedError);
    assert.equal(JSON.stringify(result.reply).includes('PRIVATE'), false);
    assert.equal(result.calls.length, 0); // synthetic inject bypasses default call tracker
  }
});

test('account cannot switch by spoofing an arbitrary owner id header', async () => {
  const blocked = await execute({ action: 'history', day: '2026-11-23' }, {
    headers: { 'x-appwrite-user-id': 'different_owner' },
  });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.calls.length, 0);
  const forged = await execute({ action: 'history', day: '2026-11-23' }, {
    fetchImpl: async () => ({ ok: true, text: async () => JSON.stringify({ $id: 'different_owner' }) }),
  });
  assert.equal(forged.status, 403);
});

test('misconfigured Tailscale origin refuses to send the provider token', async () => {
  let calls = 0;
  for (const origin of ['https://floppy.example.org', 'https://floppy.synthetic-tailnet.ts.net:443',
    'https://127.0.0.1:8443', 'https://floppy.synthetic-tailnet.ts.net.evil.org:8443']) {
    calls = 0;
    const result = await execute({ action: 'history', day: '2026-11-23' }, {
      env: { FLOPPY_ORIGIN: origin },
      fetchImpl: async () => {
        calls++;
        if (calls !== 1) throw Error('Provider fetch not allowed');
        return { ok: true, text: async () => JSON.stringify({ $id: 'verified_user' }) };
      },
    });
    assert.equal(result.status, 503, origin);
    assert.equal(calls, 1, origin);
  }
});

test('status is not available with an undersized read token', async () => {
  const result = await execute({ action: 'status' }, {
    env: { FLOPPY_READ_TOKEN: 'short' },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.reply, { available: false });
});

test('upstream pagination cannot claim fewer total rows than were consumed', async () => {
  let calls = 0;
  const result = await execute({ action: 'history', day: '2026-11-23' }, {
    fetchImpl: async () => ++calls === 1
      ? { ok: true, text: async () => JSON.stringify({ $id: 'verified_user' }) }
      : { ok: true, text: async () => JSON.stringify({
          results: [movie, movie], pagination: { total: 1, offset: 0, limit: 100 },
        }) },
  });
  assert.equal(result.status, 502);
  assert.equal(result.reply.error, 'Floppy API contract changed');
});

test('untrusted Appwrite API endpoint cannot receive a user JWT', async () => {
  for (const endpoint of [
    'https://forged.example.org/v1',
    'https://129-221-244-67.sslip.io/v1/other',
    'https://129-221-244-67.sslip.io/v1?redirect=example',
    'http://129-221-244-67.sslip.io/v1',
  ]) {
    const result = await execute({ action: 'history', day: '2026-11-23' }, {
      env: { APPWRITE_FUNCTION_API_ENDPOINT: endpoint },
    });
    assert.equal(result.status, 503, endpoint);
    assert.equal(result.reply.error, 'Identity service unavailable');
    assert.equal(result.calls.length, 0, endpoint);
  }
});

test('verified identity endpoint receives the JWT only on its fixed /account path', async () => {
  const result = await execute({ action: 'history', day: '2026-11-23' });
  assert.equal(result.status, 200);
  assert.equal(result.calls[0].url,
    'https://129-221-244-67.sslip.io/v1/account');
  assert.equal(result.calls[0].options.headers['X-Appwrite-Project'],
    '6ae94a2100014d01f5ed');
  assert.equal(result.calls[1].options.headers.Authorization,
    'Bearer ' + env.FLOPPY_READ_TOKEN);
  assert.equal(result.calls[1].options.headers['X-Appwrite-JWT'], undefined);
});
