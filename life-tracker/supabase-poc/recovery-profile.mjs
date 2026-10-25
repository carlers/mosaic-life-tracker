/**
 * Exact personal-domain TOC gate before publishing ANY new unified R2 marker.
 * Source-only: no PostgreSQL, R2 or hosted access. Authenticated age inspection
 * and PostgreSQL 17 TOC parsing happen in the reviewed backup runner.
 */
export const SEVEN = 'seven';
export const EIGHT_SETTINGS = 'eight-personal-settings';
export const TEN_BUCKET_LINKS = 'ten-personal-bucket-links';
const REQUIRED_PERSONAL = [
  'public.mosaic_candidate_categories',
  'public.mosaic_candidate_diary',
  'public.mosaic_candidate_tasks',
];
const REQUIRED_EIGHT = [...REQUIRED_PERSONAL, 'public.mosaic_candidate_settings'].sort();
const REQUIRED_TEN = [...REQUIRED_EIGHT, 'public.mosaic_candidate_buckets',
  'public.mosaic_candidate_bucket_task_links'].sort();

export function assertRecoveryProfile(value) {
  if (value !== SEVEN && value !== EIGHT_SETTINGS && value !== TEN_BUCKET_LINKS)
    throw new Error('Unapproved unified R2 personal recovery profile');
  return value;
}

export function assertProfileToc(report, requested = SEVEN) {
  assertRecoveryProfile(requested);
  if (!report || report.status !== 'METADATA_ONLY_NOT_RESTORED' ||
      report.restoresPerformed !== 0 ||
      report.criticalDataEntriesPresent !== 6 ||
      report.criticalDataEntriesExpected !== 6 ||
      !Array.isArray(report.missingRequiredEntries) || report.missingRequiredEntries.length !== 0 ||
      !Array.isArray(report.personalCandidateDataTables)) {
    throw new Error('Authenticated PostgreSQL archive core metadata incomplete');
  }
  const observed = report.personalCandidateDataTables;
  if (observed.some(name => typeof name !== 'string') ||
      new Set(observed).size !== observed.length) {
    throw new Error('Duplicate or malformed personal data table inventory');
  }
  const required = requested === TEN_BUCKET_LINKS ? REQUIRED_TEN :
    requested === EIGHT_SETTINGS ? REQUIRED_EIGHT : REQUIRED_PERSONAL;
  const actual = [...observed].sort();
  if (JSON.stringify(actual) !== JSON.stringify(required)) {
    throw new Error('Supabase personal table inventory outside explicitly restorable R2 profile');
  }
  if (report.privateDiaryDataEntryPresent !== true ||
      report.personalSettingsDataEntryPresent !== (requested !== SEVEN) ||
      (requested === TEN_BUCKET_LINKS && (report.bucketListDataEntryPresent !== true ||
        report.bucketTaskLinksDataEntryPresent !== true)) ||
      (requested !== TEN_BUCKET_LINKS && (report.bucketListDataEntryPresent === true ||
        report.bucketTaskLinksDataEntryPresent === true))) {
    throw new Error('Encrypted PostgreSQL archive is not restorable under selected profile');
  }
  return requested;
}
