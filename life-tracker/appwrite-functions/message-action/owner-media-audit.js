'use strict';

// Read-only server audit for Phase 3B. This never authorizes deletion.
// It inventories referenced task/Diary/profile media and counts only files
// with unambiguous user-specific update+delete grants as ACL-controlled.
// A grant is NOT a durable ownership/provenance record.
const { Query } = require('node-appwrite');
const { ownerReferenceIndex, assessMediaLifecycle } = require('./media-lifecycle');
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const BUCKET_ID = process.env.APPWRITE_STORAGE_BUCKET_ID || 'task_images';
const PAGE_SIZE = 100;
const MAX_ROW_PAGES_PER_TABLE = 10;
const MAX_BUCKET_PAGES = 10;
const TABLES = ['tasks', 'diary', 'settings'];
const FILE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/;
function validFileId(id) {
  return typeof id === 'string' && FILE_ID.test(id) &&
    !id.startsWith('localimg_');
}

function soleOwnerControl(permissions, ownerId) {
  if (!Array.isArray(permissions)) return false;
  const requiredUpdate = 'update("user:' + ownerId + '")';
  const requiredDelete = 'delete("user:' + ownerId + '")';
  return permissions.includes(requiredUpdate) &&
    permissions.includes(requiredDelete) &&
    !permissions.some((p) => typeof p !== 'string' ||
      (/^(update|delete|write)\(/.test(p) &&
        p !== requiredUpdate && p !== requiredDelete));
}

async function paginate(fetchPage, cap) {
  const items = [];
  const seenIds = new Set();
  let cursor = null;
  for (let page = 0; page < cap; page++) {
  ¶»§q«^