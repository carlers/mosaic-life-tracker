function rowLabel(row: Record<string, unknown>): string {
  return typeof row.$id === 'string' && row.$id ? row.$id : '<unknown>';
}

export function assertRemoteRowOwnedBy(
  row: Record<string, unknown>,
  userId: string,
  label: string
): void {
  if (row.user_id === userId) return;
  throw new Error(
    `${label} replication remote owner mismatch for ${rowLabel(row)}`
  );
}

export function assertRemoteRowsOwnedBy(
  rows: Record<string, unknown>[],
  userId: string,
  label: string
): void {
  for (const row of rows) {
    assertRemoteRowOwnedBy(row, userId, label);
  }
}
