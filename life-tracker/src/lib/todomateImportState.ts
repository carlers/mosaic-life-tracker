export type TodoMateImportPhase = 'applying' | 'applied';

export interface TodoMateImportMarker {
  version: 1;
  userId: string;
  phase: TodoMateImportPhase;
  startedAt: string;
  appliedAt?: string;
  expected: {
    tasks: number;
    categories: number;
    diary: number;
    photos: number;
  };
}

const STORAGE_PREFIX = 'mosaic_todomate_import_v1_';

function key(userId: string): string {
  return STORAGE_PREFIX + userId;
}

export function readTodoMateImportMarker(userId: string): TodoMateImportMarker | null {
  if (!userId || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TodoMateImportMarker>;
    if (
      parsed.version !== 1 ||
      parsed.userId !== userId ||
      (parsed.phase !== 'applying' && parsed.phase !== 'applied') ||
      typeof parsed.startedAt !== 'string' ||
      !parsed.expected ||
      typeof parsed.expected.tasks !== 'number' ||
      typeof parsed.expected.categories !== 'number' ||
      typeof parsed.expected.diary !== 'number' ||
      typeof parsed.expected.photos !== 'number'
    ) {
      localStorage.removeItem(key(userId));
      return null;
    }
    return parsed as TodoMateImportMarker;
  } catch {
    return null;
  }
}

function write(marker: TodoMateImportMarker): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key(marker.userId), JSON.stringify(marker));
  } catch {}
}

export function beginTodoMateImport(
  userId: string,
  expected: TodoMateImportMarker['expected']
): void {
  write({
    version: 1,
    userId,
    phase: 'applying',
    startedAt: new Date().toISOString(),
    expected,
  });
}

export function markTodoMateImportApplied(userId: string): void {
  const marker = readTodoMateImportMarker(userId);
  if (!marker) return;
  write({
    ...marker,
    phase: 'applied',
    appliedAt: new Date().toISOString(),
  });
}

export function clearTodoMateImportMarker(userId: string): void {
  if (!userId || typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(key(userId));
  } catch {}
}
