/**
 * #1027 core-only Supabase candidate task/category runner.
 *
 * This DOES NOT connect Mosaic's shipped Appwrite Auth/sync or select a
 * provider. It runs only with an externally verified owner identity, a
 * separately audited Appwrite writer fence and an exclusive writer lease.
 * No implicit fallback, PWA migration or cross-provider dual writes.
 */
import type { RxCollection } from 'rxdb';
import type { TaskDocument, CategoryDocument, DiaryDocument } from '../src/db/schema';
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
  /** Must fence ALL Appwrite writers for every selected collection, including old PWA versions. */
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
    /** Supplied ONLY when the reviewed core-diary profile is explicitly selected. */
    diary?: RxCollection<DiaryDocument>;
  };
  guard: CandidateCoreGuard;
  fetcher?: typeof fetch;
  /** Be explicit: a profile alone must never silently change providers. */
  selectedBackend: 'supabase';
  featureProfile: 'core-only' | 'core-diary';
}

export function createCandidateCoreRuntime(options: CandidateCoreRuntimeOptions) {
  if (options.selectedBackend !== 'supabase' ||
      !['core-only', 'core-diary'].includes(options.featureProfile))
    throw new Error('Candidate core runtime requires an explicit Supabase personal profile');
  if (Boolean(options.collections.diary) !== (options.featureProfile === 'core-diary'))
    throw new Error('Candidate Diary writer requires explicit matching profile and collection');
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
  // The Diary writer must use the SAME signed session and exclusive owner
  // lease as tasks/categories. Never initialize it as a separate authority.
  const diary = options.featureProfile === 'core-diary' && options.collections.diary
    ? createCandidateRxdbPilot<DiaryDocument>({
        domain: 'diary', identity: options.identity, session: options.session,
        changes: createCandidateHttpTransport(options),
        writer: createCandidateCreateTransport(options),
        cas: createCandidateCasTransport(options),
        collection: options.collections.diary,
      })
    : null;
  const ownerId = options.identity.supabaseUserId;
  type DiaryPilot = NonNullable<typeof diary>;
  type DiaryRun = ReturnType<DiaryPilot['start']>;
  let active: {
    lease: CandidateCoreWriterLease;
    taskRun: ReturnType<typeof tasks.start>;
    categoryRun: ReturnType<typeof categories.start>;
    diaryRun: DiaryRun | null;
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
    const domains = options.featureProfile === 'core-diary'
      ? ['tasks', 'categories', 'diary'] : ['tasks', 'categories'];
    const writers: DomainWriter[] = domains.map(domain => ({
      domain,
      canonicalOwnerId: options.identity.legacyUserId,
      ownerId: owner.userId,
      target: 'supabase-cloud',
      deploymentId: new URL(options.baseUrl).origin,
    }));
    assertSingleCloudWriter(writers);
  }

  async function start() {
    if (active || starting) throw new Error('Candidate core runtime already started');
    starting = true;
    let lease: CandidateCoreWriterLease | null = null;
    let taskRun: ReturnType<typeof tasks.start> | null = null;
    let categoryRun: ReturnType<typeof categories.start> | null = null;
    let diaryRun: DiaryRun | null = null;
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
      if (diary && options.collections.diary)
        diaryRun = diary.start(options.collections.diary);
      const established = { lease, taskRun, categoryRun, diaryRun, signed: before };
      active = established;
      let cancellation: Promise<void> | null = null;
      let reviewWork: Promise<unknown> = Promise.resolve();
      const ensureCurrent = async () => {
        if (active !== established || cancellation || !established.lease.isCurrent())
          throw new Error('Candidate core replication no longer active');
        const signed = await checkedOwner();
        if (active !== established || cancellation || !established.lease.isCurrent() ||
            signed.sessionEpoch !== established.signed.sessionEpoch ||
            signed.accessToken !== established.signed.accessToken)
          throw new CandidateAuthError('Candidate conflict account changed');
      };
      const review = <T>(action: () => Promise<T>): Promise<T> => {
        const next = reviewWork.then(async () => {
          await ensureCurrent();
          return action();
        });
        reviewWork = next.catch(() => {});
        return next;
      };
      const pilot = (domain: 'tasks' | 'categories' | 'diary') => {
        if (domain === 'tasks') return tasks;
        if (domain === 'categories') return categories;
        if (domain === 'diary' && diary) return diary;
        throw new Error('Unsupported core conflict domain');
      };
      const conflicts = () => ({
        tasks: tasks.listPendingConflicts(), categories: categories.listPendingConflicts(),
        ...(diary ? { diary: diary.listPendingConflicts() } : {}),
      });
      const pause = async () => {
        if (active !== established) throw new Error('Candidate core replication no longer active');
        // No new review action may start once cancellation is requested.
        // Drain an already dispatched signed resolution before lease release.
        cancellation ??= reviewWork.then(() => Promise.allSettled([
          established.taskRun.stop(), established.categoryRun.stop(),
          ...(established.diaryRun ? [established.diaryRun.stop()] : []),
        ])).then(results => {
          if (results.some(result => result.status === 'rejected'))
            throw new Error('Candidate core shutdown unconfirmed; writer lease retained');
        });
        await cancellation;
      };
      const stop = async () => {
        // Pausing is local and works after JWT expiry. Release remains a
        // separate signed operation; failure never permits another start.
        await pause();
        await established.lease.release();
        active = null;
      };
      return {
        taskState: taskRun.state,
        categoryState: categoryRun.state,
        ...(diaryRun ? { diaryState: diaryRun.state } : {}),
        async awaitInitialReplication() {
          await Promise.all([
            established.taskRun.state.awaitInitialReplication(),
            established.categoryRun.state.awaitInitialReplication(),
            ...(established.diaryRun
              ? [established.diaryRun.state.awaitInitialReplication()] : []),
          ]);
          const latest = await checkedOwner();
          if (active !== established || cancellation || !established.lease.isCurrent() ||
              latest.sessionEpoch !== established.signed.sessionEpoch ||
              latest.accessToken !== established.signed.accessToken) {
            throw new CandidateAuthError('Candidate core session or lease changed during initial sync');
          }
        },
        async resync() {
          if (active !== established || cancellation || !established.lease.isCurrent())
            throw new Error('Candidate core replication no longer active');
          const latest = await checkedOwner();
          if (active !== established || cancellation || !established.lease.isCurrent())
            throw new Error('Candidate core replication no longer active');
          if (latest.sessionEpoch !== established.signed.sessionEpoch ||
              latest.accessToken !== established.signed.accessToken)
            throw new CandidateAuthError('Candidate core session replaced; stop and restart with fresh owner lease');
          established.taskRun.resync();
          established.categoryRun.resync();
          established.diaryRun?.resync();
        },
        stop,
        pause,
        getPendingConflicts: conflicts,
        subscribeConflicts(listener: () => void) {
          const subscriptions = [
            tasks.conflictEvents$.subscribe(listener), categories.conflictEvents$.subscribe(listener),
            ...(diary ? [diary.conflictEvents$.subscribe(listener)] : []),
          ];
          listener();
          return () => subscriptions.forEach(subscription => subscription.unsubscribe());
        },
        refreshConflict: (domain: 'tasks' | 'categories' | 'diary', id: string) =>
          review(() => pilot(domain).refreshPendingConflict(id)),
        keepLocalConflict: (domain: 'tasks' | 'categories' | 'diary', id: string, revision: string) =>
          review(() => pilot(domain).resolveKeepLocal(id, revision)),
      };
    } catch (error) {
      // No partially started writer may continue if verification or a second
      // collection startup failed. Always release the lease on failure.
      const cleanup = await Promise.allSettled([
        ...(diaryRun ? [diaryRun.stop()] : []),
        ...(categoryRun ? [categoryRun.stop()] : []),
        ...(taskRun ? [taskRun.stop()] : []),
      ]);
      // If either replication cannot be stopped, deliberately retain the
      // writer lease so another backend can NEVER take over prematurely.
      if (cleanup.some(result => result.status === 'rejected'))
        throw new Error('Candidate core shutdown unconfirmed; writer lease retained', { cause: error });
      if (lease) await lease.release();
      active = null;
      throw error;
    } finally {
      starting = false;
    }
  }

  return { start };
}
