import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bootstrapMosaicProject,
  E2EE_SCRATCH_LAB_ENDPOINT,
  E2EE_SCRATCH_LAB_PROJECT_ID,
  parseBootstrapArgs,
} from '../lib/mosaic-bootstrap.mjs';

const env = { APPWRITE_API_KEY: 'synthetic-test-only-credential' };
const args = [
  '--e2ee-scratch-lab',
  '--project', E2EE_SCRATCH_LAB_PROJECT_ID,
  '--endpoint', E2EE_SCRATCH_LAB_ENDPOINT,
  '--no-env-file',
];
const parse = (argv) => parseBootstrapArgs(argv, env);

test('exact empty E2EE lab mode cannot target Preview, Production or TEST', () => {
  const valid = parse(args);
  assert.equal(valid.e2eeScratchLab, true);
  assert.equal(valid.writeEnv, false);
  assert.equal(valid.withDr, false);
  assert.deepEqual(valid.webHostnames, ['localhost']);
  for (const foreign of [
    '6ae94a2100014d01f5ed',
    '6ae1bf2e00034572451b',
    '6ae9599c002ab812f9c3',
  ]) {
    assert.throws(() => parse([
      ...args.slice(0, 2), foreign, ...args.slice(3),
    ]), /Refusing E2EE lab bootstrap/);
  }
  assert.throws(() => parse(args.filter((x) => x !== '--no-env-file')), /Refusing E2EE lab bootstrap/);
  assert.throws(() => parse([...args, '--web-hostname', '*.vercel.app']), /Refusing E2EE lab bootstrap/);
  assert.throws(() => parse([...args, '--with-dr']), /Refusing E2EE lab bootstrap/);
  assert.throws(() => parse([...args, '--platform-only']), /Refusing E2EE lab bootstrap/);
  assert.throws(() => parse([...args, '--message-function-id', 'other']), /Refusing E2EE lab bootstrap/);
  assert.throws(() => parse([...args, '--dr-function-id', 'other']), /Refusing E2EE lab bootstrap/);
  assert.throws(() => parse([
    ...args, '--endpoint', 'https://example.com/v1',
  ]), /Refusing E2EE lab bootstrap/);
});

function fakeBackend(occupied = false) {
  const calls = { databases: [], tables: [], buckets: [], functions: [], variables: [], deployments: [], platforms: [] };
  const mock = {
    tablesDB: {
      list: async () => ({ databases: occupied ? [{ $id: 'existing' }] : [] }),
      create: async (v) => calls.databases.push(v),
      createTable: async (v) => calls.tables.push(v),
    },
    storage: {
      listBuckets: async () => ({ buckets: [] }),
      createBucket: async (v) => calls.buckets.push(v),
    },
    functions: {
      list: async () => ({ functions: [] }),
      create: async (v) => calls.functions.push(v),
      createVariable: async (v) => calls.variables.push(v),
      createDeployment: async (v) => {
        calls.deployments.push(v);
        return { $id: 'synthetic_ready_deployment' };
      },
      getDeployment: async () => ({ status: 'ready' }),
    },
    users: { list: async () => ({ users: [] }) },
    project: {
      listPlatforms: async () => ({ platforms: [] }),
      createWebPlatform: async (v) => calls.platforms.push(v),
    },
  };
  return { mock, calls };
}

test('new lab creates only a schedule-disabled, default-off E2EE Function', async () => {
  const { mock, calls } = fakeBackend();
  const result = await bootstrapMosaicProject(parse(args), { services: mock });
  assert.equal(calls.databases.length, 1);
  assert.ok(calls.tables.length >= 20);
  assert.equal(calls.buckets.length, 1);
  assert.equal(calls.functions.length, 1);
  assert.equal(calls.functions[0].functionId, 'message_action');
  assert.equal(calls.functions[0].schedule, '');
  assert.deepEqual(calls.platforms.map((x) => x.hostname), ['localhost']);
  assert.equal(result.drFunctionId, null);
  assert.equal(calls.deployments.length, 1);
  assert.ok(calls.variables.some((x) =>
    x.key === 'MOSAIC_E2EE_OWNER_ENABLED' && x.value === 'false'));
  assert.ok(calls.variables.some((x) =>
    x.key === 'MOSAIC_E2EE_PILOT_ENABLED' && x.value === 'false'));
});

test('occupied lab fails before a single backend mutation', async () => {
  const { mock, calls } = fakeBackend(true);
  await assert.rejects(
    bootstrapMosaicProject(parse(args), { services: mock }),
    /Refusing to bootstrap a non-empty Appwrite project/,
  );
  assert.deepEqual(calls, {
    databases: [], tables: [], buckets: [], functions: [],
    variables: [], deployments: [], platforms: [],
  });
});
