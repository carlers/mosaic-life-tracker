const { Permission, Role } = require('node-appwrite');
const BUCKET = process.env.APPWRITE_STORAGE_BUCKET_ID || 'task_images';
function chatPhotoFileId(messageId) {
  if (typeof messageId !== 'string' || !/^msg_[A-Za-z0-9_]{1,27}$/.test(messageId)) return null;
  const fileId = 'chat_' + messageId.slice(4);
  return fileId.length <= 36 ? fileId : null;
}
async function grantChatPhoto(storage, senderId, recipientId, messageId, fileId) {
  if (!fileId || fileId !== chatPhotoFileId(messageId))
    return { status: 400, body: { error: 'Invalid chat photo ID' } };
  const required = [Permission.read(Role.user(senderId)), Permission.update(Role.user(senderId)),
    Permission.delete(Role.user(senderId))];
  const recipientRead = Permission.read(Role.user(recipientId));
  const allowed = [...required, recipientRead];
  try {
    const bucket = await storage.getBucket({ bucketId: BUCKET });
    if (bucket.fileSecurity !== true || (bucket.$permissions || []).some(p => p.startsWith('read(')))
      return { status: 503, body: { error: 'Private photo storage unavailable' } };
    const file = await storage.getFile({ bucketId: BUCKET, fileId });
    if (file.mimeType !== 'image/webp' || !Number.isFinite(file.sizeOriginal) ||
        file.sizeOriginal < 1 || file.sizeOriginal > 262144)
      return { status: 415, body: { error: 'Invalid chat photo data' } };
    const current = Array.isArray(file.$permissions) ? file.$permissions : [];
    if (!required.every(p => current.includes(p)) || current.some(p => !allowed.includes(p)))
      return { status: 403, body: { error: 'Invalid chat photo owner' } };
    if (!current.includes(recipientRead))
      await storage.updateFile({ bucketId: BUCKET, fileId, permissions: allowed });
    const verified = await storage.getFile({ bucketId: BUCKET, fileId });
    if (!allowed.every(p => (verified.$permissions || []).includes(p)) ||
        (verified.$permissions || []).some(p => !allowed.includes(p)))
      return { status: 503, body: { error: 'Chat photo authorization failed' } };
    return null;
  } catch (error) {
    return { status: Number(error?.code) === 404 ? 422 : 503,
      body: { error: 'Chat photo unavailable' } };
  }
}
async function deleteChatPhoto(storage, senderId, messageId, fileId) {
  if (fileId !== chatPhotoFileId(messageId)) throw Error('Invalid chat photo identity');
  try {
    const file = await storage.getFile({ bucketId: BUCKET, fileId });
    if (!(file.$permissions || []).includes(Permission.delete(Role.user(senderId)))) {
      throw Error('Photo owner mismatch');
    }
    await storage.deleteFile({ bucketId: BUCKET, fileId });
  } catch (error) {
    if (Number(error?.code) !== 404) throw error;
  }
}
module.exports = { chatPhotoFileId, grantChatPhoto, deleteChatPhoto };
