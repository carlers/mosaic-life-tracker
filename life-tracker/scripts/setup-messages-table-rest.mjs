// scripts/setup-messages-table-rest.mjs

const ENDPOINT = 'https://sgp.cloud.appwrite.io/v1';
const PROJECT_ID = '6a9703c50016b37110ff';
const DATABASE_ID = 'life_tracker';
const API_KEY = process.env.APPWRITE_API_KEY;

if (!API_KEY) {
  console.error('❌ APPWRITE_API_KEY is not set');
  process.exit(1);
}

const url = `${ENDPOINT}/tablesdb/${DATABASE_ID}/tables`;

const body = {
  tableId: 'messages',
  name: 'Messages',
  permissions: ['create("users")'],
  rowSecurity: true,
  enabled: true,
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
};

async function createTable() {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Appwrite-Project': PROJECT_ID,
      'X-Appwrite-Key': API_KEY,
      'X-Appwrite-Response-Format': '1.9.5',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('❌ Setup failed:', data.message ?? data);
    console.error('Status:', res.status);
    process.exit(1);
  }

  console.log('✅ messages table created');
  console.log(data);
}

createTable().catch((err) => {
  console.error('❌ Request error:', err);
  process.exit(1);
});