import { Client, TablesDB } from 'node-appwrite';
const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1')
  .setProject('6a9703c50016b37110ff')
  .setKey(process.env.APPWRITE_API_KEY);
const tablesDB = new TablesDB(client);
const DATABASE_ID = 'life_tracker';
async function addColumn(tableId, key) {
  try {
    await tablesDB.createVarcharColumn({
      databaseId: DATABASE_ID,
      tableId,
      key,
      size: 50,
      required: false,
      default: '',
    });
    console.log(`✅ Added column ${tableId}.${key}`);
  } catch (err) {
    const msg = err.message ?? String(err);
    if (msg.includes('already exists')) {
      console.log(`ℹ️  Column ${tableId}.${key} already exists, skipping`);
    } else {
      throw err;
    }
  }
}
async function main() {
  try {
    await addColumn('categories', 'updated_at');
    await addColumn('settings', 'updated_at');
    console.log('🎉 Done');
  } catch (err) {
    console.error('❌ Migration failed:', err.message ?? err);
    process.exit(1);
  }
}
main();
