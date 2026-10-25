/** #1027 source-only owner-private portable settings mapping. No cloud writer. */
import type { SettingsDocument } from '../src/db/schema';
import { validateCandidateIdentity, type CandidateIdentity } from './candidateMapping';

export type CandidateSettingWrite = {
  owner_id: string;
  id: string;
  setting_key: string;
  setting_value: string;
  updated_at: string;
  is_deleted: boolean;
};
export type CandidateSettingRow = CandidateSettingWrite & {
  change_seq: string | number;
  server_updated_at: string;
};

const ROW_ID = /^[A-Za-z0-9][A-Za-z0-9_]{0,35}$/;
const SETTING_KEY = /^[A-Za-z][A-Za-z0-9_]{0,127}$/;
const SEPARATE_MIGRATION = new Set(['profileImageId', 'friend_carousel_prefs']);

export function classifyCandidateSettingKey(key: unknown): 'personal' | 'separate-migration' {
  if (typeof key !== 'string' || !SETTING_KEY.test(key) ||
      key === '__proto__' || key === 'constructor' || key === 'prototype')
    throw new Error('Invalid candidate settings key');
  return SEPARATE_MIGRATION.has(key) ? 'separate-migration' : 'personal';
}

function validateFields(doc: {
  id: unknown; key: unknown; value: unknown; updatedAt: unknown; isDeleted: unknown;
}): void {
  if (typeof doc.id !== 'string' || !ROW_ID.test(doc.id))
    throw new Error('Invalid candidate settings row ID');
  if (classifyCandidateSettingKey(doc.key) !== 'personal')
    throw new Error('Setting needs separate provider migration, preserve in export');
  // Do not JSON.parse, normalize, or drop any portable value.
  if (typeof doc.value !== 'string' || doc.value.length > 65536)
    throw new Error('Invalid candidate settings value');
  if (typeof doc.updatedAt !== 'string' || doc.updatedAt.length > 50 ||
      doc.updatedAt.length < 1 || !Number.isFinite(Date.parse(doc.updatedAt)))
    throw new Error('Invalid candidate settings timestamp');
  if (typeof doc.isDeleted !== 'boolean')
    throw new Error('Invalid candidate settings tombstone');
}

export function toCandidateSettingWrite(
  doc: SettingsDocument, identity: CandidateIdentity,
): CandidateSettingWrite {
  validateCandidateIdentity(identity);
  if (doc.userId !== identity.legacyUserId)
    throw new Error('Refusing to write a different legacy account setting');
  validateFields(doc);
  return {
    owner_id: identity.supabaseUserId,
    id: doc.id,
    setting_key: doc.key,
    setting_value: doc.value,
    updated_at: doc.updatedAt,
    is_deleted: doc.isDeleted,
  };
}

export function fromCandidateSettingRow(
  row: CandidateSettingRow, identity: CandidateIdentity,
): SettingsDocument {
  validateCandidateIdentity(identity);
  if (row.owner_id !== identity.supabaseUserId)
    throw new Error('Refusing Supabase setting with unexpected owner');
  const doc: SettingsDocument = {
    id: row.id,
    userId: identity.legacyUserId,
    key: row.setting_key,
    value: row.setting_value,
    updatedAt: row.updated_at,
    isDeleted: row.is_deleted,
  };
  validateFields(doc);
  return doc;
}
