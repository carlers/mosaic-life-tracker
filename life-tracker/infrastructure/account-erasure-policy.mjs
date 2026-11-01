import {
  MOSAIC_BUCKET,
  MOSAIC_TABLES,
} from './mosaic-backend.mjs';

export const ACCOUNT_ERASURE_POLICY = {
  tables: {
    bucket_task_links: { kind: 'owned', ownerField: 'user_id' },
    media_uploads: { kind: 'cross_reference', fields: ['owner_id'] },
    bucket_list_items: { kind: 'owned', ownerField: 'user_id' },
    tasks: {
      kind: 'owned',
      ownerField: 'user_id',
      structuredScrubs: ['reactions'],
    },
    categories: { kind: 'owned', ownerField: 'user_id' },
    diary: { kind: 'owned', ownerField: 'user_id' },
    diary_reactions: { kind: 'cross_reference', fields: ['owner_id', 'user_id'] },
    settings: {
      kind: 'owned',
      ownerField: 'user_id',
      structuredScrubs: ['friend_carousel_prefs'],
    },
    task_shares: { kind: 'cross_reference', fields: ['owner_id', 'invitee_id'] },
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
    bug_reports: { kind: 'owned', ownerField: 'user_id' },
    account_deletions: { kind: 'control' },
  },
  buckets: {
    task_images: { kind: 'owned_permissions' },
  },
};

export function assertErasurePolicyCoversManif¶»§q«^