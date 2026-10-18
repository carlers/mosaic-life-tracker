import { describe, expect, it } from 'vitest';
import type { CategoryDocument, TaskDocument } from '../../src/db/schema';
import {
  fromCandidateCategoryRow,
  fromCandidateTaskRow,
  parseCandidateRevision,
  toCandidateCategoryWrite,
  toCandidateTaskWrite,
  type CandidateIdentity,
} from '../../supabase-poc/candidateMapping';

const identity: CandidateIdentity = {
  legacyUserId: 'appwrite_original_user_id',
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};

const task: TaskDocument = {
  id: 'task_original_string_id',
  title: 'Existing calendar task',
  completed: true,
  categoryId: 'category_1',
  order: 4,
  tags: '',
  date: '2026-10-18',
  memo: 'preserve line breaks\nand emoji ☀️',
  image: 'image_file_reference',
  createdAt: '2026-10-15T11:10:10.100Z',
  completedAt: '',
  updatedAt: '2026-10-18T15:15:00.000Z',
  source: 'routine',
  userId: identity.legacyUserId,
  isDeleted: false,
  routineId: 'routine_original',
  reminderTime: '10:00',
  reactions: '{}',
  visibility: 'followers',
};

const category: CategoryDocument = {
  id: 'category_1',
  name: 'Things',
  color: '#aabbcc',
  order: 3,
  visibility: 'private',
  userId: identity.legacyUserId,
  isDeleted: true,
  icon: 'star',
  updatedAt: '2026-10-18T14:00:00.000Z',
};

describe('isolated Supabase candidate task/category mapping', () => {
  it('round-trips all current task fields, including empty optionals and legacy IDs', () => {
    const write = toCandidateTaskWrite(task, identity);
    expect(write.id).toBe(task.id);
    expect(write.owner_id).toBe(identity.supabaseUserId);
    expect(write.category_id).toBe(task.categoryId);
    expect(write.task_date).toBe(task.date);
    expect(write.order_index).toBe(task.order);
    expect(write.completed_at).toBe('');
    expect(write.tags).toBe('');
    expect(write.image).toBe(task.image);
    expect(write.visibility).toBe('followers');
    expect(write).not.toHaveProperty('user_id');
    expect(write).not.toHaveProperty('change_seq');
    expect(write).not.toHaveProperty('server_updated_at');
    expect(fromCandidateTaskRow({
      ...write,
      change_seq: '9007199254740993',
      server_updated_at: '2026-10-18T15:25:00Z',
    }, identity)).toEqual(task);
  });

  it('round-trips category ownership, visibility, tombstone and order', () => {
    const write = toCandidateCategoryWrite(category, identity);
    expect(write.owner_id).toBe(identity.supabaseUserId);
    expect(write.id).toBe(category.id);
    expect(write.order_index).toBe(category.order);
    expect(write.is_deleted).toBe(true);
    expect(fromCandidateCategoryRow({
      ...write,
      change_seq: '5',
      server_updated_at: '2026-10-18T15:25:00Z',
    }, identity)).toEqual(category);
  });

  it('rejects foreign-owned local and remote records instead of silently remapping them', () => {
    expect(() => toCandidateTaskWrite({ ...task, userId: 'other' }, identity))
      .toThrow('different legacy account');
    expect(() => toCandidateCategoryWrite({ ...category, userId: 'other' }, identity))
      .toThrow('different legacy account');
    expect(() => fromCandidateTaskRow({
      ...toCandidateTaskWrite(task, identity),
      owner_id: '22222222-2222-4222-8222-222222222222',
      change_seq: 1,
      server_updated_at: '',
    }, identity)).toThrow('unexpected owner');
    expect(() => fromCandidateCategoryRow({
      ...toCandidateCategoryWrite(category, identity),
      owner_id: '22222222-2222-4222-8222-222222222222',
      change_seq: 1,
      server_updated_at: '',
    }, identity)).toThrow('unexpected owner');
  });

  it('requires an explicit valid Auth identity mapping', () => {
    expect(() => toCandidateTaskWrite(task, {
      legacyUserId: '',
      supabaseUserId: identity.supabaseUserId,
    })).toThrow('Unverified legacy');
    expect(() => toCandidateTaskWrite(task, {
      legacyUserId: identity.legacyUserId,
      supabaseUserId: 'appwrite-user-not-a-uuid',
    })).toThrow('Supabase Auth UUID');
  });

  it('never loses precision converting PostgreSQL int8 sync cursors', () => {
    expect(parseCandidateRevision('9007199254740993')).toBe(9007199254740993n);
    expect(parseCandidateRevision(13)).toBe(13n);
    expect(() => parseCandidateRevision(9007199254740992)).toThrow('Unsafe numeric');
    expect(() => parseCandidateRevision(-1)).toThrow('Unsafe numeric');
    expect(() => parseCandidateRevision('1.4')).toThrow('Invalid Supabase revision');
  });
});
