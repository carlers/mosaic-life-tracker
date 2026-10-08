// Server-authoritative, recipient-scoped preferences for the Alerts feed.
// Settings rows are already replicated by Mosaic; no duplicate policy table.
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const DEFAULT_UNREAD_DAYS = 7;
const DEFAULT_READ_HOURS = 24;
const UNREAD_DAY_OPTIONS = Object.freeze([1, 3, 7, 14, 30]);
const READ_HOUR_OPTIONS = Object.freeze([1, 12, 24, 72, 168]);
const MAX_RECEIPT_RETENTION_MS = (30 + 7) * DAY_MS;
const UNREAD_SETTING_KEY = 'alertsUnreadRetentionDays';
const READ_SETTING_KEY = 'alertsReadRetentionHours';
const DEFAULT_POLICY = Object.freeze({
  unreadDays: DEFAULT_UNREAD_DAYS,
  readHours: DEFAULT_READ_HOURS,
});

function resolveChoice(value, allowed, fallback) {
  return typeof value === 'number' &&
    Number.isInteger(value) && allowed.includes(value) ? value : fallback;
}

function parseSetting(row, ownerId, key, choices, fallback) {
  if (!row || row.user_id !== ownerId || row.key !== key || row.deleted === true) return fallback;
  try {
    return resolveChoice(JSON.parse(row.value), choices, fallback);
  } catch {
    return fallback;
  }
}

// Mirrors src/lib/settingsRowId.ts. IDs must be exactly those written by
// useSettings, including the hash-based fallback for long Appwrite user IDs.
function makeSettingsRowId(userId, key) {
  const raw = `${userId}_${key}`;
  if (raw.length <= 36) return raw;
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + c) | 0;
    h2 = ((h2 << 5) + h2 + c * 31) | 0;
  }
  return `s_${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}

function isNotFound(error) {
  return Number(error && (error.code ?? error.status)) === 404;
}

async function loadAlertRetention(tablesDB, recipientId) {
  const keys = [UNREAD_SETTING_KEY, READ_SETTING_KEY];
  const rows = await Promise.all(keys.map(async (key) => {
    try {
      return await tablesDB.getRow({
        databaseId: process.env.APPWRITE_DATABASE_ID || 'life_tracker',
        tableId: 'settings',
        rowId: makeSettingsRowId(recipientId, key),
      });
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }));
  return {
    unreadDays: parseSetting(rows[0], recipientId, UNREAD_SETTING_KEY, UNREAD_DAY_OPTIONS, DEFAULT_UNREAD_DAYS),
    readHours: parseSetting(rows[1], recipientId, READ_SETTING_KEY, READ_HOUR_OPTIONS, DEFAULT_READ_HOURS),
  };
}

function notificationExpiresAt(row, policy = DEFAULT_POLICY) {
  const arrived = Date.parse(row.created_at || row.occurred_at);
  if (!Number.isFinite(arrived)) return 0;
  const hardCap = arrived + MAX_RECEIPT_RETENTION_MS;
  const read = Date.parse(row.read_at || '');
  const expires = Number.isFinite(read)
    ? read + resolveChoice(policy.readHours, READ_HOUR_OPTIONS, DEFAULT_READ_HOURS) * HOUR_MS
    : arrived + resolveChoice(policy.unreadDays, UNREAD_DAY_OPTIONS, DEFAULT_UNREAD_DAYS) * DAY_MS;
  return Math.min(hardCap, expires);
}

module.exports = {
  DEFAULT_POLICY,
  DEFAULT_UNREAD_DAYS,
  DEFAULT_READ_HOURS,
  UNREAD_DAY_OPTIONS,
  READ_HOUR_OPTIONS,
  UNREAD_SETTING_KEY,
  READ_SETTING_KEY,
  MAX_RECEIPT_RETENTION_MS,
  makeSettingsRowId,
  loadAlertRetention,
  notificationExpiresAt,
};
