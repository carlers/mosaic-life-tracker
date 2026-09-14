import { Client, TablesDB } from 'node-appwrite';

const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1')
  .setProject('6a9703c50016b37110ff')
  .setKey(process.env.APPWRITE_API_KEY);

const tablesDB = new TablesDB(client);
const DATABASE_ID = 'life_tracker';

async function addReplyColumns() {
  const columns = [
    { key: 'reply_to_id', size: 255 },
    { key: 'reply_to_content', size: 300 },
    { key: 'reply_to_sender_id', size: 255 },
  ];

  for (const col of columns) {
    try {
      await tablesDB.createVarcharColumn({
        databaseId: DATABASE_ID,
        tableId: 'messages',
        key: col.key,
        size: col.size,
        required: false,
        default: '',
      });
      console.log(`✅ Added column ${col.key}`);
    } catch (err) {
      const msg = err.message ?? String(err);
      if (msg.includes('already exists')) {
        console.log(`ℹ️  Column ${col.key} already exists, skipping`);
      } else {
        throw err;
      }
    }
  }
}

async function main() {
  try {
    await addReplyColumns();
    console.log('🎉 All reply columns added');
  } catch (err) {
    console.error('❌ Migration failed:', err.message ?? err);
    process.exit(1);
  }
}

main();