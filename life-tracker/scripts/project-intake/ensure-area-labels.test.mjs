import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureAreaLabels, NEW_AREA_LABELS } from './ensure-area-labels.mjs';

const response = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json' }
});

function mockApi({ existing = [], deny = false, conflictOnce = false } = {}) {
  const labels = new Set(existing);
  const calls = [];
  let conflicted = false;
  const fetcher = async (url, options) => {
    const parsed = new URL(url);
    const collection = parsed.pathname.endsWith('/labels');
    const name = decodeURIComponent(parsed.pathname.split('/').at(-1));
    calls.push({ url, method: options.method, authorization: options.headers.authorization,
      body: options.body ? JSON.parse(options.body) : undefined });
    if (deny) return response({ message: 'denied' }, 403);
    if (options.method === 'GET' && !collection) {
      return labels.has(name) ? response({ name }) : response({ message: 'missing' }, 404);
    }
    if (options.method === 'POST' && collection) {
      const label = JSON.parse(options.body);
      if (conflictOnce && !conflicted) {
        conflicted = true;
        labels.add(label.name);
        return response({ message: 'already exists' }, 422);
      }
      if (labels.has(label.name)) return response({ message: 'already exists' }, 422);
      labels.add(label.name);
      return response({ name: label.name }, 201);
    }
    throw Error('Unexpected request: ' + options.method + ' ' + url);
  };
  return { calls, labels, fetcher };
}

test('only the four new fixed area labels are bootstrapped', () => {
  assert.deepEqual(NEW_AREA_LABELS.map(x => x.name), [
    'area:social', 'area:storage', 'area:product', 'area:platform'
  ]);
  assert.ok(NEW_AREA_LABELS.every(x => x.color === 'ededed' && x.description.length > 0));
});

test('creates only missing labels and preserves existing label metadata', async () => {
  const api = mockApi({ existing: ['area:social'] });
  const first = await ensureAreaLabels({ token: 'repo-write-token', fetcher: api.fetcher });
  assert.deepEqual(first, {
    created: ['area:storage', 'area:product', 'area:platform'],
    existing: ['area:social']
  });
  assert.equal(api.calls.filter(x => x.method === 'POST').length, 3);
  assert.ok(api.calls.every(x => x.authorization === 'Bearer repo-write-token'));
  assert.ok(api.calls.filter(x => x.method === 'POST').every(x =>
    x.body.color === 'ededed' && typeof x.body.description === 'string'));
  const second = await ensureAreaLabels({ token: 'repo-write-token', fetcher: api.fetcher });
  assert.deepEqual(second, {
    created: [],
    existing: ['area:social', 'area:storage', 'area:product', 'area:platform']
  });
  assert.equal(api.calls.filter(x => x.method === 'POST').length, 3);
});

test('concurrent creation conflict is accepted only after exact-label readback', async () => {
  const api = mockApi({ conflictOnce: true });
  const result = await ensureAreaLabels({ token: 'repo-write-token', fetcher: api.fetcher });
  assert.deepEqual(result, {
    created: ['area:storage', 'area:product', 'area:platform'],
    existing: ['area:social']
  });
  assert.equal(api.calls.filter(x => x.method === 'POST').length, 4);
});

test('missing credentials and repository permission failures fail closed', async () => {
  const api = mockApi();
  await assert.rejects(ensureAreaLabels({ token: '', fetcher: api.fetcher }), /Missing GitHub authorization/);
  assert.equal(api.calls.length, 0);
  const denied = mockApi({ deny: true });
  await assert.rejects(ensureAreaLabels({ token: 'repo-write-token', fetcher: denied.fetcher }),
    /GitHub label API request failed \(HTTP 403\)/);
});

test('label identity mismatch fails closed', async () => {
  const fetcher = async () => response({ name: 'area:wrong' });
  await assert.rejects(ensureAreaLabels({ token: 'repo-write-token', fetcher }),
    /label readback identity mismatch/);
});
