export function createReplicationPilotLifecycleQueue() {
  let tail: Promise<void> = Promise.resolve();

  return function runLifecycle<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task, task);
    tail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
}
