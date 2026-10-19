/**
 * #1027 core-only Supabase candidate task/category runner.
 *
 * This DOES NOT connect Mosaic's shipped Appwrite Auth/sync or select a
 * provider. It runs only with an externally verified owner identity, a
 * separately audited Appwrite writer fence and an exclusive writer lease.
 * No implicit fallback, PWA migration or cross-provider dual writes.
 */
import type { RxCollection } from 'rxdb';
import type { TaskDocument, CategoryDocument } from '../src/db/schema';
import type { CandidateIdentity } from './candidateMapping';
import { validateCandidateIdentity } from './candidateMapping';
import type { CandidateSessionProvider, CandidateVerifiedSession } from './candidateHttpTransport';
import { CandidateAuthError, createCandidateHttpTransport } from './candidateHttpTransport';
import { createCandidateCasTransport } from './candidateCasTransport';
import { createCandidateCreateTransport } from './candidateCreateTransport';
import { createCandidateRxdbPilot } from './candidateRxdbPilot';
import { assertSingleCloudWriter, type DomainWriter } from '../src/lib/backendCapabilities';

export interface CandidateCoreWriterLease {
  isCurrent(): boolean;
  release(): Promise<void>;
}
export interface CandidateCoreGuard {
  /** Must verify legacy Appwrite ID <-> signed Supabase UUID in trusted migration registry. */
  verifyLegacyMapping(identity: CandidateIdentity): Promise<void>;
  /** Must fence ALL Appwrite tasks/categories writers for this owner, including old PWA versions. */
  assertAppwriteWritersFenced(identity: CandidateIdentity): Promise<void>;
  /** Must atomically reject any competing writer for this owner/domain, across tabs/devices. */
  acquireExclusiveLease(identity: CandidateIdentity): Promise<CandidateCoreWriterLease>;
}
export interface CandidateCoreRuntimeOptions {
  baseUrl: string;
  publishableKey: string;
  identity: CandidateIdentity;
  session: CandidateSessionProvider;
  collections: {
    tasks: RxCollection<TaskDocument>;
    categories: RxCollection<CategoryDocument>;
  };
  guard: CandidateCoreGuard;
  fetcher?: typeof fetch;
  /** Be explicit: a profile alone must never silently change providers. */
  selectedBackend: 'supabase';
  featureProfile: 'core-only';
}

