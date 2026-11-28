/** Lightweight, strictly bounded and versioned owner-scoped Widgets layout setting. */
export const WIDGET_LAYOUT_SETTING_KEY = 'mosaic_widgets_layout_v1';
export type WidgetId = 'today' | 'diary' | 'categories' | 'weekly';
export type WidgetSize = 'half' | 'full';
export interface WidgetLayoutItem {
  id: WidgetId;
  size: WidgetSize;
}
export interface WidgetLayoutPreference {
  version: 1;
  items: WidgetLayoutItem[];
}
export const DEFAULT_WIDGET_LAYOUT: ReadonlyArray<Readonly<WidgetLayoutItem>> = [
  { id: 'today', size: 'full' },
  { id: 'diary', size: 'full' },
  { id: 'categories', size: 'half' },
  { id: 'weekly', size: 'half' },
];
const WIDGET_IDS = new Set<WidgetId>(DEFAULT_WIDGET_LAYOUT.map(item => item.id));
const isRecord = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);

export function resolveWidgetLayout(raw: unknown): WidgetLayoutItem[] {
  const fallback = DEFAULT_WIDGET_LAYOUT.map(item => ({ ...item }));
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.items)) return fallback;
  const ids = new Set<WidgetId>();
  const items: WidgetLayoutItem[] = [];
  for (const value of raw.items) {
    if (!isRecord(value) || typeof value.id !== 'string' ||
      !WIDGET_IDS.has(value.id as WidgetId) || ids.has(value.id as WidgetId)) continue;
    const id = value.id as WidgetId;
    ids.add(id);
    const original = DEFAULT_WIDGET_LAYOUT.find(item => item.id === id)!;
    items.push({ id, size: value.size === 'half' || value.size === 'full' ? value.size : original.size });
  }
  // Include new widget types for old settings without destroying user order.
  for (const original of DEFAULT_WIDGET_LAYOUT) {
    if (!ids.has(original.id)) items.push({ ...original });
  }
  return items;
}
export function moveWidget(items: readonly WidgetLayoutItem[], id: WidgetId, toIndex: number): WidgetLayoutItem[] {
  const from = items.findIndex(item => item.id === id);
  if (from < 0) return [...items];
  const dest = Math.max(0, Math.min(items.length - 1, Math.trunc(toIndex)));
  if (from === dest) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(dest, 0, item);
  return next;
}
export function resizeWidget(items: readonly WidgetLayoutItem[], id: WidgetId, size: WidgetSize): WidgetLayoutItem[] {
  return items.map(item => item.id === id ? { ...item, size } : item);
}
export const widgetLayoutsEqual = (a: readonly WidgetLayoutItem[], b: readonly WidgetLayoutItem[]): boolean =>
  a.length === b.length && a.every((item, i) => item.id === b[i].id && item.size === b[i].size);
export const toWidgetLayoutPreference = (items: readonly WidgetLayoutItem[]): WidgetLayoutPreference =>
  ({ version: 1, items: items.map(({ id, size }) => ({ id, size })) });
