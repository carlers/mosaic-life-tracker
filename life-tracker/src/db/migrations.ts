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
  // v3 -> v4: optional, typed diary reference metadata; never rewrite body text.
  4: (oldDoc: Record<string, unknown>) => ({
    ...oldDoc,
    diaryRefId: '', diaryRefOwnerId: '', diaryRefDate: '', diaryRefExcerpt: '',
  }),
  // v4 -> v5: keep original message text, but drop previously cached diary excerpts.
  5: (oldDoc: Record<string, unknown>) => ({
    ...oldDoc, diaryRefEpoch: 0, diaryRefExcerpt: '', attachmentType: '', attachmentFileId: '',
  }),
  // v5 -> v6: upgrade pre-photo message stores without erasing queued photo references.
  6: (oldDoc: Record<string, unknown>) => ({
    ...oldDoc,
    attachmentType: oldDoc.attachmentType ?? '',
    attachmentFileId: oldDoc.attachmentFileId ?? '',
  }),
};
export const categoriesMigrationStrategies = {
  1: (oldDoc: Record<string, unknown>) => ({
    ...oldDoc,
    updatedAt: '',
  }),
  2: (oldDoc: Record<string, unknown>) => ({ ...oldDoc, retiredOn: '' }),
};
export const diaryMigrationStrategies = {
  1: (oldDoc: Record<string, unknown>) => ({ ...oldDoc, emoji: '' }),
  2: (oldDoc: Record<string, unknown>) => ({ ...oldDoc, photos: '[]' }),
};

export const settingsMigrationStrategies = {
  1: (oldDoc: Record<string, unknown>) => ({
    ...oldDoc,
    updatedAt: '',
  }),
};

export const syncMetaMigrationStrategies = {
  // v2 -> v3: collectionName enum includes bucketTaskLinks. Keep all prior
  // replication freshness records intact; the new pilot creates its own row.
  3: (oldDoc: Record<string, unknown>) => oldDoc,
  2: (oldDoc: Record<string, unknown>) => oldDoc,
  1: (oldDoc: Record<string, unknown>) => {
    const { collection, ...rest } = oldDoc;
    return {
      ...rest,
      collectionName: collection,
    };
  },
};
