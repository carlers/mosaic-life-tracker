import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const columns = MOSAIC_TABLES.find(table => table.id === 'messages')?.columns
  .filter(column => column.key === 'attachment_type' || column.key === 'attachment_file_id') || [];

/** Expand-only: old clients still write text without any media metadata. */
export async function migrateMessageChatPhotos({
  request, log = () => {}, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
}) {
  if (columns.length !== 2) throw new Error('Missing optional chat photo columns');
  const path = `/tablesdb/${MOSAIC_DATABASE.id}/tables/messages`;
  const getOptional = async url => {
    try { return await request('GET', url); }
    catch (error) { if (Number(error?.status) === 404) return null; throw error; }
  };
  if (!await getOptional(path)) throw new Error('Messages table missing');
  const created = [];
  for (const column of columns) {
    const columnPath = `${path}/columns/${column.key}`;
    let existing = await getOptional(columnPath);
    if (!existing) {
      log(`Creating optional messages.${column.key}`);
      await request('POST', path + '/columns/varchar', {
        key: column.key, size: column.size, required: false,
        default: '', array: false, encrypt: false,
      });
      created.push(column.key);
    }
    for (let attempt = 0; attempt < 60; attempt++) {
      existing = await getOptional(columnPath);
      if (existing) {
        for (const field of ['key', 'type', 'size', 'required', 'default']) {
          if ((existing[field] ?? null) !== (column[field] ?? null)) {
            throw new Error(`Incompatible messages.${column.key}: ${field}`);
          }
        }
        if (existing.status === 'failed') throw new Error(`messages.${column.key} provisioning failed`);
        if (!existing.status || existing.status === 'available') break;
      }
      if (attempt === 59) throw new Error(`messages.${column.key} unavailable`);
      await sleep(500);
    }
  }
  return { created };
}
