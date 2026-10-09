/**
 * Bulk task actions are independent writes: one failure must not hide successful
 * changes, and only failed IDs remain selected for an explicit retry.
 * Do not replace allSettled with Promise.all or fire-and-forget writes.
 */
export async function runBulkTaskActions<T extends { id: string }>(
  tasks: readonly T[],
  action: (task: T) => Promise<unknown>
): Promise<Set<string>> {
  const results = await Promise.allSettled(tasks.map((task) => action(task)));
  return new Set(
    tasks.filter((_, index) => results[index]?.status === 'rejected').map((task) => task.id)
  );
}
