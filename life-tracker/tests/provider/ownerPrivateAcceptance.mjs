/**
 * #967/#975: portable, owner-private backend contract executed with *actual*
 * provider principal/session adapters. No provider SDK, network, or secrets.
 *
 * Deliberately scoped to tasks/categories until another domain implements a
 * reviewed authorization model. Other six domains MUST NOT silently pass.
 */
export const OWNER_PRIVATE_ACCEPTANCE_DOMAINS = Object.freeze(['categories', 'tasks']);

function ensure(condition, message) {
  if (!condition) throw new Error('Provider acceptance: ' + message);
}
function validRevision(value) {
  ensure(typeof value === 'string' || typeof value === 'number',
    'missing provider revision');
  // Postgres bigint cursors must never be rounded through JavaScript number.
  // REST often sends int8 as text; reject numeric values outside safe range.
  if (typeof value === 'number')
    ensure(Number.isSafeInteger(value), 'unsafe numeric provider revision');
  const text = String(value);
  ensure(/^\d+$/.test(text), 'invalid provider revision');
  const n = BigInt(text);
  ensure(n > 0n, 'nonpositive provider revision');
  return n;
}
function isOwned(row, principal, id) {
  return row && row.owner_id === principal.id && row.id === id &&
    typeof row.is_deleted === 'boolean';
}
function assertDenied(result, operation) {
  ensure(result === 'denied', operation + ' did not deny access');
}
function assertConflict(result, operation) {
  ensure(result?.state === 'conflict', operation + ' changed a protected master');
}

export async function runOwnerPrivateProviderAcceptance({
  domain, principals, fixtures, adapter,
}) {
  ensure(OWNER_PRIVATE_ACCEPTANCE_DOMAINS.includes(domain),
    'domain lacks a reviewed signed private-owner backend contract: ' + domain);
  ensure(principals?.a?.id && principals?.b?.id &&
    principals.a.id !== principals.b.id, 'two distinct verified principals required');
  ensure(fixtures?.a?.[domain] && fixtures?.b?.[domain],
    'both owners need real domain fixtures');
  const originals = {};
  for (const label of ['a', 'b']) {
    const principal = principals[label];
    const rows = fixtures[label][domain];
    ensure(Array.isArray(rows) && rows.length === 2 &&
      rows.some(row => row.is_deleted === true) &&
      rows.some(row => row.is_deleted === false),
    'each principal requires one active and one soft-deleted row');
    originals[label] = [];
    for (const body of rows) {
      ensure(body.owner_id === principal.id,
        'fixture owner does not match verified principal');
      const created = await adapter.create(domain, principal, body);
      ensure(isOwned(created, principal, body.id) &&
        created.is_deleted === body.is_deleted, 'create changed identity or tombstone');
      validRevision(created.change_seq);
      originals[label].push(created);
    }
  }

  let checks = 0;
  const activeA = originals.a.find(row => !row.is_deleted);
  const deletedA = originals.a.find(row => row.is_deleted);
  const bActive = originals.b.find(row => !row.is_deleted);
  ensure(activeA && deletedA && bActive, 'missing active/tombstone fixtures');

  for (const label of ['a', 'b']) {
    const principal = principals[label];
    const other = principals[label === 'a' ? 'b' : 'a'];
    const own = await adapter.read(domain, principal, principal.id);
    ensure(Array.isArray(own) && own.length === 2 &&
      originals[label].every(expected => own.some(row =>
        isOwned(row, principal, expected.id) &&
        row.is_deleted === expected.is_deleted)),
    'owner cannot read its active and tombstone rows');
    checks++;
    const foreign = await adapter.read(domain, principal, other.id);
    ensure(Array.isArray(foreign) && foreign.length === 0,
      'cross-owner signed read leaked rows');
    checks++;
    assertDenied(await adapter.forgedInsert(domain, principal,
      fixtures[label === 'a' ? 'b' : 'a'][domain][0]),
    'forged foreign-owner INSERT');
    checks++;
  }

  const field = domain === 'tasks' ? 'title' : 'name';
  const patch = { [field]: 'synthetic owner CAS update' };
  assertConflict(await adapter.cas(domain, principals.b, activeA.id,
    String(activeA.change_seq), patch), 'foreign-owner guessed-ID CAS');
  checks++;
  assertDenied(await adapter.anonRead(domain, principals.a.id),
    'anonymous owner read');
  checks++;
  assertDenied(await adapter.anonCas(domain, activeA.id, String(activeA.change_seq), patch),
    'anonymous privileged RPC');
  checks++;
  for (const method of ['PATCH', 'DELETE']) {
    assertDenied(await adapter.directWrite(domain, principals.a, activeA, method),
      'direct authenticated ' + method);
    checks++;
  }

  const applied = await adapter.cas(domain, principals.a, activeA.id,
    String(activeA.change_seq), patch);
  ensure(applied?.state === 'applied' &&
    isOwned(applied.row, principals.a, activeA.id) &&
    applied.row[field] === patch[field] &&
    validRevision(applied.row.change_seq) > validRevision(activeA.change_seq),
  'valid owner CAS did not advance exactly its own master');
  checks++;
  assertConflict(await adapter.cas(domain, principals.a, activeA.id,
    String(activeA.change_seq), { [field]: 'stale overwrite' }),
  'stale signed CAS');
  checks++;

  // Cursor is scoped to the owner, is sorted and preserves the tombstone.
  const changes = await adapter.changes(domain, principals.a,
    String(activeA.change_seq));
  ensure(Array.isArray(changes) && changes.some(row =>
    isOwned(row, principals.a, deletedA.id) && row.is_deleted) &&
    changes.some(row =>
      isOwned(row, principals.a, activeA.id) &&
      row[field] === patch[field]),
  'incremental replay lost the tombstone or authorized CAS');
  let last = validRevision(activeA.change_seq);
  for (const row of changes) {
    ensure(row.owner_id === principals.a.id, 'cursor leaked foreign owner');
    const revision = validRevision(row.change_seq);
    ensure(revision > last, 'cursor was duplicate, unordered, or stale');
    last = revision;
  }
  checks++;

  const finalA = await adapter.read(domain, principals.a, principals.a.id);
  ensure(finalA.length === 2 && finalA.some(row =>
    row.id === activeA.id && row[field] === patch[field]) &&
    finalA.some(row => row.id === deletedA.id && row.is_deleted),
  'failed CAS or unauthorized write modified master unexpectedly');
  checks++;

  return { domain, checks, signedOwners: 2, recordsCreated: 4 };
}
