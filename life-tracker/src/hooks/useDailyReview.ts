import { useCallback } from 'react';
import { getDatabase } from '../db/database';
import type { CategoryDocument, SettingsDocument, TaskDocument } from '../db/schema';
import { useRxCollection } from './useRxCollection';
import { useAuth } from './useAuth';
import { upsertLocalDoc } from '../lib/localUpsert';
import { makeSettingsRowId, hashString } from '../lib/settingsRowId';
import { captureAccountWorkGeneration, isAccountWorkCurrent } from '../lib/accountWorkScope';
import {
  DAILY_REVIEW_PREFIX, parseReviewRecord, validReviewDate,
  type ReviewRecord, type ReviewResult
} from '../lib/dailyReviewModel';

function toRecords(docs: SettingsDocument[]): ReviewRecord[] {
  return docs.map(doc => parseReviewRecord(doc.key, doc.value))
    .filter((record): record is ReviewRecord => record !== null);
}

function dayKey(date: string): string {
  return DAILY_REVIEW_PREFIX + 'd_' + date.replace(/-/g, '');
}
function taskPlanKey(date: string, taskId: string): string {
  return DAILY_REVIEW_PREFIX + 'p_' + date.replace(/-/g, '') + '_' + hashString(taskId);
}
function uniqueKey(kind: 'p' | 'e', date: string): string {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '')
    : String(Date.now()) + '_' + Math.random().toString(36).slice(2);
  return DAILY_REVIEW_PREFIX + kind + '_' + date.replace(/-/g, '') + '_' + suffix;
}

export function useDailyReview(enabled = true) {
  const { user } = useAuth();
  const uid = user?.$id ?? '';
  const { data: records, isLoading } = useRxCollection<SettingsDocument, ReviewRecord[]>({
    collection: 'settings',
    selector: { userId: uid, isDeleted: false },
    map: toRecords,
    logPrefix: '[useDailyReview]',
    enabled,
  });

  const write = useCallback(async (record: ReviewRecord, allowReplace = false) => {
    if (!uid || !validReviewDate(record.date)) throw new Error('Invalid review account or date.');
    const generation = captureAccountWorkGeneration(uid);
    if (generation === null) throw new Error('Review account is no longer active.');
    const id = makeSettingsRowId(uid, record.id);
    const db = getDatabase();
    const existing = await db.settings.findOne(id).exec();
    if (!isAccountWorkCurrent(uid, generation)) throw new Error('Review account changed.');
    if (existing && !existing.isDeleted && !allowReplace) return;
    await upsertLocalDoc('settings', id, {
      id, userId: uid, key: record.id, value: JSON.stringify(record),
      isDeleted: false, updatedAt: new Date().toISOString(),
    } satisfies SettingsDocument);
  }, [uid]);

  const addPlan = useCallback(async (date: string, title: string, taskId = '', categoryName = '', categoryColor = '') => {
    const clean = title.trim();
    if (!validReviewDate(date) || !clean || clean.length > 255) throw new Error('Enter a valid plan item.');
    const now = new Date().toISOString();
    const id = taskId ? taskPlanKey(date, taskId) : uniqueKey('p', date);
    await write({
      version: 1, id, kind: 'plan', date, title: clean, taskId, planId: '', categoryName, categoryColor,
      result: '', note: '', plannedAt: '', reviewedAt: '', createdAt: now,
    });
  }, [write]);

  const confirmPlan = useCallback(async (date: string, tasks: readonly TaskDocument[], categories: readonly CategoryDocument[] = []) => {
    if (!validReviewDate(date)) throw new Error('Invalid review date.');
    for (const task of tasks) {
      if (task.isDeleted || task.userId !== uid || task.date !== date) continue;
      const category = categories.find(item => item.id === task.categoryId);
      await addPlan(date, task.title, task.id, category?.name ?? '', category?.color ?? '');
    }
    const id = dayKey(date), now = new Date().toISOString();
    const existing = records.find(record => record.id === id);
    await write({
      version: 1, id, kind: 'day', date, title: '', taskId: '', planId: '',
      result: '', note: '', plannedAt: existing?.plannedAt || now,
      reviewedAt: existing?.reviewedAt || '', createdAt: existing?.createdAt || now,
    }, true);
  }, [uid, records, write, addPlan]);

  const recordOutcome = useCallback(async (
    date: string, result: ReviewResult, title: string, taskId = '',
    planId = '', note = '', categoryName = '', categoryColor = ''
  ) => {
    if (!validReviewDate(date) || !['completed','missed'].includes(result))
      throw new Error('Invalid review outcome.');
    if (!title.trim() || title.length > 255 || note.length > 2000)
      throw new Error('Invalid review title or note.');
    const now = new Date().toISOString(), id = uniqueKey('e', date);
    await write({
      version: 1, id, kind: 'execution', date, title: title.trim(), taskId, planId, categoryName, categoryColor,
      result, note, plannedAt: '', reviewedAt: '', createdAt: now,
    });
  }, [write]);

  const finishReview = useCallback(async (date: string) => {
    if (!validReviewDate(date)) throw new Error('Invalid review date.');
    const id = dayKey(date), now = new Date().toISOString();
    const existing = records.find(record => record.id === id);
    await write({
      version: 1, id, kind: 'day', date, title: '', taskId: '', planId: '',
      result: '', note: '', plannedAt: existing?.plannedAt || '',
      reviewedAt: now, createdAt: existing?.createdAt || now,
    }, true);
  }, [records, write]);

  return { records, isLoading, addPlan, confirmPlan, recordOutcome, finishReview };
}
