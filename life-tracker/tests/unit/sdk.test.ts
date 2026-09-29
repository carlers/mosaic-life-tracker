// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const createExecutionMock = vi.hoisted(() => vi.fn());

vi.mock('appwrite', () => ({
  Functions: class { createExecution = createExecutionMock; },
  Storage: class {},
  TablesDB: class {},
}));
vi.mock('../../src/lib/appwrite', () => ({
  client: {},
  account: { get: vi.fn() },
}));

import { AUTH_UNAUTHORIZED_EVENT } from '../../src/lib/authEvents';
import { guardedFunctions } from '../../src/lib/sdk';

describe('guardedFunctions', () => {
  beforeEach(() => createExecutionMock.mockReset());

  it('returns a Function business 401 unchanged while requesting session verification', async () => {
    const execution = {
      status: 'completed',
      responseStatusCode: 401,
      responseBody: JSON.stringify({ error: 'missing scope' }),
    };
    createExecutionMock.mockResolvedValueOnce(execution);
    const listener = vi.fn();
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, listener);

    await expect(guardedFunctions.createExecution({
      functionId: 'message-action',
    })).resolves.toBe(execution);
    await Promise.resolve();

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, listener);
  });
});
