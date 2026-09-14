import { Client, TablesDB, Permission, Role } from 'node-appwrite';

const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1')
  .setProject('6a9703c50016b37110ff')
  .setKey(process.env.APPWRITE_API_KEY);

const tablesDB = new TablesDB(client);
const DATABASE_ID = 'life_tracker';

async function createMessagesTable() {
  await tablesDB.createTable({
    databaseId: DATABASE_ID,
    tableId: 'messages',
    name: 'Messages',
    permissions: [Permission.create(Role.users())],
    rowSecurity: true,
    columns: [
      { key: 'user_id', type: 'varchar', size: 255, required: true },
      { key: 'thread_id', type: 'varchar', size: 50, required: true },
      { key: 'sender_id', type: 'varchar', size: 255, required: true },
      { key: 'recipient_id', type: 'varchar', size: 255, required: true },
      { key: 'direction', type: 'varchar', size: 20, required: true },
      { key: 'content', type: 'varchar', size: 4000, required: false, default: '' },
      { key: 'task_ref_id', type: 'varchar', size: 255, required: false, default: '' },
      { key: 'task_ref_title', type: 'varchar', size: 500, required: false, default: '' },
      { key: 'task_ref_date', type: 'varchar', size: 50, required: false, default: '' },
      { key: 'task_ref_color', type: 'varchar', size: 20, required: false, default: '' },
      { key: 'read_at', type: 'varchar', size: 50, required: false, default: '' },
      { key: 'delivery_status', type: 'varchar', size: 20, required: false, default: 'delivered' },
      { key: 'created_at', type: 'varchar', size: 50, required: false, default: '' },
      { key: 'updated_at', type: 'varchar', size: 50, required: false, default: '' },
      { key: 'deleted', type: 'boolean', required: false, default: false },
    ],
    indexes: [
      { key: 'idx_user_thread_created', type: 'key', attributes: ['user_id', 'thread_id', 'created_at'] },
      { key: 'idx_user_deleted', type: 'key', attributes: ['user_id', 'deleted'] },
      { key: 'idx_thread_created', type: 'key', attributes: ['thread_id', 'created_at'] },
    ],
  });
  console.log('✅ messages table created');
}

async function main() {
  try {
    await createMessagesTable();
  } catch (err) {
    console.error('❌ Setup failed:', err.message ?? err);
    process.exit(1);
  }
}

main();