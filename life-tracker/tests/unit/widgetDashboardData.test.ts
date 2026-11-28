import { describe, expect, it } from 'vitest';
import { selectCategoryLoadsForDays, selectLastSevenDayCategoryLoads, selectTodayDiaryEntries, selectTaskPeriodProgress, selectWeeklyProgress } from '../../src/lib/widgetDashboardData';
import { DEFAULT_WIDGET_LAYOUT, moveWidget, resizeWidget, resolveWidgetLayout, toWidgetLayoutPreference, widgetLayoutsEqual } from '../../src/lib/widgetLayout';
import type { CategoryDocument, DiaryDocument, TaskDocument } from '../../src/db/schema';

const task = (id: string, date: string, categoryId = 'work', completed = false,
  userId = 'owner'): TaskDocument => ({
  id, title: id, date, categoryId, completed, userId, isDeleted: false,
  order: 0, createdAt: '2026-11-23T00:00:00Z', updatedAt: '2026-11-23T00:00:00Z',
  visibility: 'private',
});
const category = (id: string, order = 0, userId = 'owner'): CategoryDocument => ({
  id, name: id, color: '#123456', order, userId, isDeleted: false,
  visibility: 'private', updatedAt: '2026-11-23T00:00:00Z',
});
const diary = (id: string, date: string, userId = 'owner'): DiaryDocument => ({
  id, date, userId, content: id, visibility: 'private', isDeleted: false,
  createdAt: '2026-11-23T00:00:00Z', updatedAt: '2026-11-23T00:00:00Z',
});

describe('Widgets v2 owner-only projections', () => {
  it('counts precisely seven local dates, excludes foreign/deleted rows and sorts stable category ties', () => {
    const now = new Date(2026, 10, 23);
    const tasks = [
      task('a', '2026-11-17'), task('b', '2026-11-23'),
      task('c', '2026-11-16'), task('d', '2026-11-23', 'home'),
      task('e', '2026-11-23', 'home', false, 'other'),
      { ...task('f', '2026-11-20', 'home'), isDeleted: true },
    ];
    const loads = selectLastSevenDayCategoryLoads(tasks, [category('home', 0), category('work', 1)], 'owner', now);
    expect(loads.map(item => [item.id, item.count])).toEqual([['work', 2], ['home', 1]]);
    expect(selectLastSevenDayCategoryLoads(tasks, [category('work', 1)], 'other', now)).toEqual([]);
  });

  it('handles daylight saving dates using local calendar days, not UTC hours', () => {
    const now = new Date(2026, 2, 9);
    expect(selectLastSevenDayCategoryLoads([
      task('first', '2026-03-03'), task('last', '2026-03-09'),
      task('outside', '2026-03-02'),
    ], [category('work')], 'owner', now)[0]?.count).toBe(2);
  });

  it('respects account week start and zero-task progress without inventing completion', () => {
    const date = new Date(2026, 10, 23); // Monday
    const tasks = [
      task('sunday', '2026-11-22', 'work', true),
      task('monday', '2026-11-23', 'work', true),
      task('tuesday', '2026-11-24'),
      task('other', '2026-11-24', 'work', true, 'other'),
    ];
    const monday = selectWeeklyProgress(tasks, 'owner', date, false);
    expect(monday.days[0].key).toBe('2026-11-23');
    expect([monday.completed, monday.total, monday.percentage]).toEqual([1, 2, 50]);
    const sunday = selectWeeklyProgress(tasks, 'owner', date, true);
    expect(sunday.days[0].key).toBe('2026-11-22');
    expect([sunday.completed, sunday.total, sunday.percentage]).toEqual([2, 3, 67]);
    const empty = selectWeeklyProgress(tasks, 'different', date, false);
    expect([empty.total, empty.completed, empty.percentage]).toEqual([0, 0, 0]);
  });

  it('shows only the owner\'s diary entries for today with deterministic ordering', () => {
    const a = diary('a', '2026-11-23');
    const entries = [diary('foreign', '2026-11-23', 'other'), diary('before', '2026-11-22'),
      diary('b', '2026-11-23'), a, { ...diary('deleted', '2026-11-23'), isDeleted: true }];
    expect(selectTodayDiaryEntries(entries, 'owner', new Date(2026, 10, 23)).map(x => x.id)).toEqual(['a', 'b']);
    expect(selectTodayDiaryEntries(entries, '', new Date(2026, 10, 23))).toEqual([]);
  });
});

