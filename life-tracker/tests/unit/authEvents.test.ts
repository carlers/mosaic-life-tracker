// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AUTH_UNAUTHORIZED_EVENT,
  guardedCall,
  isUnauthorizedError,
} from '../../src/lib/authEvents';

describe('auth event classification and verification requests', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not turn an MFA-required first-factor session into a generic 401 logout', async () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, listener);
    const error = Object.assign(new Error('More factors required'), {
      type: 'user_more_factors_required', code: 401,
    });
    expect(isUnauthorizedError(error)).toBe(false);
    await expect(guardedCall(() => Promise.reject(error))).rejects.toBe(error);
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, listener);
  });

  it('preserves permission errors while coalescing verification requests', async () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, listener);
    const missingScope = new Error('User missing scope rows.read');

    const results = await Promise.allSettled([
      guardedCall(() => Promise.reject(missingScope)),
      guardedCall(() => Promise.reject(missingScope)),
      guardedCall(() => Promise.reject(missingScope)),
    ]);
    await Promise.resolve();

    expect(isUnauthorizedError(missingScope)).toBe(true);
    expect(results.every((result) =>
      result.status === 'rejected' && result.reason === missingScope
    )).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, listener);
  });
});
