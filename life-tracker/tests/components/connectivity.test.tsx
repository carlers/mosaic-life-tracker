import { describe, expect, it, beforeEach } from 'vitest';
import {
  getConnectivitySnapshot,
  markConnectivityChecking,
  reportConnectivityResult,
  resetConnectivityForTests,
} from '../../src/lib/connectivity';

describe('connectivity reachability authority', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    });
    resetConnectivityForTests({
      status: 'checking',
      reason: 'test',
      lastConfirmedAt: null,
    });
  });

  it('does not treat the browser online hint as proven reachability', () => {
    markConnectivityChecking('browser-online-event');

    expect(getConnectivitySnapshot().status).toBe('checking');
  });

  it('marks Appwrite unreachable on a network failure even while navigator.onLine is true', () => {
    reportConnectivityResult(new Error('Failed to fetch'));

    expect(navigator.onLine).toBe(true);
    expect(getConnectivitySnapshot().status).toBe('offline');
  });

  it('marks successful and HTTP error responses as reachable', () => {
    reportConnectivityResult();
    expect(getConnectivitySnapshot().status).toBe('online');

    resetConnectivityForTests({
      status: 'checking',
      reason: 'test',
      lastConfirmedAt: null,
    });
    const unauthorized = new Error('Unauthorized');
    (unauthorized as Error & { code?: number }).code = 401;
    reportConnectivityResult(unauthorized);

    expect(getConnectivitySnapshot().status).toBe('online');
  });
});
