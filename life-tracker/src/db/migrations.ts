export const tasksMigrationStrategies = {
  1: (oldDoc: Record<string, unknown>) => oldDoc,
  // Existing tasks all start at order 0 so the legacy createdAt-desc tie-breaker
  // preserves the exact pre-reorder display order until a group is first sorted.
  2: (oldDoc: Record<string, unknown>) => ({
    ...oldDoc,
    order: 0,
  }),
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

export const syncMetaMigrationStrategies = {
  1: (oldDoc: Record<string, unknown>) => {
    const { collection, ...rest } = oldDoc;
    return {
      ...rest,
      collectionName: collection,
    };
  },
};
