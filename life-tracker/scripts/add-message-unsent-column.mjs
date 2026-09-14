import { Client, TablesDB } from 'node-appwrite';

const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1')
  .setProject('6a9703c50016b37110ff')
  .setKey(process.env.APPWRITE_API_KEY);

const tablesDB = new TablesDB(client);
const DATABASE_ID = 'life_tracker';

async function addUnsentColumn() {
  try {
    await tablesDB.createBooleanColumn({
      databaseId: DATABASE_ID,
      tableId: 'messages',
      key: 'is_unsent',
      required: false,
      default: false,
    });
    console.log('✅ Added column is_unsent');
  } catch (err) {
    const msg = err.message ?? String(err);
    if (msg.includes('already exists')) {
      console.log('ℹ️  Column is_unsent already exists, skipping');
    } else {
      throw err;
    }
  }
}

async function main() {
  try {
    await addUnsentColumn();
    console.log('🎉 Done');
  } catch (err) {
    console.error('❌ Migration failed:', err.message ?? err);
    process.exit(1);
  }
}

main();