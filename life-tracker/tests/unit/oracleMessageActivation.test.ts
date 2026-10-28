import { describe, expect, it, vi } from 'vitest';
import {
  activateOracleReadyMessage, assertOracleActivationTarget,
  MESSAGE_ID, ORACLE_PROJECT, ORACLE_ENDPOINT,
} from '../../scripts/activate-oracle-ready-message.mjs';

const target = { projectId: ORACLE_PROJECT, endpoint: ORACLE_ENDPOINT, apiKey: 'fake-local' };
function makeServices({
  users = [], databases = [{ $id: 'life_tracker' }],
  buckets = [{ $id: 'task_images' }], functions = [{ $id: MESSAGE_ID }],
  active = false, schedule = '', currentDeployment = '',
} = {}) {
  return {
    tablesDB: { list: vi.fn(async () => ({ databases })) },
    users: { list: vi.fn(async () => ({ users })) },
    storage: { listBuckets: vi.fn(async () => ({ buckets })) },
    functions: {
      list: vi.fn(async () => ({ functions })),
      get: vi.fn(async () => ({
        $id: MESSAGE_ID, runtime: 'node-18.0', live: active,
        schedule, deploymentId: currentDeployment,
      })),
      getDeployment: vi.fn(async () => ({ $id: 'ready1', status: 'ready' })),
    },
  };
}
function setup(overrides = {}) {
  const services = makeServices();
  const inspect = vi.fn()
    .mockResolvedValueOnce({ diffs: ['function message-action has no live deployment'] })
    .mockResolvedValueOnce({ diffs: [] });
  const activate = vi.fn(async () => ({ deploymentId: 'ready1', status: 'active' }));
  const requestFactory = vi.fn(() => vi.fn(async () => ({
    total: 2, deployments: [
      { $id: 'failed1', status: 'failed' },
      { $id: 'ready1', status: 'ready' },
    ],
  })));
  return {
    target, services, inspect, activate, requestFactory,
    definitionsFactory: vi.fn(async () => ({ functions: {
      'message-action': { config: { $id: MESSAGE_ID, runtime: 'node-18.0' } },
    } })),
    wait: vi.fn(), ...overrides,
  };
}

describe('one-shot Oracle test-only ready deployment activation', () => {
  it('requires exact target and explicit matching confirmation', () => {
    expect(() => assertOracleActivationTarget(
      ['--confirm-project', ORACLE_PROJECT], target,
    )).not.toThrow();
    expect(() => assertOracleActivationTarget([], target)).toThrow('--confirm-project');
    expect(() => assertOracleActivationTarget(
      ['--confirm-project', ORACLE_PROJECT],
      { ...target, endpoint: 'https://sgp.cloud.appwrite.io/v1' },
    )).toThrow('exact Oracle test');
  });

  it('activates a single unique ready deployment after preflight and zero-drift postflight', async () => {
    const args = setup();
    let liveNow = false;
    args.services.functions.get.mockImplementation(async () => ({
      $id: MESSAGE_ID, runtime: 'node-18.0', live: liveNow,
      schedule: '', deploymentId: liveNow ? 'ready1' : '',
    }));
    args.activate.mockImplementation(async () => {
      liveNow = true;
      return { deploymentId: 'ready1', status: 'active' };
    });
    await expect(activateOracleReadyMessage(args)).resolves.toEqual({
      activated: true, functionId: MESSAGE_ID,
    });
    expect(args.activate).toHaveBeenCalledTimes(1);
    expect(args.activate).toHaveBeenCalledWith({
      functions: args.services.functions, functionId: MESSAGE_ID, deploymentId: 'ready1',
    });
    expect(args.inspect).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['non-test endpoint', { target: { ...target, endpoint: 'https://cloud.appwrite.io/v1' } }],
    ['foreign database', { services: makeServices({ databases: [{ $id: 'other' }] }) }],
    ['user present', { services: makeServices({ users: [{ $id: 'real' }] }) }],
    ['bucket absent', { services: makeServices({ buckets: [] }) }],
    ['extra Function', { services: makeServices({ functions: [{ $id: MESSAGE_ID }, { $id: 'foreign' }] }) }],
    ['already live', { services: makeServices({ active: true }) }],
    ['scheduled', { services: makeServices({ schedule: '0 * * * *' }) }],
    ['previous active deployment', { services: makeServices({ currentDeployment: 'existing' }) }],
  ])('refuses %s without activation', async (_name, input) => {
    const args = setup(input);
    await expect(activateOracleReadyMessage(args)).rejects.toThrow();
    expect(args.activate).not.toHaveBeenCalled();
  });

  it('rejects any additional managed drift', async () => {
    const args = setup({ inspect: vi.fn(async () => ({ diffs: [
      'function message-action has no live deployment',
      'table tasks: missing',
    ] })) });
    await expect(activateOracleReadyMessage(args)).rejects.toThrow('Git schema/config drift');
    expect(args.activate).not.toHaveBeenCalled();
  });

  it.each([
    ['two ready', [{ $id: 'ready1', status: 'ready' }, { $id: 'ready2', status: 'ready' }]],
    ['two failed', [{ $id: 'failed1', status: 'failed' }, { $id: 'failed2', status: 'failed' }]],
    ['invalid ready ID', [{ $id: '../bad', status: 'ready' }, { $id: 'failed1', status: 'failed' }]],
  ])('refuses %s deployment inventory', async (_name, deployments) => {
    const args = setup({ requestFactory: () => vi.fn(async () => ({ total: 2, deployments })) });
    await expect(activateOracleReadyMessage(args)).rejects.toThrow('ready deployment is not unique');
    expect(args.activate).not.toHaveBeenCalled();
  });

  it('does not repeat activation if postflight fails', async () => {
    const args = setup({ inspect: vi.fn()
      .mockResolvedValueOnce({ diffs: ['function message-action has no live deployment'] })
      .mockResolvedValue({ diffs: ['function message-action has no live deployment'] }) });
    await expect(activateOracleReadyMessage(args)).rejects.toThrow('postflight not converged');
    expect(args.activate).toHaveBeenCalledTimes(1);
    expect(args.wait).toHaveBeenCalledTimes(7);
  });
});
