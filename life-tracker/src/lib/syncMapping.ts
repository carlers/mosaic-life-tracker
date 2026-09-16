type AppwriteRow = Record<string, unknown>;
type AppwritePayload = Record<string, unknown>;

export function toAppwriteFormat(
  doc: Record<string, unknown>,
  collection: string,
  userId: string
): AppwritePayload {
  const source: Record<string, unknown> = { ...doc };
  delete source._meta;
  delete source._deleted;
  delete source._rev;
  const mapped: AppwritePayload = {};
  if (collection === 'tasks') {
    mapped.title = source.title || '';
    mapped.is_completed = source.completed ?? false;
    mapped.category_id = source.categoryId || '';
    mapped.tags = source.tags || '';
    mapped.date = source.date || '';
    mapped.memo = source.memo || '';
    mapped.image = source.image || '';
    mapped.created_at = source.createdAt || new Date().toISOString();
    mapped.completed_at = source.completedAt || '';
    mapped.updated_at = source.updatedAt || new Date().toISOString();
    mapped.user_id = userId;
    mapped.deleted = source.isDeleted ?? false;
    mapped.visibility = source.visibility ?? '';
    mapped.source = source.source || '';
    mapped.routine_id = source.routineId || '';
    mapped.reminder_time = source.reminderTime || '';
    mapped.reactions = source.reactions || '';
  } else if (collection === 'categories') {
    mapped.name = source.name || '';
    mapped.color = source.color || '#3B82F6';
    mapped.visibility = source.visibility || 'private';
    mapped.order = source.order ?? 0;
    mapped.user_id = userId;
    mapped.deleted = source.isDeleted ?? false;
    mapped.icon = source.icon || '';
  } else if (collection === 'diary') {
    mapped.date = source.date || '';
    mapped.content = source.content || '';
    mapped.visibility = source.visibility || 'private';
    mapped.user_id = userId;
    mapped.deleted = source.isDeleted ?? false;
    mapped.created_at = source.createdAt || new Date().toISOString();
    mapped.updated_at = source.updatedAt || new Date().toISOString();
  } else if (collection === 'settings') {
    mapped.user_id = userId;
    mapped.key = source.key || '';
    mapped.value = source.value || '';
    mapped.deleted = source.isDeleted ?? false;
  } else if (collection === 'friendships') {
    mapped.user_id = userId;
    mapped.friend_id = source.friendId || '';
    mapped.friend_username = source.friendUsername || '';
    mapped.friend_display_name = source.friendDisplayName || '';
    mapped.friend_avatar_file_id = source.friendAvatarFileId || '';
    mapped.friend_bio = source.friendBio || '';
    mapped.status = source.status || 'pending_outgoing';
    mapped.created_at = source.createdAt || new Date().toISOString();
    mapped.updated_at = source.updatedAt || new Date().toISOString();
    mapped.deleted = source.isDeleted ?? false;
  } else if (collection === 'messages') {
    mapped.user_id = userId;
    mapped.thread_id = source.threadId || '';
    mapped.sender_id = source.senderId || '';
    mapped.recipient_id = source.recipientId || '';
    mapped.direction = source.direction || 'outgoing';
    mapped.content = source.content || '';
    mapped.task_ref_id = source.taskRefId || '';
    mapped.task_ref_title = source.taskRefTitle || '';
    mapped.task_ref_date = source.taskRefDate || '';
    mapped.task_ref_color = source.taskRefColor || '';
    mapped.reply_to_id = source.replyToId || '';
    mapped.reply_to_content = source.replyToContent || '';
    mapped.reply_to_sender_id = source.replyToSenderId || '';
    mapped.is_unsent = source.isUnsent ?? false;
    mapped.original_message_id = source.originalMessageId || '';
    mapped.reactions = source.reactions || '';
    if (source.direction !== 'outgoing') {
      mapped.read_at = source.readAt || '';
    }
    mapped.delivery_status = source.deliveryStatus || 'delivered';
    mapped.created_at = source.createdAt || new Date().toISOString();
    mapped.updated_at = source.updatedAt || new Date().toISOString();
    mapped.deleted = source.isDeleted ?? false;
  }
  return mapped;
}

