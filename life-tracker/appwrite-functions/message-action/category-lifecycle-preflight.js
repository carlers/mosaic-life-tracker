const { Query } = require('node-appwrite');

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'life_tracker';
const VALID_CATEGORY_ID = /^[a-zA-Z0-9_]{1,36}$/;

// Read-only: count persisted live tasks for one authenticated owner.
// Does not claim to account for offline queues or authorize deletion.
async function handleCategoryLifecyclePreflight(db, callerId, payload) {
  const categoryId = payload?.categoryId;
  if (!VALID_CATEGORY_ID.test(categoryId || '')) {
    return { status: 400, body: { error: 'Invalid category reference' } };
  }

  let category;
  try {
    category = await db.getRow({
      databaseId: DATABASE_ID, tableId: 'categories', rowId: categoryId,
    });
  } catch (error) {
    if (error?.code === 404) {
      return { status: 404, body: { error: 'Category not found' } };
    }
    throw error;
  }

  // The same response for a missing, foreign-owner, or deleted category.
  if (!category || category.user_id !== callerId || category.deleted === true) {
    return { status: 404, body: { error: 'Category not found' } };
  }

  const page = await db.listRows({
    databaseId: DATABASE_ID,
    tableId: 'tasks',
    queries: [
      Query.equal('user_id', callerId),
      Query.equal('category_id', categoryId),
      Query.equal('deleted', false),
      Query.limit(1),
    ],
    total: true,
    ttl: 0,
  });

  // Never substitute the page length for the complete persisted count.
  if (!Number.isSafeInteger(page?.total) || page.total < 0) {
    return { status: 503, body: { error: 'Category task inventory unavailable' } };
  }

  return {
    status: 200,
    body: {
      ok: true,
      categoryId,
      persistedTaskCount: page.total,
      scope: 'synced_server_rows_only',
      safeToDelete: false,
    },
  };
}

module.exports = { handleCategoryLifecyclePreflight };
