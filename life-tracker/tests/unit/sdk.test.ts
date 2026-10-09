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
import { guardedFunctions, guardedTablesDB } from '../../src/lib/sdk';

describe('guarded browser TablesDB API', () => {
  it('exposes only read, partial-update and insert operations', () => {
    // Removing dangerous methods from the public object also removes them
    // from its TypeScript surface: callers cannot accidentally use PUT or
    // hard-delete by following the SDK's autocomplete.
    expect(Object.keys(guardedTablesDB).sort()).toEqual([
      'createRow', 'getRow', 'listRows', 'updateRow',
    ]);
    expect('upsertRow' in guardedTablesDB).toBe(false);
    expect('deleteRow' in guardedTablesDB).toBe(false);
  });
});

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
