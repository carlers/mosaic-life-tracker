import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const table = MOSAIC_TABLES.find((entry) => entry.id === 'push_subscriptions');
const expected = table?.columns.find((entry) => entry.key === 'include_task_details');

export async function migratePushDetails({
  request,
  databaseId = MOSAIC_DATABASE.id,
  log = () => {},
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  if (!expected) throw new Error('Missing push details column manifest');
  const tablePath = `/tablesdb/${databaseId}/tables/push_subscriptions`;
  const existingTable = await request('GET', tablePath);
  if (existingTable?.$id !== 'push_subscriptions') {
    throw new Error('Push subscriptions table missing');
  }
  const columnPath = `${tablePath}/columns/${expected.key}`;
  let current = null;
  try {
    current = await request('GET', columnPath);
  } catch (error) {
    if (Number(error?.status) !== 404) throw error;
  }
  if (!current) {
    log('Creating private-by-default push details column...');
    await request('POST', `${tablePath}/columns/boolean`, {
      key: expected.key, required: false, default: false, array: false,
    });
  }
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const value = await request('GET', columnPath);
    if (value?.type !== expected.type || value?.required !== expected.required ||
        value?.default !== expected.default || value.status === 'failed') {
      throw new Error('Incompatible push details column');
    }
    if (!value.status || value.status === 'available') {
      return { created: !current };
    }
    await sleep(500);
  }
  throw new Error('Push details column did not become available');
}
