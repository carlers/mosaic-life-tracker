import {
  MOSAIC_BUCKET,
  MOSAIC_TABLES,
} from './mosaic-backend.mjs';

export const ACCOUNT_ERASURE_POLICY = {
  tables: {
    tasks: {
      kind: 'owned',
      ownerField: 'user_id',
      structuredScrubs: ['reactions'],
    },
    categories: { kind: 'owned', ownerField: 'user_id' },
    diary: { kind: 'owned', ownerField: 'user_id' },
    settings: {
      kind: 'owned',
      ownerField: 'user_id',
      structuredScrubs: ['friend_carousel_prefs'],
    },
    friendships: {
      kind: 'cross_reference',
      fields: ['user_id', 'friend_id'],
    },
    profiles: { kind: 'owned_profile', ownerField: 'user_id' },
    messages: {
      kind: 'cross_reference',
      fields: ['user_id', 'sender_id', 'recipient_id'],
    },
    notifications: {
      kind: 'cross_reference',
      fields: ['recipient_id', 'actor_id'],
    },
    push_subscriptions: { kind: 'owned', ownerField: 'user_id' },
    account_deletions: { kind: 'control' },
  },
  buckets: {
    task_images: { kind: 'owned_permissions' },
  },
};

export function assertErasurePolicyCoversManifest({
  tables = MOSAIC_TABLES,
  bucket = MOSAIC_BUCKET,
  policy = ACCOUNT_ERASURE_POLICY,
} = {}) {
  const tableIds = tables.map((table) => table.id);
  const policyTableIds = Object.keys(policy.tables);
  const missingTables = tableIds.filter(
    (tableId) => !policyTableIds.includes(tableId)
  );
  const unknownTables = policyTableIds.filter(
    (tableId) => !tableIds.includes(tableId)
  );

  if (missingTables.length || unknownTables.length) {
    throw new Error(
      [
        missingTables.length
          ? `Missing erasure policy: ${missingTables.join(', ')}`
          : '',
        unknownTables.length
          ? `Unknown erasure policy table: ${unknownTables.join(', ')}`
          : '',
      ]
        .filter(Boolean)
        .join('; ')
    );
  }

  if (!policy.buckets?.[bucket.id]) {
    throw new Error(`Missing erasure policy for bucket ${bucket.id}`);
  }

  return true;
}
