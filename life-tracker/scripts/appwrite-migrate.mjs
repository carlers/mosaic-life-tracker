#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import {
  assertConfirmedProject,
  createAppwriteAdminRequest,
  flagValue,
  parseBackendTarget,
} from './lib/appwrite-backend.mjs';
import { migrateBucketTaskLinksBackend } from './migrate-bucket-task-links.mjs';
import { migrateBucketListBackend } from './migrate-bucket-list.mjs';
import { migrateAccountDeletionBackend } from './migrate-account-deletion.mjs';
import { migrateDiaryCreatedAtBackend } from './migrate-diary-created-at.mjs';
import { migrateDiaryEmojiBackend } from './migrate-diary-emoji.mjs';
import { migrateDiaryPhotosBackend } from './migrate-diary-photos.mjs';
import { migrateDiaryReactionsBackend } from './migrate-diary-reactions.mjs';
import { migrateMessageDiaryReferences } from './migrate-message-diary-references.mjs';
import { migrateMessageChatPhotos } from './migrate-message-chat-photos.mjs';
import { migrateDiaryQuotePrivacy } from './migrate-diary-quote-privacy.mjs';
import { migrateBugReportsBackend } from './migrate-bug-reports.mjs';
import { migratePublicBugReportBackend } from './migrate-public-bug-report.mjs';
import { migrateTaskImagesBucketPermissions } from './migrate-task-images-bucket-permissions.mjs';
import { migrateNotificationsBackend } from './migrate-notifications.mjs';
import { migrateNotificationRetentionIndex } from './migrate-notification-retention.mjs';
import { migratePushDetails } from './migrate-push-details.mjs';
import { migrateTaskSharesBackend } from './¶»§q«^