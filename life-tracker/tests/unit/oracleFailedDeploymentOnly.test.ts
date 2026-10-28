import { describe, expect, it, vi } from 'vitest';
import {
  assertOracleDeploymentTarget,
  buildOracleMessageDeploymentOnly,
  EXPECTED_MISSING_LIVE_DRIFT,
  ORIGINAL_MESSAGE_FUNCTION_ID,
  ORACLE_TEST_ENDPOINT,
  ORACLE_TEST_PROJECT_ID,
} from '../../scripts/recover-oracle-failed-deployment.mjs';

const target = {
  projectId: ORACLE_TEST_PROJECT_ID,
  endpoint: ORACLE_TEST_ENDPOINT,
  apiKey: 'isolated-test-only',
};
const sourceSha = 'a'.repeat(40);

function resources({
  databases = [{ $id: 'life_tracker' }],
  buckets = [{ $id: 'task_images' }],
  functions = [{ $id: ORIGINAL_MESSAGE_FUNCTION_ID }],
  users = [],
  live = false,
  schedule = '',
  active = '',
} = {}) {
  return {
    tablesDB: { list: vi.fn(async () => ({ databases })) },
    storage: { listBuckets: vi.fn(async () => ({ buckets })) },
    users: { list: vi.fn(async () => ({ users })) },
    functions: {
      list: vi.fn(async () => ({ functions })),
      get: vi.fn(async () => ({
        $id: ORIGINAL_MESSAGE_FUNCTION_ID, live, schedule,
        deploymentId: active,
      })),
      getDeployment: vi.fn(async () => ({
        $id: 'ready2', status: 'ready',
      })),
    },
  };
}

function deps(overrides = {}) {
  const services = resources();
  let requestCalls = 0;
  const request = vi.fn(async () => {
    requestCalls += 1;
    return requestCalls === 1
      ? { total: 1, deployments: [{ $id: 'failed1', status: 'failed' }] }
      : { total: 2, deployments: [
        { $id: 'failed1', status: 'failed' },
        { $id: 'ready2', status: 'ready' },
      ] };
  });
  const deploy = vi.fn(async () => ({
    status: 'ready', deploymentId: 'ready2',
  }));
  return {
    target, gitSha: sourceSha, services,
    definitionsFactory: vi.fn(async () => ({
      functions: {
        'message-action': {
          name: 'message-action',
          config: {
            $id: ORIGINAL_MESSAGE_FUNCTION_ID, runtime: 'node-18.0',
          },
        },
      },
    })),
    inspect: vi.fn(async () => ({ diffs: [EXPECTED_MISSING_LIVE_DRIFT] })),
    requestFactory: vi.fn(() => request),
    deploy,
    log: vi.fn(),
    ...overrides,
  };
}

