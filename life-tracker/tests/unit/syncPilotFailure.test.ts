import { describe, expect, it } from 'vitest';
import {
  describeSyncPilotFailure,
  isNonRetryableReplicationFailure,
  replicationHttpStatus,
} from '../../src/lib/syncPilotFailure';

describe('sync pilot failure classification', () => {
  it('unwraps a nested RxDB failure without exposing row content', () => {
    const error = {
      message: 'private value should never be shown',
      parameters: { errors: [{
        cause: Object.assign(new Error('secret image id'), { code: 403, syncStage: 'profile' }),
      }] },
    };
    expect(replicationHttpStatus(error)).toBe(403);
    expect(isNonRetryableReplicationFailure(error)).toBe(true);
    const detail = describeSyncPilotFailure(error);
    expect(detail).toMatch(/Profile mirror: HTTP 403/);
    expect(detail).not.toContain('private');
    expect(detail).not.toContain('secret');
  });

  it('reports only a safe sync operation stage for a wrapped Appwrite HTTP 400', () => {
    const wrapped = {
      parameters: { errors: [{ cause: { code: 400, syncStage: 'create', message: 'private value' } }] },
    };
    const detail = describeSyncPilotFailure(wrapped);
    expect(detail).toMatch(/^Remote settings create: HTTP 400/);
    expect(detail).not.toContain('private value');
  });

  it('does not prematurely stop HTTP 429, HTTP 5xx, or unknown retry failures', () => {
    for (const error of [{ code: 429 }, { code: 503 }, new Error('network down')]) {
      expect(isNonRetryableReplicationFailure(error)).toBe(false);
    }
    expect(describeSyncPilotFailure({ code: 503 })).toMatch(/retry will continue/);
  });

  it('does not treat ordinary RxDB error codes as HTTP statuses', () => {
    expect(replicationHttpStatus({ code: 'RC_PUSH', parameters: { reason: 'x' } })).toBeNull();
  });
});