export function createCandidateCoreRuntime(options: CandidateCoreRuntimeOptions) {
  if (options.selectedBackend !== 'supabase' || options.featureProfile !== 'core-only')
    throw new Error('Candidate core runtime requires an explicit Supabase core-only selection');
  validateCandidateIdentity(options.identity);
  if (!options.guard || typeof options.guard.acquireExclusiveLease !== 'function' ||
      typeof options.guard.assertAppwriteWritersFenced !== 'function' ||
      typeof options.guard.verifyLegacyMapping !== 'function') {
    throw new Error('Candidate core runtime requires all migration safety guards');
  }
  const tasks = createCandidateRxdbPilot<TaskDocument>({
    domain: 'tasks', identity: options.identity, session: options.session,
    changes: createCandidateHttpTransport(options),
    writer: createCandidateCreateTransport(options),
    cas: createCandidateCasTransport(options),
    collection: options.collections.tasks,
  });
  const categories = createCandidateRxdbPilot<CategoryDocument>({
    domain: 'categories', identity: options.identity, session: options.session,
    changes: createCandidateHttpTransport(options),
    writer: createCandidateCreateTransport(options),
    cas: createCandidateCasTransport(options),
    collection: options.collections.categories,
  });
  const ownerId = options.identity.supabaseUserId;
  let active: {
    lease: CandidateCoreWriterLease;
    taskRun: ReturnType<typeof tasks.start>;
    categoryRun: ReturnType<typeof categories.start>;
    signed: CandidateVerifiedSession;
  } | null = null;
  let starting = false;

  async function checkedOwner(): Promise<CandidateVerifiedSession> {
    const verified = await options.session.getVerifiedSession();
    if (!verified || verified.userId !== ownerId ||
        !verified.accessToken || !Number.isSafeInteger(verified.sessionEpoch)) {
      throw new CandidateAuthError('Candidate core runtime account is not verified');
    }
    return verified;
  }
  function checkedWriter(owner: CandidateVerifiedSession, lease: CandidateCoreWriterLease): void {
    if (!lease.isCurrent()) throw new Error('Candidate core writer lease was revoked');
    const writers: DomainWriter[] = ['tasks', 'categories'].map(domain => ({
      domain, ownerId: owner.userId, provider: 'supabase',
    }));
    assertSingleCloudWriter(writers);
  }

  async function start() {
    if (active || starting) throw new Error('Candidate core runtime already started');
    starting = true;
    let lease: CandidateCoreWriterLease | null = null;
    let taskRun: ReturnType<typeof tasks.start> | null = null;
    let categoryRun: ReturnType<typeof categories.start> | null = null;
    try {
      const before = await checkedOwner();
      await options.guard.verifyLegacyMapping(options.identity);
      await options.guard.assertAppwriteWritersFenced(options.identity);
      lease = await options.guard.acquireExclusiveLease(options.identity);
      checkedWriter(before, lease);
      const after = await checkedOwner();
      if (after.sessionEpoch !== before.sessionEpoch ||
          after.accessToken !== before.accessToken)
        throw new CandidateAuthError('Candidate core session changed while acquiring exclusive writer');
      taskRun = tasks.start(options.collections.tasks);
      categoryRun = categories.start(options.collections.categories);
      const established = { lease, taskRun, categoryRun, signed: before };
      active = established;
      return {
        taskState: taskRun.state,
        categoryState: categoryRun.state,
        async awaitInitialReplication() {
          await Promise.all([
            established.taskRun.state.awaitInitialReplication(),
            established.categoryRun.state.awaitInitialReplication(),
          ]);
          const latest = await checkedOwner();
          if (!established.lease.isCurrent() ||
              latest.sessionEpoch !== established.signed.sessionEpoch ||
              latest.accessToken !== established.signed.accessToken) {
            throw new CandidateAuthError('Candidate core session or lease changed during initial sync');
          }
        },
        async resync() {
          if (active !== established || !established.lease.isCurrent())
            throw new Error('Candidate core replication no longer active');
          const latest = await checkedOwner();
          if (latest.sessionEpoch !== established.signed.sessionEpoch ||
              latest.accessToken !== established.signed.accessToken)
            throw new CandidateAuthError('Candidate core session replaced; stop and restart with fresh owner lease');
          established.taskRun.resync();
          established.categoryRun.resync();
        },
        stop,
        getPendingConflicts: () => ({
          tasks: tasks.listPendingConflicts(),
          categories: categories.listPendingConflicts(),
        }),
      };
    } catch (error) {
      // No partially started writer may continue if verification or a second
      // collection startup failed. Always release the lease on failure.
      const cleanup = await Promise.allSettled([
        ...(categoryRun ? [categoryRun.stop()] : []),
        ...(taskRun ? [taskRun.stop()] : []),
      ]);
      // If either replication cannot be stopped, deliberately retain the
      // writer lease so another backend can NEVER take over prematurely.
      if (cleanup.some(result => result.status === 'rejected'))
        throw new Error('Candidate core shutdown unconfirmed; writer lease retained');
      if (lease) await lease.release();
      active = null;
      throw error;
    } finally {
      starting = false;
    }
  }

  async function stop(): Promise<void> {
    const current = active;
    active = null;
    if (!current) return;
    const results = await Promise.allSettled([
      current.taskRun.stop(), current.categoryRun.stop(),
    ]);
    if (results.some(result => result.status === 'rejected'))
      throw new Error('Candidate core shutdown unconfirmed; writer lease retained');
    await current.lease.release();
  }

  return { start, stop };
}