describe('Oracle existing Function deployment-only recovery', () => {
  it('requires only the pinned Oracle test project and explicit confirmation', () => {
    const argv = ['--confirm-project', ORACLE_TEST_PROJECT_ID];
    expect(() => assertOracleDeploymentTarget(target, argv)).not.toThrow();
    expect(() => assertOracleDeploymentTarget(target, [])).toThrow('confirm-project');
    expect(() => assertOracleDeploymentTarget({
      ...target, endpoint: 'https://sgp.cloud.appwrite.io/v1',
    }, argv)).toThrow('refuses this project');
    expect(() => assertOracleDeploymentTarget({
      ...target, projectId: 'production',
    }, argv)).toThrow('refuses this project');
  });

  it('builds exactly one inactive deployment without creating or activating Function', async () => {
    const x = deps();
    await expect(buildOracleMessageDeploymentOnly(x)).resolves.toEqual({
      status: 'ready', deploymentId: 'ready2', activated: false,
    });
    expect(x.deploy).toHaveBeenCalledTimes(1);
    expect(x.deploy).toHaveBeenCalledWith(expect.objectContaining({
      functions: x.services.functions,
      functionId: ORIGINAL_MESSAGE_FUNCTION_ID,
      gitSha: sourceSha,
    }));
    expect(x.requestFactory()).toHaveBeenCalledTimes(2);
    expect(x.log).toHaveBeenCalledWith('MOSAIC_ORACLE_INACTIVE_MESSAGE_DEPLOYMENT_READY_PASS');
  });

  it.each([
    ['missing database', { databases: [] }],
    ['foreign database', { databases: [{ $id: 'other' }] }],
    ['extra database', { databases: [{ $id: 'life_tracker' }, { $id: 'extra' }] }],
    ['foreign bucket', { buckets: [{ $id: 'foreign' }] }],
    ['missing bucket', { buckets: [] }],
    ['extra bucket', { buckets: [{ $id: 'task_images' }, { $id: 'extra' }] }],
    ['no Function', { functions: [] }],
    ['second Function', { functions: [{ $id: ORIGINAL_MESSAGE_FUNCTION_ID }, { $id: 'extra' }] }],
    ['user exists', { users: [{ $id: 'real-user' }] }],
  ])('rejects %s before any write', async (_label, fixture) => {
    const x = deps({ services: resources(fixture) });
    await expect(buildOracleMessageDeploymentOnly(x)).rejects.toThrow('unexpected project resources');
    expect(x.deploy).not.toHaveBeenCalled();
  });

  it('rejects pre-existing activation and schedules before any write', async () => {
    for (const fixture of [
      { live: true }, { active: 'live_deployment' }, { schedule: '0 * * * *' },
    ]) {
      const x = deps({ services: resources(fixture) });
      await expect(buildOracleMessageDeploymentOnly(x)).rejects.toThrow('already live or unexpected');
      expect(x.deploy).not.toHaveBeenCalled();
    }
  });

  it('rejects schema/Function drift without any build', async () => {
    for (const diff of [
      [], ['table tasks: missing'],
      [EXPECTED_MISSING_LIVE_DRIFT, 'bucket task_images: missing'],
    ]) {
      const x = deps({ inspect: vi.fn(async () => ({ diffs: diff })) });
      await expect(buildOracleMessageDeploymentOnly(x)).rejects.toThrow('Git-owned schema or Function drift');
      expect(x.deploy).not.toHaveBeenCalled();
    }
  });

  it('requires exactly one failed deployment before building', async () => {
    for (const body of [
      { total: 0, deployments: [] },
      { total: 2, deployments: [
        { status: 'failed' }, { status: 'failed' },
      ] },
      { total: 1, deployments: [{ status: 'ready' }] },
      { total: 1, deployments: [{ status: 'building' }] },
    ]) {
      const x = deps({ requestFactory: () => vi.fn(async () => body) });
      await expect(buildOracleMessageDeploymentOnly(x)).rejects.toThrow('exactly one failed build');
      expect(x.deploy).not.toHaveBeenCalled();
    }
  });

  it('refuses wrong canonical Function/runtime and unpinned SHA', async () => {
    const x = deps({ gitSha: 'bad' });
    await expect(buildOracleMessageDeploymentOnly(x)).rejects.toThrow('invalid');
    expect(x.deploy).not.toHaveBeenCalled();
    const y = deps({ definitionsFactory: async () => ({
      functions: { 'message-action': {
        name: 'message-action',
        config: { $id: 'foreign', runtime: 'node-18.0' },
      } },
    }) });
    await expect(buildOracleMessageDeploymentOnly(y)).rejects.toThrow('canonical Function mismatch');
    expect(y.deploy).not.toHaveBeenCalled();
  });

  it('does not retry a failed build or activation read-back failure', async () => {
    const x = deps({ deploy: vi.fn(async () => { throw new Error('internal failure'); }) });
    await expect(buildOracleMessageDeploymentOnly(x)).rejects.toThrow('internal failure');
    expect(x.deploy).toHaveBeenCalledTimes(1);
    const y = deps({ services: resources({ live: false }) });
    y.services.functions.getDeployment.mockResolvedValue({ status: 'failed' });
    await expect(buildOracleMessageDeploymentOnly(y)).rejects.toThrow('read-back proof failed');
    expect(y.deploy).toHaveBeenCalledTimes(1);
  });
});
