import { describe, expect, it, vi } from 'vitest';
import {
  assertOracleFunctionRepairTarget,
  recoverOracleMessageFunction,
  ORACLE_TEST_ID,
  ORIGINAL_MESSAGE_ID,
  ORACLE_ENDPOINT,
} from '../../scripts/repair-oracle-message-function.mjs';

const target = {
  projectId: ORACLE_TEST_ID,
  endpoint: ORACLE_ENDPOINT,
  apiKey: 'isolated-synthetic-test-only',
};

function servicesOf({
  databases = [{ $id: 'life_tracker' }],
  buckets = [{ $id: 'task_images' }],
  users = [],
  functions = [],
} = {}) {
  return {
    tablesDB: { list: vi.fn(async () => ({ databases })) },
    storage: { listBuckets: vi.fn(async () => ({ buckets })) },
    users: { list: vi.fn(async () => ({ users })) },
    functions: { list: vi.fn(async () => ({ functions })) },
    project: {},
  };
}

function depsOf(overrides = {}) {
  const deploy = vi.fn(async () => ({ status: 'ready' }));
  const inspect = vi.fn()
    .mockResolvedValueOnce({ diffs: ['function message-action: missing'] })
    .mockResolvedValueOnce({ diffs: [] });
  const ensureWeb = vi.fn(async () => ['localhost']);
  return {
    target,
    services: servicesOf(),
    definitionsFactory: vi.fn(async () => ({
      functions: { 'message-action': {
        config: { $id: ORIGINAL_MESSAGE_ID, runtime: 'node-18.0' },
      } },
    })),
    requestFactory: vi.fn(() => vi.fn()),
    inspect,
    deploy,
    ensureWeb,
    wait: vi.fn(),
    ...overrides,
  };
}

describe('Oracle test-only Function recovery', () => {
  it('requires exact localhost target and matching explicit confirmation', () => {
    const argv = ['--confirm-project', ORACLE_TEST_ID];
    expect(() => assertOracleFunctionRepairTarget(argv, target)).not.toThrow();
    expect(() => assertOracleFunctionRepairTarget([], target)).toThrow('--confirm-project');
    expect(() => assertOracleFunctionRepairTarget(argv, {
      ...target, endpoint: 'https://sgp.cloud.appwrite.io/v1',
    })).toThrow('non-isolated');
    expect(() => assertOracleFunctionRepairTarget(argv, {
      ...target, projectId: 'different',
    })).toThrow('non-isolated');
  });

  it('only deploys the original Git-defined Function after exact missing-Function drift proof', async () => {
    const deps = depsOf();
    await expect(recoverOracleMessageFunction(deps))
      .resolves.toEqual({ functionId: ORIGINAL_MESSAGE_ID, drift: 0 });
    expect(deps.deploy).toHaveBeenCalledTimes(1);
    expect(deps.deploy).toHaveBeenCalledWith(expect.objectContaining({
      functionId: ORIGINAL_MESSAGE_ID,
      functionOverrides: { schedule: '' },
      extraVariables: expect.objectContaining({
        DR_PRIVACY_DELETION_REQUIRED: 'false',
        APPWRITE_DATABASE_ID: 'life_tracker',
      }),
    }));
    expect(deps.ensureWeb).toHaveBeenCalledOnce();
    expect(deps.ensureWeb).toHaveBeenCalledWith(deps.services.project, ['localhost']);
    expect(deps.inspect).toHaveBeenCalledTimes(2);
    expect(deps.inspect).toHaveBeenCalledWith(expect.objectContaining({
      includeDr: false, messageFunctionId: ORIGINAL_MESSAGE_ID,
    }));
  });

  it.each([
    ['missing database', { databases: [] }],
    ['foreign database', { databases: [{ $id: 'foreign' }] }],
    ['extra database', { databases: [{ $id: 'life_tracker' }, { $id: 'extra' }] }],
    ['foreign bucket', { buckets: [{ $id: 'foreign' }] }],
    ['extra bucket', { buckets: [{ $id: 'task_images' }, { $id: 'extra' }] }],
    ['missing bucket', { buckets: [] }],
    ['real user', { users: [{ $id: 'owner' }] }],
    ['preexisting Function', { functions: [{ $id: ORIGINAL_MESSAGE_ID }] }],
  ])('refuses %s without attempting a write', async (_label, fixture) => {
    const deps = depsOf({ services: servicesOf(fixture) });
    await expect(recoverOracleMessageFunction(deps)).rejects.toThrow('Refusing Function recovery');
    expect(deps.deploy).not.toHaveBeenCalled();
    expect(deps.inspect).not.toHaveBeenCalled();
  });

  it('refuses non-Function schema drift without creating anything', async () => {
    const deps = depsOf({
      inspect: vi.fn(async () => ({ diffs: [
        'function message-action: missing', 'table diary: missing',
      ] })),
    });
    await expect(recoverOracleMessageFunction(deps)).rejects.toThrow('schema/bucket state differs');
    expect(deps.deploy).not.toHaveBeenCalled();
  });

  it('refuses mismatched canonical ID/runtime before deployment', async () => {
    const deps = depsOf({
      definitionsFactory: async () => ({
        functions: { 'message-action': { config: {
          $id: 'wrong', runtime: 'node-22',
        } } },
      }),
    });
    await expect(recoverOracleMessageFunction(deps)).rejects.toThrow('canonical Function ID/runtime');
    expect(deps.deploy).not.toHaveBeenCalled();
  });

  it('does not retry the write when postflight drift fails to converge', async () => {
    const deps = depsOf({
      inspect: vi.fn()
        .mockResolvedValueOnce({ diffs: ['function message-action: missing'] })
        .mockResolvedValue({ diffs: ['function message-action has no live deployment'] }),
    });
    await expect(recoverOracleMessageFunction(deps)).rejects.toThrow('did not converge');
    expect(deps.deploy).toHaveBeenCalledOnce();
    expect(deps.wait).toHaveBeenCalledTimes(11);
  });
});
