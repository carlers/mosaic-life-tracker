import { Client, TablesDB, ID, Permission, Role } from 'node-appwrite';

const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1')
  .setProject('6a9703c50016b37110ff')
  .setKey(process.env.APPWRITE_API_KEY); // ← from Console → Overview → API Keys

const tablesDB = new TablesDB(client);

const DATABASE_ID = 'life_tracker';

async function createFriendshipsTable() {
  await tablesDB.createTable({
    databaseId: DATABASE_ID,
    tableId: 'friendships',
    name: 'Friendships',
    permissions: [Permission.create(Role.users())], // create only; row-level handles the rest
    rowSecurity: true,
    columns: [
      { key: 'user_id', type: 'varchar', size: 255, required: true },
      { key: 'friend_id', type: 'varchar', size: 255, required: true },
      { key: 'friend_username', type: 'varchar', size: 50, required: false, default: '' },
      { key: 'friend_display_name', type: 'varchar', size: 100, required: false, default: '' },
      { key: 'friend_avatar_file_id', type: 'varchar', size: 255, required: false, default: '' },
      { key: 'status', type: 'varchar', size: 30, required: true },
      { key: 'created_at', type: 'varchar', size: 50, required: false, default: '' },
      { key: 'updated_at', type: 'varchar', size: 50, required: false, default: '' },
      { key: 'deleted', type: 'boolean', required: false, default: false },
    ],
    indexes: [
      { key: 'idx_user_status', type: 'key', attributes: ['user_id', 'status'] },
      { key: 'idx_user_id', type: 'key', attributes: ['user_id'] },
      { key: 'idx_friend_id', type: 'key', attributes: ['friend_id'] },
    ],
  });
  console.log('✅ friendships table created');
}

async function createProfilesTable() {
  await tablesDB.createTable({
    databaseId: DATABASE_ID,
    tableId: 'profiles',
    name: 'Profiles',
    permissions: [Permission.create(Role.users())],
    rowSecurity: true,
    columns: [
      { key: 'user_id', type: 'varchar', size: 255, required: true },
      { key: 'username', type: 'varchar', size: 50, required: true },
      { key: 'display_name', type: 'varchar', size: 100, required: false, default: '' },
      { key: 'avatar_file_id', type: 'varchar', size: 255, required: false, default: '' },
      { key: 'bio', type: 'varchar', size: 300, required: false, default: '' },
      { key: 'is_searchable', type: 'boolean', required: false, default: true },
      { key: 'created_at', type: 'varchar', size: 50, required: false, default: '' },
      { key: 'updated_at', type: 'varchar', size: 50, required: false, default: '' },
      { key: 'deleted', type: 'boolean', required: false, default: false },
    ],
    indexes: [
      { key: 'idx_username_unique', type: 'unique', attributes: ['username'] },
      { key: 'idx_user_id_unique', type: 'unique', attributes: ['user_id'] },
      { key: 'idx_username_key', type: 'key', attributes: ['username'] },
    ],
  });
  console.log('✅ profiles table created');
}

async function main() {
  try {
    await createFriendshipsTable();
    await createProfilesTable();
  } catch (err) {
    console.error('❌ Setup failed:', err.message ?? err);
    process.exit(1);
  }
}

main();