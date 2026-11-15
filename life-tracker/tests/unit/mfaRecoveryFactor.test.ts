import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthenticationFactor } from 'appwrite';

const provider = vi.hoisted(() => ({ createMfaChallenge: vi.fn() }));
vi.mock('../../src/lib/appwrite', () => ({ account: provider }));
vi.mock('../../src/lib/appwriteConfig', () => ({
  APPWRITE_PROJECT_ID: '6ae94a2100014d01f5ed',
}));

import { createMfaLoginChallenge, resolveMfaRecoveryFactor } from '../../src/lib/mfa';

describe('Oracle Appwrite MFA recovery-factor compatibility (#2067)', () => {
  beforeEach(() => provider.createMfaChallenge.mockReset());

  it('uses the live-verified case-sensitive Oracle factor for Preview and Production only', () => {
    expect(resolveMfaRecoveryFactor('6ae94a2100014d01f5ed')).toBe('recoveryCode');
    expect(resolveMfaRecoveryFactor('6ae9599c002ab812f9c3')).toBe('recoveryCode');
    expect(resolveMfaRecoveryFactor('unrecognized-project')).toBe(AuthenticationFactor.Recoverycode);
  });

  it('preserves TOTP and sends Oracle recoveryCode in actual create-challenge requests', async () => {
    provider.createMfaChallenge.mockResolvedValue({ $id: 'synthetic_challenge' });
    await createMfaLoginChallenge('totp');
    expect(provider.createMfaChallenge).toHaveBeenLastCalledWith({
      factor: AuthenticationFactor.Totp,
    });
    await createMfaLoginChallenge('recovery');
    expect(provider.createMfaChallenge).toHaveBeenLastCalledWith({
      factor: 'recoveryCode',
    });
  });
});
