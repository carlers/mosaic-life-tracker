import { Client, TablesDB, Query } from 'node-appwrite';
import { writeFile } from 'node:fs/promises';
import { planFriendshipRepair, applyFriendshipRepair } from './lib/friendship-repair.mjs';

const args = process.argv.slice(2);
const value = name => args[args.indexOf(name) + 1];
const project = args.includes('--target-project') && value('--target-project');
const endpoint = process.env.APPWRITE_TARGET_ENDPOINT;
const key = process.env.APPWRITE_TARGET_API_KEY;
const apply = args.includes('--apply');
const beforeFile = args.includes('--before-file') && value('--before-file');
const recoverySnapshot = args.includes('--recovery-snapshot') && value('--recovery-snapshot');
if (!project || !endpoint || !key || apply && (!beforeFile || !recoverySnapshot)) {
  throw new Error('Requires --target-project, APPWRITE_TARGET_ENDPOINT/API_KEY; --apply also requires --before-file and --recovery-snapshot (verified recovery point).');
}
const db = new TablesDB(new Client().setEndpoint(endpoint).setProject(project).setKey(key));
const databaseId = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const tableId = process.env.APPWRITE_TABLE_FRIENDSHIPS || 'friendships';
async function all(table) {
  const rows = [];
  let cursor;
  for (;;) {
    const page = await db.listRows({ databaseId, tableId: table, queries: [Query.limit(100), Query.orderAsc('$id'), ...(cursor ? [Query.cursorAfter(cursor)] : [])] });
    rows.push(...page.rows);
    if (page.rows.length < 100) return rows;
    cursor = page.rows.at(-1).$id;
  }
}
const rows = await all(tableId);
const profiles = await all(process.env.APPWRITE_TABLE_PROFILES || 'profiles');
const table = await db.getTable({ databaseId, tableId });
const plan = planFriendshipRepair(rows, profiles, new Date().toISOString());
console.log(JSON.stringify({ project, apply, rows: rows.length, changes: plan.changes.length, ambiguous: plan.ambiguous }, null, 2));
if (apply) {
  if (plan.ambiguous.length) throw new Error('Resolve ambiguous pairs before permission cutover');
  await writeFile(beforeFile, JSON.stringify({ version: 1, project, recoverySnapshot, table, rows, plan }, null, 2), { mode: 0o600, flag: 'wx' });
  await applyFriendshipRepair(db, databaseId, tableId, plan);
  await db.updateTable({ databaseId, tableId, name: table.name, permissions: [], rowSecurity: true });
  const check = planFriendshipRepair(await all(tableId), profiles, new Date().toISOString());
  if (check.changes.length || check.ambiguous.length) throw new Error('Post-repair verification failed');
  console.log('Friendships repaired and browser writes disabled.');
}
