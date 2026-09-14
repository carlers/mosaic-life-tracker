import { Client, TablesDB } from 'node-appwrite';

const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1')
  .setProject('6a9703c50016b37110ff')
  .setKey(process.env.APPWRITE_API_KEY);

const tablesDB = new TablesDB(client);
const DATABASE_ID = 'life_tracker';

async function addColumn(def) {
  try {
    await tablesDB.createVarcharColumn({
      databaseId: DATABASE_ID,
      tableId: 'messages',
      key: def.key,
      size: def.size,
      required: false,
      default: '',
    });
    console.log(`✅ Added column ${def.key}`);
  } catch (err) {
    const msg = err.message ?? String(err);
    if (msg.includes('already exists')) {
      console.log(`ℹ️  Column ${def.key} already exists, skipping`);
    } else {
      throw err;
    }
  }
}

async function main() {
  try {
    await addColumn({ key: 'original_message_id', size: 255 });
    await addColumn({ key: 'reactions', size: 5000 });
    console.log('🎉 Done');
  } catch (err) {
    console.error('❌ Migration failed:', err.message ?? err);
    process.exit(1);
  }
}

main();