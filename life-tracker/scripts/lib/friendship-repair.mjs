import { createHash } from 'node:crypto';

export const friendshipId = (owner, friend) => `fr_${createHash('sha256').update(`${owner}|${friend}`).digest('hex').slice(0, 32)}`;
export const ownerRead = owner => [`read("user:${owner}")`];
export function planFriendshipRepair(rows, profiles, now) {
  const byId = new Map(rows.map(row => [row.$id, row]));
  const profileByUser = new Map(profiles.filter(p => !p.deleted).map(p => [p.user_id, p]));
  const changes = [];
  const ambiguous = [];
  const valid = row => typeof row.user_id === 'string' && typeof row.friend_id === 'string' &&
    row.user_id !== row.friend_id && row.$id === friendshipId(row.user_id, row.friend_id);
  for (const row of rows) {
    if (!valid(row)) { ambiguous.push({ id: row.$id, reason: 'Invalid deterministic identity' }); continue; }
    const permissions = ownerRead(row.user_id);
    if (JSON.stringify(row.$permissions) !== JSON.stringify(permissions)) {
      changes.push({ id: row.$id, before: row, data: { updated_at: now }, permissions });
    }
    const reverseId = friendshipId(row.friend_id, row.user_id);
    const reverse = byId.get(reverseId);
    if (reverse) {
      const consistent = row.deleted === reverse.deleted && (row.status === reverse.status && ['accepted', 'blocked'].includes(row.status) ||
        row.status === 'pending_incoming' && reverse.status === 'pending_outgoing' ||
        row.status === 'pending_outgoing' && reverse.status === 'pending_incoming' || row.deleted && reverse.deleted);
      if (!consistent) ambiguous.push({ id: row.$id, reason: 'Conflicting pair; state preserved' });
      continue;
    }
    if (row.deleted || row.status === 'blocked') continue;
    if (!['pending_incoming', 'pending_outgoing'].includes(row.status) || !profileByUser.has(row.user_id) || !profileByUser.has(row.friend_id)) {
      ambiguous.push({ id: row.$id, reason: 'Missing peer or active profile; state preserved' }); continue;
    }
    const friendProfile = profileByUser.get(row.user_id);
    // Touch the source in the same transaction even if its ACL was already
    // correct, so concurrent cancellation cannot race peer reconstruction.
    if (!changes.some(change => change.id === row.$id)) {
      changes.push({ id: row.$id, before: row, data: { updated_at: now }, permissions });
    }
    changes.push({ id: reverseId, before: null, sourceId: row.$id, sourceBefore: row,
      permissions: ownerRead(row.friend_id), data: {
        user_id: row.friend_id, friend_id: row.user_id,
        friend_username: friendProfile.username || '', friend_display_name: friendProfile.display_name || friendProfile.username || '',
        friend_avatar_file_id: friendProfile.avatar_file_id || '', friend_bio: friendProfile.bio || '',
        status: row.status === 'pending_incoming' ? 'pending_outgoing' : 'pending_incoming',
        deleted: false, created_at: row.created_at || now, updated_at: now,
      } });
  }
  return { version: 1, changes, ambiguous };
}

export async function applyFriendshipRepair(db, databaseId, tableId, plan) {
  // One transaction protects the audited set, including absence of reconstructed rows.
  if (!plan.changes.length) return;
  if (plan.changes.length > 90) throw new Error('Repair exceeds transaction safety limit; split into audited batches');
  const tx = await db.createTransaction({ ttl: 60 });
  const read = async rowId => {
    try { return await db.getRow({ databaseId, tableId, rowId, transactionId: tx.$id }); }
    catch (error) { if (error.code === 404) return null; throw error; }
  };
  const same = (a, b) => a === null && b === null || a && b && a.$updatedAt === b.$updatedAt &&
    JSON.stringify(a.$permissions) === JSON.stringify(b.$permissions) && a.status === b.status && a.deleted === b.deleted &&
    a.user_id === b.user_id && a.friend_id === b.friend_id;
  try {
    for (const change of plan.changes) {
      if (!same(await read(change.id), change.before) || change.sourceId && !same(await read(change.sourceId), change.sourceBefore)) {
        throw new Error(`Friendship changed since audit: ${change.id}`);
      }
    }
    for (const change of plan.changes) {
      const args = { databaseId, tableId, rowId: change.id, data: change.data, permissions: change.permissions, transactionId: tx.$id };
      if (change.before) await db.updateRow(args); else await db.createRow(args);
    }
    await db.updateTransaction({ transactionId: tx.$id, commit: true });
  } catch (error) {
    await db.updateTransaction({ transactionId: tx.$id, rollback: true }).catch(() => {});
    throw error;
  }
}
