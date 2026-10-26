/**
 * #1027 preliminary complete personal Appwrite owner-source escrow. Pure source
 * validation/packing only. The archive is encrypted by the separate offline
 * age writer, NOT by this module. A supplied digest is not trusted provenance.
 * No cloud operations, runtime activation, Storage bytes or provider cutover.
 */
import { joinFrozenAppwriteOwnerSources } from './appwriteFrozenPersonalJoin';
import type { AppwriteHistoryReadback } from './appwriteOwnerHistoryRead';
import type { FrozenPersonalSnapshot } from './appwritePersonalSourceRead';

const SHA = /^[a-f0-9]{64}$/;
type Source = { personal: FrozenPersonalSnapshot; history: AppwriteHistoryReadback };

/** Preserve original field presence, explicit null, deleted rows, owner
 * permissions and full historical long/dangling references; do not flatten
 * to the normal user's active-only ZIP or silently map provider-native IDs.
 */
export function packFrozenAppwriteOwnerSource(
  input: Source & { expectedSevenDomainScanSha256: string },
) {
  if (!SHA.test(input?.expectedSevenDomainScanSha256))
    throw new Error('Full owner archive requires an independently pinned scan digest');
  const first = joinFrozenAppwriteOwnerSources(input);
  if (first.sevenDomainScanSha256 !== input.expectedSevenDomainScanSha256)
    throw new Error('Frozen owner source disagrees with pinned scan digest');
  // Seal before async age I/O: caller mutations after this point cannot change
  // the manifest. Re-validate every copied original row against signed scans.
  const copy: Source = structuredClone({
    personal: input.personal, history: input.history,
  });
  const second = joinFrozenAppwriteOwnerSources(copy);
  if (second.sevenDomainScanSha256 !== first.sevenDomainScanSha256)
    throw new Error('Owner source changed while sealing full archive');
  return {
    format: 'mosaic-appwrite-full-owner-source' as const,
    version: 1 as const,
    owner: { ...second.owner },
    sourceDeploymentId: second.sourceDeploymentId,
    leaseId: second.leaseId,
    generation: second.generation,
    counts: { ...second.counts },
    personalScanSha256: copy.personal.scanSha256,
    sevenDomainScanSha256: second.sevenDomainScanSha256,
    fingerprints: {
      personal: { ...copy.personal.fingerprintSha256 },
      history: { ...copy.history.fingerprints },
    },
    rows: {
      tasks: copy.personal.rows.tasks,
      categories: copy.personal.rows.categories,
      diary: copy.personal.rows.diary,
      settings: copy.personal.rows.settings,
      taskIdentities: copy.history.tasks,
      buckets: copy.history.buckets,
      links: copy.history.links,
    },
    /** Must always remain false until genuine independent trusted evidence. */
    sourceServerAuthorityAuthenticated: false as const,
    storageBytesIncluded: false as const,
    providerCutoverEligible: false as const,
  };
}
