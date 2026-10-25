import { describe, expect, it } from 'vitest';
import { assertProfileToc, assertRecoveryProfile, SEVEN, EIGHT_SETTINGS, TEN_BUCKET_LINKS } from '../../supabase-poc/recovery-profile.mjs';

const seven = {
  status: 'METADATA_ONLY_NOT_RESTORED',
  restoresPerformed: 0,
  criticalDataEntriesPresent: 6,
  criticalDataEntriesExpected: 6,
  missingRequiredEntries: [],
  privateDiaryDataEntryPresent: true,
  personalSettingsDataEntryPresent: false,
  personalCandidateDataTables: [
    'public.mosaic_candidate_categories',
    'public.mosaic_candidate_diary',
    'public.mosaic_candidate_tasks',
  ],
};

describe('authenticated unified R2 personal table inventory gate', () => {
  it('preserves seven-table legacy profile and explicitly accepts complete eight-table input', () => {
    expect(assertProfileToc(seven, SEVEN)).toBe(SEVEN);
    const eighth = {
      ...seven,
      personalSettingsDataEntryPresent: true,
      personalCandidateDataTables: [...seven.personalCandidateDataTables, 'public.mosaic_candidate_settings'],
    };
    expect(assertProfileToc(eighth, EIGHT_SETTINGS)).toBe(EIGHT_SETTINGS);
  });

  it('refuses silently losing Settings under the previous seven-table profile', () => {
    expect(() => assertProfileToc({
      ...seven, personalSettingsDataEntryPresent: true,
      personalCandidateDataTables: [...seven.personalCandidateDataTables, 'public.mosaic_candidate_settings'],
    }, SEVEN)).toThrow(/outside explicitly restorable/);
  });

  it('rejects eight-table declaration when source lacks real Settings TABLE DATA', () => {
    expect(() => assertProfileToc(seven, EIGHT_SETTINGS)).toThrow(/outside explicitly restorable/);
  });

  it('blocks unknown future personal collections until reviewed DR and migration are extended', () => {
    for (const name of ['public.mosaic_candidate_bucket_list','public.mosaic_candidate_task_links']) {
      expect(() => assertProfileToc({
        ...seven, personalCandidateDataTables: [...seven.personalCandidateDataTables, name],
      }, SEVEN)).toThrow(/outside explicitly restorable/);
    }
  });

  it('requires exact two Bucket/link TABLE DATA entries for ten-table encrypted recovery', () => {
    const ten = {
      ...seven, personalSettingsDataEntryPresent: true,
      bucketListDataEntryPresent: true, bucketTaskLinksDataEntryPresent: true,
      personalCandidateDataTables: [...seven.personalCandidateDataTables,
        'public.mosaic_candidate_settings','public.mosaic_candidate_buckets',
        'public.mosaic_candidate_bucket_task_links'],
    };
    expect(assertProfileToc(ten,TEN_BUCKET_LINKS)).toBe(TEN_BUCKET_LINKS);
    for (const profile of [SEVEN,EIGHT_SETTINGS]) {
      expect(() => assertProfileToc(ten,profile)).toThrow(/outside explicitly restorable/);
    }
    for (const missing of ['public.mosaic_candidate_buckets',
                           'public.mosaic_candidate_bucket_task_links']) {
      const absent={...ten,personalCandidateDataTables:ten.personalCandidateDataTables.filter(v=>v!==missing)};
      expect(() => assertProfileToc(absent,TEN_BUCKET_LINKS)).toThrow(/outside explicitly restorable/);
    }
    expect(() => assertProfileToc({...ten,bucketListDataEntryPresent:false},TEN_BUCKET_LINKS))
      .toThrow(/not restorable/);
    expect(() => assertProfileToc({...ten,bucketTaskLinksDataEntryPresent:false},TEN_BUCKET_LINKS))
      .toThrow(/not restorable/);
    expect(() => assertProfileToc({...ten,personalCandidateDataTables:[
      ...ten.personalCandidateDataTables,'public.mosaic_candidate_unknown',
    ]},TEN_BUCKET_LINKS)).toThrow(/outside explicitly restorable/);
  });

  it('refuses missing Diary even when ordinary core manifest exists', () => {
    expect(() => assertProfileToc({
      ...seven, privateDiaryDataEntryPresent: false,
      personalCandidateDataTables: seven.personalCandidateDataTables.filter(x => !x.includes('diary')),
    }, SEVEN)).toThrow(/outside explicitly restorable/);
  });

  it('rejects malformed, duplicate or incomplete full-archive metadata and invalid profile selection', () => {
    expect(() => assertProfileToc(null, SEVEN)).toThrow(/core metadata incomplete/);
    expect(() => assertProfileToc({ ...seven, criticalDataEntriesPresent: 5 }, SEVEN)).toThrow(/core metadata incomplete/);
    expect(() => assertProfileToc({ ...seven, missingRequiredEntries: ['auth.users'] }, SEVEN)).toThrow(/core metadata incomplete/);
    expect(() => assertProfileToc({ ...seven, personalCandidateDataTables: [...seven.personalCandidateDataTables,
      seven.personalCandidateDataTables[0]] }, SEVEN)).toThrow(/Duplicate/);
    expect(() => assertProfileToc({ ...seven, restoresPerformed: 1 }, SEVEN)).toThrow(/core metadata incomplete/);
    expect(() => assertProfileToc(seven, 'future-guess')).toThrow(/Unapproved/);
    expect(() => assertRecoveryProfile('')).toThrow(/Unapproved/);
  });
});