export function fromAppwriteFormat(
  row: AppwriteRow,
  collection: string
): Record<string, unknown> {
  const mapped: Record<string, unknown> = { ...row };
  delete mapped.$id;
  delete mapped.$createdAt;
  delete mapped.$updatedAt;
  delete mapped.$permissions;
  delete mapped.$databaseId;
  delete mapped.$tableId;
  delete mapped.$sequence;
  if (collection === 'tasks') {
    mapped.id = row.$id || mapped.id;
    mapped.completed = mapped.is_completed ?? false;
    mapped.categoryId = mapped.category_id || '';
    mapped.createdAt = mapped.created_at || new Date().toISOString();
    mapped.completedAt = mapped.completed_at || '';
    mapped.updatedAt = mapped.updated_at || new Date().toISOString();
    mapped.userId = mapped.user_id;
    mapped.isDeleted = mapped.deleted ?? false;
    mapped.visibility = (row.visibility as string) ?? '';
    mapped.source = row.source || '';
    mapped.tags = row.tags || '';
    mapped.memo = row.memo || '';
    mapped.image = row.image || '';
    mapped.routineId = row.routine_id || '';
    mapped.reminderTime = row.reminder_time || '';
    mapped.reactions = row.reactions || '';
    delete mapped.is_completed;
    delete mapped.category_id;
    delete mapped.created_at;
    delete mapped.completed_at;
    delete mapped.updated_at;
    delete mapped.user_id;
    delete mapped.deleted;
    delete mapped.routine_id;
    delete mapped.reminder_time;
  } else if (collection === 'categories') {
    mapped.id = row.$id || mapped.id;
    mapped.userId = mapped.user_id;
    mapped.isDeleted = mapped.deleted ?? false;
    mapped.icon = row.icon || '';
    delete mapped.user_id;
    delete mapped.deleted;
  } else if (collection === 'diary') {
    mapped.id = row.$id || mapped.id;
    mapped.userId = mapped.user_id;
    mapped.isDeleted = mapped.deleted ?? false;
    mapped.createdAt = mapped.created_at || new Date().toISOString();
    mapped.updatedAt = mapped.updated_at || new Date().toISOString();
    mapped.content = row.content || '';
    delete mapped.user_id;
    delete mapped.deleted;
    delete mapped.created_at;
    delete mapped.updated_at;
  } else if (collection === 'settings') {
    mapped.id = row.$id || mapped.id;
    mapped.userId = mapped.user_id;
    mapped.isDeleted = mapped.deleted ?? false;
    delete mapped.user_id;
    delete mapped.deleted;
  } else if (collection === 'friendships') {
    mapped.id = row.$id || mapped.id;
    mapped.userId = mapped.user_id;
    mapped.friendId = mapped.friend_id || '';
    mapped.friendUsername = mapped.friend_username || '';
    mapped.friendDisplayName = mapped.friend_display_name || '';
    mapped.friendAvatarFileId = mapped.friend_avatar_file_id || '';
    mapped.friendBio = mapped.friend_bio || '';
    mapped.status = mapped.status || 'pending_outgoing';
    mapped.createdAt = mapped.created_at || new Date().toISOString();
    mapped.updatedAt = mapped.updated_at || new Date().toISOString();
    mapped.isDeleted = mapped.deleted ?? false;
    delete mapped.user_id;
    delete mapped.friend_id;
    delete mapped.friend_username;
    delete mapped.friend_display_name;
    delete mapped.friend_avatar_file_id;
    delete mapped.friend_bio;
    delete mapped.created_at;
    delete mapped.updated_at;
    delete mapped.deleted;
  } else if (collection === 'messages') {
    mapped.id = row.$id || mapped.id;
    mapped.userId = mapped.user_id;
    mapped.threadId = mapped.thread_id || '';
    mapped.senderId = mapped.sender_id || '';
    mapped.recipientId = mapped.recipient_id || '';
    mapped.direction = mapped.direction || 'outgoing';
    mapped.content = mapped.content || '';
    mapped.taskRefId = mapped.task_ref_id || '';
    mapped.taskRefTitle = mapped.task_ref_title || '';
    mapped.taskRefDate = mapped.task_ref_date || '';
    mapped.taskRefColor = mapped.task_ref_color || '';
    mapped.replyToId = mapped.reply_to_id || '';
    mapped.replyToContent = mapped.reply_to_content || '';
    mapped.replyToSenderId = mapped.reply_to_sender_id || '';
    mapped.isUnsent = mapped.is_unsent ?? false;
    mapped.originalMessageId = mapped.original_message_id || '';
    mapped.reactions = mapped.reactions || '';
    mapped.readAt = mapped.read_at || '';
    mapped.deliveryStatus = mapped.delivery_status || 'delivered';
    mapped.createdAt = mapped.created_at || new Date().toISOString();
    mapped.updatedAt = mapped.updated_at || new Date().toISOString();
    mapped.isDeleted = mapped.deleted ?? false;
    delete mapped.user_id;
    delete mapped.thread_id;
    delete mapped.sender_id;
    delete mapped.recipient_id;
    delete mapped.task_ref_id;
    delete mapped.task_ref_title;
    delete mapped.task_ref_date;
    delete mapped.task_ref_color;
    delete mapped.reply_to_id;
    delete mapped.reply_to_content;
    delete mapped.reply_to_sender_id;
    delete mapped.is_unsent;
    delete mapped.original_message_id;
    delete mapped.read_at;
    delete mapped.delivery_status;
    delete mapped.created_at;
    delete mapped.updated_at;
    delete mapped.deleted;
  }
  return mapped;
}
