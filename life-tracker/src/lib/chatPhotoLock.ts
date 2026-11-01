/**
 * Serialize each media send/cancel across same-origin tabs. Never claim a safe
 * cross-tab cancellation if Web Locks is unavailable; text messages unchanged.
 */
export async function withChatPhotoSendLock<T>(
  userId: string,
  messageId: string,
  operation: () => Promise<T>
): Promise<T> {
  if (!userId || !/^msg_[A-Za-z0-9_]{1,27}$/.test(messageId))
    throw Object.assign(new Error('Invalid photo send identity'), { code: 400 });
  if (typeof navigator === 'undefined' || !navigator.locks?.request)
    throw Object.assign(new Error('Photo messages require browser lock support'), { code: 422 });
  return navigator.locks.request('mosaic-photo:' + userId + ':' + messageId, { mode: 'exclusive' }, operation);
}
