import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';
import { assertCompatibleIndex } from './migrate-account-deletion.mjs';

const table = MOSAIC_TABLES.find((entry) => entry.id === 'notifications');
const expected = table?.indexes.find((index) => index.key === 'idx_notification_created');

export async function migrateNotificationRetentionIndex({
  request,
  databaseId = MOSAIC_DATABASE.id,
  log = () => {},
}) {
  if (!expected) throw new Error('Missing notification retention index manifest');
  const tablePath = `/tablesdb/${databaseId}/tables/notifications`;
  const table = await request('GET', tablePath);
  if (table?.$id !== 'notifications') throw new Error('Notifications table missing');
  const path = `${tablePath}/indexes/${expected.key}`;
  let current;
  try {
    current = await request('GET', path);
  } catch (error) {
    if (Number(error?.status) !== 404) throw error;
  }
  if (!current) {
    log('Creating notification retention index...');
    await request('POST', `${tablePath}/indexes`, {
      key: expected.key,
      type: expected.type,
      columns: expected.attributes,
    });
    return { created: true };
  }
  assertCompatibleIndex(current, expected, 'notifications');
  if (current.status === 'failed') throw new Error('Notification retention index failed provisioning');
  return { created: false };
}
