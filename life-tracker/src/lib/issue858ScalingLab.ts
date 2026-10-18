import { getDatabase } from '../db/database';
import type { TaskDocument } from '../db/schema';

// #858 diagnostic ONLY: a synthetic-account guard prevents the seed helpers
// operating on a real account. This module never enters accepted dev/main.
const LAB_OWNER = 'issue858_scale_user';
type Distribution = 'dense' | 'month' | 'years';
type LabWindow = Window & {
  __mosaic858Seed?: (count: number, distribution: Distribution) => Promise<{
    count: number; distribution: Distribution; activeDay: string; activeMonthCount: number;
  }>;
  __mosaic858ReadProbe?: () => Promise<{
    count: number; currentMonthCount: number; timings: Array<{
      allSortedMs: number; currentMonthMs: number;
      serialThreeMonthsMs: number; parallelThreeMonthsMs: number;
      serialCount: number; parallelCount: number;
    }>;
  }>;
};

function ownerId(): string {
  const cached: unknown = JSON.parse(localStorage.getItem('mosaic_last_known_user') ?? 'null');
  const id = cached && typeof cached === 'object' && '$id' in cached
    ? (cached as { $id?: unknown }).$id : null;
  if (id !== LAB_OWNER || import.meta.env.VITE_MOSAIC_858_SCALING_LAB !== '1' ||
      sessionStorage.getItem('mosaic_858_fixture_mode') !== '1') {
    throw new Error('Issue 858 synthetic owner required');
  }
  return id;
}
const dateKey = (date: Date): string => [
  date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-');
const bounds = (offset: number): [string, string] => {
  const now = new Date();
  return [
    dateKey(new Date(now.getFullYear(), now.getMonth() + offset, 1)),
    dateKey(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)),
  ];
};

export function installScalingLab(): void {
  const root = window as LabWindow;
  root.__mosaic858Seed = async (count, distribution) => {
    const userId = ownerId();
    if (!Number.isSafeInteger(count) || count < 0 || count > 1000 ||
        !['dense', 'month', 'years'].includes(distribution)) {
      throw new Error('Invalid bounded synthetic fixture');
    }
    const db = getDatabase();
    const cats = await db.categories.find({
      selector: { userId, isDeleted: false },
    }).exec();
    if (cats.length !== 1) throw new Error('Expected exactly one synthetic category');
    const existing = await db.tasks.find({ selector: { userId, isDeleted: false } }).exec();
    if (existing.length) throw new Error('Fixture must start from clean synthetic owner');
    const now = new Date();
    const activeDay = dateKey(now);
    const createdAt = '2026-01-01T00:00:00.000Z';
    const docs: TaskDocument[] = Array.from({ length: count }, (_, i) => {
      const date = distribution === 'dense'
        ? activeDay
        : distribution === 'month'
          ? dateKey(new Date(now.getFullYear(), now.getMonth(), 1 + (i % 28)))
          : dateKey(new Date(now.getFullYear() - 2 + (i % 5),
            (i * 7) % 12, 1 + ((i * 11) % 28)));
      return {
        id: 'issue858_task_' + String(i).padStart(5, '0'),
        title: 'Scaling fixture ' + String(i).padStart(5, '0'),
        completed: false, categoryId: cats[0].id, order: i,
        date, createdAt, updatedAt: createdAt, userId,
        isDeleted: false, visibility: '',
      };
    });
    if (docs.length) {
      const result = await db.tasks.bulkInsert(docs);
      if (result.error.length) throw new Error('Fixture RxDB insert rejected ' + result.error.length);
      if (result.success.length !== count) throw new Error('Fixture count mismatch');
    }
    const reloaded = await db.tasks.find({ selector: { userId, isDeleted: false } }).exec();
    if (reloaded.length !== count) throw new Error('Fixture failed persisted-count check');
    return { count, distribution, activeDay,
      activeMonthCount: reloaded.filter(t => t.date >= bounds(0)[0] && t.date <= bounds(0)[1]).length };
  };

  root.__mosaic858ReadProbe = async () => {
    const userId = ownerId();
    const db = getDatabase();
    const windows = [-1, 0, 1].map(bounds);
    const readWindow = ([lo, hi]: [string, string]) => db.tasks.find({
      selector: { userId, isDeleted: false, date: { $gte: lo, $lte: hi } },
    }).exec();
    const readAll = () => db.tasks.find({
      selector: { userId, isDeleted: false },
      sort: [{ date: 'asc' }, { createdAt: 'desc' }],
    }).exec();
    const all = await readAll();
    const currentMonthCount = all.filter(t =>
      t.date >= windows[1][0] && t.date <= windows[1][1]).length;
    const timed = async <T>(work: () => Promise<T>) => {
      const start = performance.now();
      const value = await work();
      return { elapsed: Math.round((performance.now() - start) * 100) / 100, value };
    };
    const timings = [];
    for (let i = 0; i < 6; i++) {
      // Alternate execution order to avoid a permanent cold-first bias.
      const allSorted = await timed(readAll);
      const current = await timed(() => readWindow(windows[1]));
      const serial = () => (async () => {
        const out = [];
        for (const window of windows) out.push(await readWindow(window));
        return out;
      })();
      const parallel = () => Promise.all(windows.map(readWindow));
      const first = i % 2 ? parallel : serial;
      const second = i % 2 ? serial : parallel;
      const a = await timed(first);
      const b = await timed(second);
      const serialResult = i % 2 ? b : a;
      const parallelResult = i % 2 ? a : b;
      const serialCount = serialResult.value.reduce((n, rows) => n + rows.length, 0);
      const parallelCount = parallelResult.value.reduce((n, rows) => n + rows.length, 0);
      if (serialCount !== parallelCount || current.value.length !== currentMonthCount) {
        throw new Error('Date-scoped queries changed task semantics');
      }
      timings.push({
        allSortedMs: allSorted.elapsed,
        currentMonthMs: current.elapsed,
        serialThreeMonthsMs: serialResult.elapsed,
        parallelThreeMonthsMs: parallelResult.elapsed,
        serialCount, parallelCount,
      });
    }
    return { count: all.length, currentMonthCount, timings };
  };
}
