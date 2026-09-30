export const tasksMigrationStrategies = {
  1: (oldDoc: Record<string, unknown>) => oldDoc,
  // RxDB migrates one document at a time, so encode the existing creation
  // sequence directly. The ID hash makes equal timestamps stable and distinct.
  2: (oldDoc: Record<string, unknown>) => {
    const timestamp = Math.max(0, Date.parse(String(oldDoc.createdAt || '')) || 0);
    const id = String(oldDoc.id || '');
    let tieBreaker = 0;
    for (let index = 0; index < id.length; index += 1) {
      tieBreaker = (tieBreaker * 31 + id.charCodeAt(index)) % 1000;
    }
    return { ...oldDoc, order: timestamp * 1000 + tieBreaker };
  },
};
export const friendshipsMigrationStrategies = {
  1: (oldDoc: Record<string, unknown>) => ({
    ...oldDoc,
    friendBio: '',
  }),
};
export const messagesMigrationStrategies = {
  1: (oldDoc: Record<string, unknown>) => ({
    ...oldDoc,
    replyToId: '',
    replyToContent: '',
    replyToSenderId: '',
  }),
  2: (oldDoc: Record<string, unknown>) => ({
    ...oldDoc,
    isUnsent: false,
  }),
  3: (oldDoc: Record<string, unknown>) => ({
    ...oldDoc,
    originalMessageId: '',
    reactions: '',
  }),
};
export const categoriesMigrationStrategies = {
  1: (oldDoc: Record<string, unknown>) => ({
    ...oldDoc,
    updatedAt: '',
  }),
};
export const settingsMigrationStrategies = {
  1: (oldDoc: Record<string, unknown>) => ({
    ...oldDoc,
    updatedAt: '',
  }),
};
