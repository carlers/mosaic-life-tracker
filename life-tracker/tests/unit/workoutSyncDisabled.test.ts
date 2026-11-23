import { describe, expect, it } from 'vitest';
import { activeSyncCollections } from '../../src/db/sync';
import { getReplicationIdentifier, SYNCED_COLLECTION_NAMES } from '../../src/db/replicationIds';

describe('Workout cloud-sync inactive by default', () => {
  it('preserves all eight existing replication groups without new backend dependencies', () => {
    const active = activeSyncCollections('owner_A');
    expect(SYNCED_COLLECTION_NAMES).toHaveLength(8);
    expect(active).not.toContain('activities');
    expect(active).not.toContain('activityTaskLinks');
    expect(getReplicationIdentifier('activities','owner_A')).toContain('owner_A');
  });
});
