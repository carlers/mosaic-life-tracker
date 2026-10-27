import { beforeEach, describe, expect, it, vi } from 'vitest';
import { portableSettingsSchema } from '../../src/db/schema';
import { resolveCandidatePersonalCollections } from '../../src/lib/supabasePersonalCollections';
import type { AppDatabaseCollections } from '../../src/db/database';
import type { CandidateIdentity } from '../../supabase-poc/candidateMapping';

const state = vi.hoisted(() => ({ driver: 'supabase' as 'supabase' | 'appwrite' }));
vi.mock('../../src/lib/coreBackendConfig', () => ({
  CORE_BACKEND: { get driver() { return state.driver; } },
}));
const OWNER: CandidateIdentity = {
  legacyUserId: 'sb_11111111111141118111111111111111',
  supabaseUserId: '11111111-1111-4111-8111-111111111111',
};
const dbIdentity = {};
function fixture(): AppDatabaseCollections {
  const make = (name: string) => ({
    name, database: dbIdentity,
    find: vi.fn(() => { throw new Error('Must not read or import local Settings'); }),
    insert: vi.fn(() => { throw new Error('Must not copy or write local Settings'); }),
  });
  return {
    tasks: make('tasks'), categories: make('categories'), diary: make('diary'),
    settings: make('settings'), portableSettings: make('portableSettings'),
    bucketList: make('bucketList'), bucketTaskLinks: make('bucketTaskLinks'),
    friendships: make('friendships'), messages: make('messages'),
    syncMeta: make('syncMeta'),
  } as unknown as AppDatabaseCollections;
}
beforeEach(() => { state.driver = 'supabase'; });
describe('isolated portable personal Settings collection (#1027)', () => {
  it('builds six distinct app collection references without reading or copying shared Settings', () => {
    const db = fixture();
    const selected = resolveCandidatePersonalCollections(db, OWNER);
    expect(Object.keys(selected)).toEqual([
      'tasks', 'categories', 'diary', 'portableSettings', 'bucketList', 'bucketTaskLinks',
    ]);
    expect(new Set(Object.values(selected)).size).toBe(6);
    expect(selected.portableSettings).toBe(db.portableSettings);
    expect(selected.portableSettings).not.toBe(db.settings);
    expect(db.settings.find).not.toHaveBeenCalled();
    expect(db.settings.insert).not.toHaveBeenCalled();
    expect(db.portableSettings?.insert).not.toHaveBeenCalled();
  });

  it('refuses Appwrite, missing, reused, impersonated and cross-database Settings collections', () => {
    const db = fixture();
    state.driver = 'appwrite';
    expect(() => resolveCandidatePersonalCollections(db, OWNER)).toThrow(/Supabase/);
    state.driver = 'supabase';
    expect(() => resolveCandidatePersonalCollections({
      ...db, portableSettings: undefined,
    })).toThrow(/distinct/);
    expect(() => resolveCandidatePersonalCollections({
      ...db, portableSettings: db.settings,
    })).toThrow(/distinct/);
    expect(() => resolveCandidatePersonalCollections({
      ...db, portableSettings: {
        ...db.portableSettings, database: {},
      } as never,
    })).toThrow(/distinct/);
    expect(() => resolveCandidatePersonalCollections({
      ...db, portableSettings: {
        ...db.portableSettings, name: 'settings',
      } as never,
    })).toThrow(/distinct/);
    expect(() => resolveCandidatePersonalCollections({
      ...db, bucketTaskLinks: db.tasks as never,
    })).toThrow(/distinct/);
  });

  it('uses a separate schema excluding known social and avatar keys and honoring signed bounds', () => {
    expect(portableSettingsSchema.version).toBe(0);
    const key = new RegExp(String(portableSettingsSchema.properties.key.pattern));
    const rowId = new RegExp(String(portableSettingsSchema.properties.id.pattern));
    for (const deferred of ['profileImageId','friend_carousel_prefs','__proto__','constructor','prototype'])
      expect(key.test(deferred)).toBe(false);
    for (const allowed of ['calendarTaskPreviewLimit', 'theme', 'unknownFutureFlag'])
      expect(key.test(allowed)).toBe(true);
    expect(rowId.test('valid_123')).toBe(true);
    expect(rowId.test('_bad')).toBe(false);
    expect(rowId.test('x'.repeat(37))).toBe(false);
    expect(portableSettingsSchema.properties.value.maxLength).toBe(65536);
  });
});
