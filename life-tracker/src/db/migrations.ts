export const tasksMigrationStrategies = {
  1: (oldDoc: Record<string, unknown>) => oldDoc,
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
