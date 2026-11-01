const crypto = require('crypto');
const { Query } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const JOBS_TABLE = process.env.APPWRITE_TABLE_ACCOUNT_DELETIONS || 'account_deletions';
const BUCKET_ID = process.env.APPWRITE_STORAGE_BUCKET_ID || 'task_images';
const DR_FUNCTION_ID = process.env.DR_BACKUP_FUNCTION_ID || 'dr_backup';
const DR_REQUIRED = process.env.DR_PRIVACY_DELETION_REQUIRED !== 'false';
const PAGE_SIZE = 100;
const MAX_PAGES = 1000;
const DELETE_CONCURRENCY = 8;

const OWNED_TABLES = ['tasks', 'categories', 'diary', 'settings', 'bucket_list_items', 'bucket_task_links', 'push_subscriptions', 'bug_reports'];
const CROSS_REFERENCE_QUERIES = {
  media_uploads: ['owner_id'],
  diary_reactions: ['owner_id', 'user_id'],
  task_shares: ['owner_id', 'invitee_id'],
  friendships: ['user_id', 'friend_id'],
  messages: ['user_id', 'sender_id', 'recipient_id'],
  notifications: ['recipient_id', 'actor_id'],
};

function deletionJobId(userId) {
  return 'del_' + crypto.createHash('sha256').update(userId).digest('hex').slice(0, 32);
}

function isNotFound(error) {
  return Number(error && error.code) === 404;
}

async function readRow(db, tableId, rowId, transactionId) {
  try {
    return await db.getRow({
      databaseId: DATABASE_ID,
      tableId,
      rowId,
      ...(transactionId ? { transactionId } : {}),
    });
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function ¶»§q«^