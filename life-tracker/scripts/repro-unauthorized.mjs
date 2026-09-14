// scripts/repro-unauthorized.mjs
import { Client, TablesDB } from 'node-appwrite';

const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1') // ⚠️ Confirm your region
  .setProject('6a9703c50016b37110ff')           // ⚠️ Confirm your project ID
  .setKey(process.env.APPWRITE_API_KEY);        // ⚠️ Must be set

const tablesDB = new TablesDB(client);

async function repro() {
  try {
    const result = await tablesDB.createTable({
      databaseId: 'life_tracker',
      tableId: 'repro_test_table_' + Date.now(), // Unique ID to avoid collisions
      name: 'Repro Test',
      permissions: [],        // No permissions – keep it minimal
      rowSecurity: false,     // Disable row security
      columns: [],            // ⚠️ Empty columns
      indexes: [],            // ⚠️ Empty indexes
    });
    console.log('✅ SUCCESS:', result);
  } catch (err) {
    console.error('❌ FAILED:', err.message ?? err);
    console.error('Full error:', err);
  }
}

repro();