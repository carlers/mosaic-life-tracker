import { describe, expect, it, vi } from 'vitest';
const controls = vi.hoisted(() => ({ social: true }));
vi.mock('../../src/lib/featureControls', () => ({
  isFeatureEnabled: (flag: string) => flag !== 'mosaic_disable_all_social' || controls.social,
}));
import { activeSyncCollections } from '../../src/db/sync';
describe('social replication selection', () => {
  it('preserves all pilot collections when social is available', () => {
    controls.social = true;
    expect(activeSyncCollections('owner')).toContain('friendships');
    expect(activeSyncCollections('owner')).toContain('messages');
    expect(activeSyncCollections('owner')).toContain('settings');
  });
  it('retains core pilots and hides social pilots during single-user mode', () => {
    controls.social = false;
    expect(activeSyncCollections('owner').length).toBe(6);
    expect(activeSyncCollections('owner')).not.toContain('friendships');
    expect(activeSyncCollections('owner')).not.toContain('messages');
    expect(activeSyncCollections('owner')).toContain('tasks');
    controls.social = true;
    expect(activeSyncCollections('owner')).toContain('messages');
  });
});
