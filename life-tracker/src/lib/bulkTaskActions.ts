/**
 * Bounded, failure-tolerant task batch execution.
 *
 * Each task is independent. Keep a small fixed number of local RxDB writes in
 * flight so large selections do not flood mobile devices, and wait for every
 * started write before reporting completion or allowing a retry.
 */
export interface BulkTaskActionProgress {
  completed: number;
  total: number;
  failed: number;
}

export const BULK_TASK_ACTION_CONCURRENCY = 6;

export async function runBulkTaskActions<T extends { id: string }>(
  tasks: readonly T[],
  action: (task: T) => Promise<unknown>,
  onProgress?: (progress: BulkTaskActionProgress) => void
): Promise<Set<string>> {
  const failedIds = new Set<string>();
  let cursor = 0;
  let completed = 0;

  const report = () => {
    try {
      onProgress?.({ completed, total: tasks.length, failed: failedIds.size });
    } catch {
      // Progress is observational and must never interrupt durable task writes.
    }
  };

  report();

  const worker = async () => {
    while (cursor < tasks.length) {
      const index = cursor++;
      const task = tasks[index]!;
      try {
        await action(task);
      } catch {
        failedIds.add(task.id);
      } finally {
        completed += 1;
        // Cap React observer churn for very large selections; final is exact.
        if (completed === tasks.length ||
            completed % Math.max(1, Math.ceil(tasks.length / 20)) === 0) {
          report();
        }
      }
    }
  };

  const workerCount = Math.min(BULK_TASK_ACTION_CONCURRENCY, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  // Return failed IDs in the original selection order, not completion order.
  return new Set(tasks.filter(task => failedIds.has(task.id)).map(task => task.id));
}
