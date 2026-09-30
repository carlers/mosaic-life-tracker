import { Client, Query, TablesDB } from 'node-appwrite';

const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1')
  .setProject('6a9703c50016b37110ff')
  .setKey(process.env.APPWRITE_API_KEY);
const tablesDB = new TablesDB(client);
const databaseId = 'life_tracker';
const tableId = 'tasks';

async function ensureColumn() {
  try {
    await tablesDB.createIntegerColumn({ databaseId, tableId, key: 'order', required: false, min: 0, default: 0 });
    console.log('Added tasks.order');
  } catch (error) {
    if (!String(error?.message ?? error).includes('already exists')) throw error;
    console.log('tasks.order already exists');
  }
}

async function backfill() {
  const rows = [];
  let cursor;
  do {
    const queries = [Query.limit(100), Query.orderAsc('created_at'), Query.orderAsc('$id')];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await tablesDB.listRows({ databaseId, tableId, queries });
    rows.push(...page.rows);
    cursor = page.rows.at(-1)?.$id;
    if (page.rows.length < 100) break;
  } while (cursor);

  const next = new Map();
  for (const row of rows) {
    const group = `${row.user_id}\0${row.date}\0${row.category_id}`;
    const order = next.get(group) ?? 0;
    next.set(group, order + 1);
    // Re-running is safe and repairs partially completed backfills.
    if (row.order !== order) {
      await tablesDB.updateRow({ databaseId, tableId, rowId: row.$id, data: { order } });
    }
  }
  console.log(`Backfilled ${rows.length} task rows`);
}

await ensureColumn();
await backfill();
