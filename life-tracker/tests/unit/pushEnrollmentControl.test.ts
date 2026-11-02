import { describe, expect, it, vi } from 'vitest';

const permission = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/featureControls', () => ({ isFeatureEnabled: () => false }));

import { enablePushNotifications } from '../../src/lib/pushNotifications';

describe('Push subscription initiation control', () => {
  it('rejects new enrollment before browser permission or push network operations', async () => {
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: permission });
    try {
      await expect(enablePushNotifications('ownerA')).rejects.toThrow('New push subscriptions are temporarily unavailable.');
      expect(permission).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
