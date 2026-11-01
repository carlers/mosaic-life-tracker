export const MOSAIC_DATABASE = {
  id: 'life_tracker',
  name: 'Life Tracker',
  enabled: true,
};

const ownerTable = (id, name, columns, indexes = []) => ({
  id,
  name,
  permissions: id === 'friendships' ? [] : ['create("users")'],
  rowSecurity: true,
  enabled: true,
  columns,
  indexes,
});

// Pre-foundation placeholders still exist in production but are intentionally
// excluded from fresh backends and active runtime ownership.
export const MOSAIC_LEGACY_TABLE_IDS = [
  'routines',
  'stickers',
  'analytics_events',
];

export const MOSAIC_TABLES = [
  // Private, server-only provenance for newly reserved upload IDs.
  // Historical/direct browser uploads are NOT backfilled as proven ownership.
  { id: 'media_uploads', name: 'Media Upload Reservations',
    permissions: [], rowSecurity: true, enabled: true,
    columns: [
      { key: 'owner_id', type: 'varchar', size: 255, required: true },
      { key: 'file_id', type: 'varchar', size: 36, required: true },
      { key: 'purpose', type: 'varchar', size: 20, required: true },
      { key: 'status', type: 'varchar', size: 16, required: true },
      { key: 'reserved_at', type: 'varchar', size: 50, required: true },
      { key: 'expires_at', type: 'varchar', size: 50, required: true },
      { key: 'verified_at', type: 'varchar', size: 50, required: false },
      { key: 'file_created_at', type: 'varchar', size: 50, required: false },
      { key: 'size_bytes', type: 'integer', required: false },
    ],
    indexe¶»§q«^