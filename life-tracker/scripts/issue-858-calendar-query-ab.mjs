import { readFile, writeFile } from 'node:fs/promises';

// #858 diagnostic-only mutation of CI checkout. Keep selectors and all rows
// identical; compare native RxDB sort vs local JS sort. Never deploy this bundle.
const path = 'src/hooks/useTasks.ts';
const original = await readFile(path, 'utf8');
const anchor = "    sort: [{ date: 'asc' }, { createdAt: 'desc' }],";
if (original.split(anchor).length !== 2) throw new Error('Unexpected useTasks sort contract');
const replacement = `    sort: (window as QueryAuditWindow).__mosaic858QueryVariant === 'unsorted'
      ? undefined : [{ date: 'asc' }, { createdAt: 'desc' }],
    map: (window as QueryAuditWindow).__mosaic858QueryVariant === 'unsorted'
      ? locallySortTaskDocuments : undefined,`;
const declaration = `
type QueryAuditWindow = Window & { __mosaic858QueryVariant?: 'baseline' | 'unsorted' };
const locallySortTaskDocuments = (docs: TaskDocument[]): TaskDocument[] =>
  [...docs].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1
    : a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0);
`;
const mark = 'export function useTasks(enabled = true) {';
if (original.split(mark).length !== 2) throw new Error('Unexpected useTasks entry point');
await writeFile(path, original.replace(mark, declaration + '\n' + mark).replace(anchor, replacement));
console.log('Diagnostic dual RxDB-query strategy (one throwaway build) installed.');
