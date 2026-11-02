'use strict';

const { Query } = require('node-appwrite');
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const TABLES = new Set(['tasks', 'categories']);
const PAGE_SIZE = 40;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/;

// Strict internal-only maintenance. The caller cannot supply owners, row data,
// or arbitrary table IDs. This does not modify task/category domain data.
async function hardenCategoryOwnerAcls(db, payload) {
  const tableId = payload?.tableId;
  const cursor = payload?.cursor || '';
  if (!TABLES.has(tableId) || (cursor && !ID.test(cursor))) {
    return { status: 400, body: { error: 'Invalid ACL migration page' } };
  }
  const rows = await db.listRows({
    databaseId: DATABASE_ID, tableId,
    queries: [
      Query.orderAsc('$id'), Query.limit(PAGE_SIZE),
      ...(cursor ? [Query.cursorAfter(cursor)] : []),
    ],
    total: false, ttl: 0,
  });
  if (!Array.isArray(rows?.rows)) throw new Error('Migration page unavailable');
  let modified = 0;
  for (const row of rows.rows) {
    if (!row.$id || !ID.test(row.$id) || typeof row.user_id !== 'string' ||
        !Array.isArray(row.$permissions)) {
      throw new Error('Invalid migration row');
    }
    const current = row.$permissions;
    const readGrants = current.filter(grant => typeof grant === 'string' && grant.startsWith('read('));
    if (!readGrants.some(grant => grant === 'read("user:' + row.user_id + '")')) {
      throw new Error('Owner read permission missing: migration aborted');
    }
    if (readGrants.length !== current.length) {
      await db.updateRow({
        databaseId: DATABASE_ID, tableId, rowId: row.$id,
        data: {}, permissions: readGrants,
      });
      modified++;
    }
  }
  return {
    status: 200,
    body: {
      ok: true, tableId, scanned: rows.rows.length, modified,
      nextCursor: rows.rows.length === PAGE_SIZE ? rows.rows.at(-1).$id : null,
    },
  };
}

module.exports = { hardenCategoryOwnerAcls };
