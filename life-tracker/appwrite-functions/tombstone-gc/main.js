const { Client, TablesDB, Query } = require('node-appwrite');

const DATABASE_ID = 'life_tracker';
const TABLES = [
  'tasks',
  'categories',
  'diary',
  'settings',
  'friendships',
  'messages',
];
const DEFAULT_RETENTION_DAYS = 90;
const PAGE_SIZE = 100;
const MAX_PAGES_PER_TABLE = 100;

function retentionDays() {
  const raw = Number(process.env.TOMBSTONE_RETENTION_DAYS || DEFAULT_RETENTION_DAYS);
  if (!Number.isFinite(raw) || raw < 1 || raw > 3650) {
    throw new Error('TOMBSTONE_RETENTION_DAYS must be between 1 and 3650');
  }
  return Math.floor(raw);
}

function cutoffIso(now = new Date()) {
  const cutoff = new Date(
    now.getTime() - retentionDays() * 24 * 60 * 60 * 1000
  );
  return cutoff.toISOString();
}

async function purgeTable(tablesDB, tableId, cutoff, log) {
  let cursor;
  let pages = 0;
  let scanned = 0;
  let purged = 0;

  for (;;) {
    const queries = [
      Query.equal('deleted', true),
      Query.lessThan('updated_at', cutoff),
      Query.limit(PAGE_SIZE),
      Query.orderAsc('$id'),
    ];
    if (cursor) queries.push(Query.cursorAfter(cursor));

    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries,
      total: false,
    });
    const rows = response.rows || [];
    if (rows.length === 0) break;

    scanned += rows.length;
    for (const row of rows) {
      await tablesDB.deleteRow({
        databaseId: DATABASE_ID,
        tableId,
        rowId: row.$id,
      });
      purged++;
    }

    pages++;
    if (rows.length < PAGE_SIZE) break;

    const lastId = rows[rows.length - 1].$id;
    if (!lastId || lastId === cursor) {
      log(`tombstone-gc: stopping ${tableId}; cursor did not advance`);
      break;
    }
    cursor = lastId;

    if (pages >= MAX_PAGES_PER_TABLE) {
      log(
        `tombstone-gc: hit page cap ${MAX_PAGES_PER_TABLE} for ${tableId}`
      );
      break;
    }
  }

  return { scanned, purged };
}

async function runGc(tablesDB, cutoff, log) {
  const results = {};
  for (const tableId of TABLES) {
    results[tableId] = await purgeTable(tablesDB, tableId, cutoff, log);
  }
  return results;
}

const handler = async ({ req, res, log, error }) => {
  try {
    const cutoff = cutoffIso();
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(req.headers['x-appwrite-key']);
    const tablesDB = new TablesDB(client);

    log(
      `tombstone-gc: starting with retentionDays=${retentionDays()} cutoff=${cutoff}`
    );
    const results = await runGc(tablesDB, cutoff, log);
    const totals = Object.values(results).reduce(
      (acc, value) => ({
        scanned: acc.scanned + value.scanned,
        purged: acc.purged + value.purged,
      }),
      { scanned: 0, purged: 0 }
    );

    log(
      `tombstone-gc: complete scanned=${totals.scanned} purged=${totals.purged}`
    );
    return res.json({
      ok: true,
      retentionDays: retentionDays(),
      cutoff,
      results,
      totals,
    });
  } catch (err) {
    error(`tombstone-gc failed: ${err.message}`);
    return res.json({ error: 'Tombstone garbage collection failed' }, 500);
  }
};

handler.__test = { cutoffIso, purgeTable, runGc, retentionDays };
module.exports = handler;