describe('Widgets layout persistence contract', () => {
  it('accepts only known unique IDs and half/full widths; appends new defaults', () => {
    expect(resolveWidgetLayout({ version: 1, items: [
      { id: 'categories', size: 'full' }, { id: 'categories', size: 'half' },
      { id: 'future', size: 'full' }, { id: 'today', size: 'giant' },
    ]})).toEqual([
      { id: 'categories', size: 'full' }, { id: 'today', size: 'full' },
      { id: 'diary', size: 'full' }, { id: 'weekly', size: 'half' },
    ]);
    expect(resolveWidgetLayout(JSON.parse('{"version":2,"items":[]}'))).toEqual(DEFAULT_WIDGET_LAYOUT);
  });
  it('reorders without changing width and resizes without changing order', () => {
    const moved = moveWidget(DEFAULT_WIDGET_LAYOUT, 'today', 3);
    expect(moved.map(x => x.id)).toEqual(['diary', 'categories', 'weekly', 'today']);
    expect(moved[3].size).toBe('full');
    const resized = resizeWidget(moved, 'today', 'half');
    expect(resized[3].size).toBe('half');
    expect(widgetLayoutsEqual(resized, resolveWidgetLayout(toWidgetLayoutPreference(resized)))).toBe(true);
    expect(widgetLayoutsEqual(resized, moved)).toBe(false);
  });
});


describe('Configurable widget date ranges', () => {
  it('counts inclusive 7/30/365 owner-local calendar days, not foreign or deleted tasks', () => {
    const now = new Date(2026, 10, 23);
    const tasks = [
      task('seven', '2026-11-17'), task('thirty', '2026-10-25'),
      task('year', '2025-11-24'), task('out', '2025-11-23'),
      task('foreign', '2026-11-23', 'work', false, 'another'),
      { ...task('deleted', '2026-11-22'), isDeleted: true },
    ];
    const groups = [category('work')];
    expect(selectCategoryLoadsForDays(tasks, groups, 'owner', now, 7)[0].count).toBe(1);
    expect(selectCategoryLoadsForDays(tasks, groups, 'owner', now, 30)[0].count).toBe(2);
    expect(selectCategoryLoadsForDays(tasks, groups, 'owner', now, 365)[0].count).toBe(3);
    expect(selectCategoryLoadsForDays(tasks, groups, 'another', now, 365)).toEqual([]);
  });

  it('groups this month by account-started weeks and this year into twelve months', () => {
    const now = new Date(2026, 10, 23);
    const tasks = [
      task('nov1', '2026-11-01', 'work', true),
      task('nov30', '2026-11-30'), task('oct31', '2026-10-31', 'work', true),
      task('jan', '2026-01-01', 'work', true), task('dec', '2026-12-31'),
      task('prev', '2025-12-31', 'work', true),
      task('foreign', '2026-11-02', 'work', true, 'another'),
      { ...task('removed', '2026-11-03'), isDeleted: true },
    ];
    const monMonth = selectTaskPeriodProgress(tasks, 'owner', now, false, 'month');
    const sunMonth = selectTaskPeriodProgress(tasks, 'owner', now, true, 'month');
    expect([monMonth.completed, monMonth.total]).toEqual([1, 2]);
    expect(monMonth.buckets.length).toBe(6);
    expect(sunMonth.buckets.length).toBe(5);
    expect(monMonth.buckets.reduce((sum, item) => sum + item.total, 0)).toBe(2);
    const year = selectTaskPeriodProgress(tasks, 'owner', now, false, 'year');
    expect(year.buckets).toHaveLength(12);
    expect([year.completed, year.total]).toEqual([3, 5]);
    expect(year.buckets[10].total).toBe(2);
    expect(selectTaskPeriodProgress(tasks, '', now, false, 'year').total).toBe(0);
    const week = selectTaskPeriodProgress(tasks, 'owner', now, false, 'week');
    expect(week.buckets).toHaveLength(7);
  });
});


describe('All category inventory for fixed-height scrollable widget', () => {
  it('includes zero-task owner categories after used categories, keeps stable tie order and excludes foreign or deleted', () => {
    const now = new Date(2026, 10, 23);
    const groups = [
      category('empty2', 2), category('empty1', 1), category('work', 0),
      category('foreign', 0, 'another'),
      { ...category('removed', 3), isDeleted: true },
    ];
    const result = selectCategoryLoadsForDays([task('a', '2026-11-23')], groups, 'owner', now, 7);
    expect(result.map(item => [item.id, item.count])).toEqual([
      ['work', 1], ['empty1', 0], ['empty2', 0],
    ]);
    expect(selectCategoryLoadsForDays([], groups, '', now, 7)).toEqual([]);
  });
});
