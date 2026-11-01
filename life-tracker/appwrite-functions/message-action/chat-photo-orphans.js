const { Permission, Query, Role } = require('node-appwrite');
const { chatPhotoFileId, deleteChatPhoto } = require('./chat-photo-auth');

const DATABASE = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const BUCKET = process.env.APPWRITE_STORAGE_BUCKET_ID || 'task_images';
const STALE_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const PAGE_SIZE = 25;
const MAX_PAGES = 4;

function ownerOfPrivatePhoto(file) {
  if (!/^chat_[a-zA-Z0-9_]{1,27}$/.test(file?.$id || '') ||
      file.name !== file.$id + '.webp' || file.mimeType !== 'image/webp') return null;
  const perms = file.$permissions || [];
  if (!Array.isArray(perms) || perms.length !== 3) return null;
  const read = perms.find(p => /^read\("user:[a-zA-Z0-9._-]{1,36}"\)$/.test(p));
  if (!read) return null;
  const owner = read.slice(11, -2);
  const expected = [Permission.read(Role.user(owner)),
    Permission.update(Role.user(owner)), Permission.delete(Role.user(owner))];
  return expected.every(p => perms.includes(p)) ? owner : null;
}

/** On the existing hourly maintenance trigger, reclaim only owner-private
 * chat upload files older than 14 days with no remotely committed sender row.
 *
 * Files granted to recipients are never eligible. Invalid storage metadata,
 * unexpected ACLs, transient DB errors and recent uploads all fail closed.
 */
async function cleanupAbandonedChatPhotos(db, storage, { now = new Date(), log = () => {} } = {}) {
  const bucket = await storage.getBucket({ bucketId: BUCKET });
  if (!bucket.fileSecurity || (bucket.$permissions || []).some(p => p.startsWith('read(')))
    throw Error('Unsafe bucket ACL: chat photo cleanup aborted');
  const cutoff = now.getTime() - STALE_AGE_MS;
  let scanned = 0, purged = 0, retained = 0, failed = 0;
  let cursor = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const queries = [
      Query.startsWith('name', 'chat_'),
      Query.orderAsc('$createdAt'),
      Query.limit(PAGE_SIZE),
    ];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const files = (await storage.listFiles({ bucketId: BUCKET, queries, total: false })).files || [];
    for (const file of files) {
      scanned++;
      const created = Date.parse(file.$createdAt || '');
      const owner = ownerOfPrivatePhoto(file);
      const messageId = 'msg_' + String(file.$id || '').slice(5);
      if (!owner || !Number.isFinite(created) || created > cutoff ||
          chatPhotoFileId(messageId) !== file.$id) { retained++; continue; }
      try {
        // A remotely committed sender message is evidence of a live or
        // partly-delivered pair. Do not touch it, even if metadata is unusual.
        await db.getRow({ databaseId: DATABASE, tableId: 'messages', rowId: messageId });
        retained++;
      } catch (cause) {
        if (Number(cause?.code) !== 404) { failed++; continue; }
        try {
          // Verify owner permissions again at the final delete boundary.
          await deleteChatPhoto(storage, owner, messageId, file.$id);
          purged++;
        } catch {
          failed++;
        }
      }
    }
    if (files.length < PAGE_SIZE) break;
    const next = files[files.length - 1]?.$id;
    if (!next || next === cursor) break;
    cursor = next;
  }
  log(`chat-photo-orphans scanned=${scanned} retained=${retained} purged=${purged} failed=${failed}`);
  return { scanned, retained, purged, failed };
}
module.exports = { cleanupAbandonedChatPhotos, ownerOfPrivatePhoto };
