const crypto = require('crypto');
const { isScheduledTask } = require('./task-placement');
const { handleFriendship, deleteAccountFriendships } = require('./friendship');
const { handleTaskShares } = require('./task-shares');
const { handleTodoMateTaskBatch } = require('./todomate-task-batch');
const { handleOwnerWriteCas } = require('./owner-write-cas');
const { auditOwnerMedia } = require('./owner-media-audit');
const { reserveMediaUpload, confirmMediaUpload } = require('./media-provenance');
const { handleSubmitBugReport, handlePublishBugReport, pruneExpiredBugReports } = require('./bug-reports');
const {
  handleGetNotifications,
  handleGetNotification,
  handleGetPushConfig,
  handleGetPushDetails,
  handleSetPushDetails,
  handleMarkNotificationsRead,
  handleRegisterPushSubscription,
  handleTaskCompletionEvent,
  sendPushToUser,
  handleUnregisterPushSubscription,
} = require('./notifications');
const { emitActivity } = require('./activity-notifications');
const {
  Client,
  TablesDB,
  Storage,
  Users,
  Functions,
  Query,
  Permission,
  Role,
} = require('node-appwrite');
const { handleScheduledTombstoneGc } = require('./tombstone-gc');
const { grantChatPhoto, deleteChatPhoto, chatPhotoFileId } = require('./chat-photo-auth');
const { cleanupAbandonedChatPhotos } = require('./chat-photo-orphans');
const {
  isAccountDeletionPending,
  resumeDeletionJobs,
  startAccountDeletion,
} = require('./account-deletion');
const DATABASE_ID = process.env.APPWRITE_DATABASE_¶»§q«^