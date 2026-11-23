import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { account } from '../lib/appwrite';
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from '../lib/appwriteConfig';
import type { Owner } from '../lib/e2ee/coreCrypto';
import {
  InitialRootEnrollment, recoverAccountRoot, unlockRememberedAccountRoot,
  type CryptoSession, type FullyAuthenticatedSessionGate,
} from '../lib/e2ee/accountRootLifecycle';
import { indexedDbRememberedRoots } from '../lib/e2ee/rememberedRootIndexedDb';
import {
  createScratchOwnerRpc, rootTransportFromRpc,
  prepareEncryptedOwnerMutation, scanAndDecryptOwnerCollection,
  OWNER_ONLY_COLLECTIONS, type OwnerOnlyCollection,
} from '../lib/e2ee/ownerCiphertextTransport';
import {
  queueEncryptedOwnerIntent, listEncryptedOwnerIntents,
  replayEncryptedOwnerIntents,
} from '../lib/e2ee/encryptedOwnerOutbox';
import {
  openPrivateMedia, sealPrivateMedia, type EncryptedMedia,
} from '../lib/e2ee/privateMediaCodec';
import {
  uploadEncryptedOwnerMedia, downloadEncryptedOwnerMedia,
} from '../lib/e2ee/ownerEncryptedMediaTransport';
import { syntheticDoc } from '../lib/e2ee/m2SyntheticRecord';

const SCRATCH = '6b00671500279e901846';
const ENDPOINT = 'https://129-221-244-67.sslip.io/v1';
type Stage = 'checking' | 'new' | 'recovery' | 'backup' | 'ready';
type PrivateRow = Record<string, unknown> & { __e2eeRevision: string };
const names: Record<OwnerOnlyCollection, string> = {
  tasks: 'Tasks', categories: 'Categories', diary: 'Diary',
  bucketList: 'Bucket List', bucketTaskLinks: 'Bucket-task links',
  settings: 'Settings',
};

function display(row: PrivateRow): string {
  const text = row.title ?? row.name ?? row.content ?? row.value ??
    row.bucketListId ?? row.key ?? 'Private record';
  return typeof text === 'string' ? text.slice(0, 90) : 'Private record';
}
/** Separate opt-in surface: NOT the normal RxDB sync or full M2 cutover. */
export default function E2eeM2Page() {
  const { user, mfaPending, isLoading } = useAuth();
  if (APPWRITE_PROJECT_ID !== SCRATCH || APPWRITE_ENDPOINT !== ENDPOINT) {
    return <main className="p-6 text-sm">M2 synthetic lab is unavailable outside isolated Scratch.</main>;
  }
  if (isLoading || mfaPending || !user) {
    return <main className="p-6 text-sm">Complete sign-in and MFA to use the M2 synthetic lab.</main>;
  }
  return <OwnerLab key={user.$id} ownerId={user.$id} />;
}

function OwnerLab({ ownerId }: { ownerId: string }) {
  const [stage, setStage] = useState<Stage>('checking');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [savedKey, setSavedKey] = useState('');
  const [retypedKey, setRetypedKey] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [collection, setCollection] = useState<OwnerOnlyCollection>('tasks');
  const [value, setValue] = useState('');
  const [linkedBucket, setLinkedBucket] = useState('');
  const [linkedTask, setLinkedTask] = useState('');
  const [records, setRecords] = useState<PrivateRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [pending, setPending] = useState(0);
  const [mediaStatus, setMediaStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<EncryptedMedia | null>(null);
  const mediaSourceRef = useRef<File | null>(null);
  const rootRef = useRef<CryptoSession | null>(null);
  const enrollmentRef = useRef<InitialRootEnrollment | null>(null);
  const runningRef = useRef(false);
  const generationRef = useRef(0);

  const owner: Owner = { projectId: SCRATCH, ownerId };
  const rpc = createScratchOwnerRpc(owner);
  const remote = rootTransportFromRpc(rpc);
  const gate: FullyAuthenticatedSessionGate = {
    async assertReady(input: Owner): Promise<void> {
      if (input.projectId !== SCRATCH || input.ownerId !== ownerId) {
        throw new Error('Account identity changed.');
      }
      // A cached remembered root is never a substitute for live Appwrite
      // authentication. The Function independently enforces completed MFA.
      const current = await account.get();
      if (current.$id !== ownerId) throw new Error('Authenticated owner changed.');
    },
  };

  useEffect(() => {
    const generation = ++generationRef.current;
    (async () => {
      try {
        const current = await remote.read(owner);
        if (generationRef.current !== generation) return;
        if (!current) {
          setStage('new');
          return;
        }
        const unlocked = await unlockRememberedAccountRoot(
          owner, gate, remote, indexedDbRememberedRoots,
        );
        if (generationRef.current !== generation) {
          unlocked?.root.fill(0);
          return;
        }
        if (unlocked) {
          rootRef.current = unlocked;
          setStage('ready');
        } else {
          setStage('recovery');
        }
      } catch {
        if (generationRef.current === generation) {
          setStage('recovery');
          setStatus('M2 may still be disabled or unavailable. No keys or records were changed.');
        }
      }
    })();
    return () => {
      if (generationRef.current === generation) generationRef.current++;
      rootRef.current?.root.fill(0);
      rootRef.current = null;
      enrollmentRef.current = null;
      mediaRef.current = null;
      mediaSourceRef.current = null;
    };
    // Authentication owns the keyed component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId]);

  function requireRoot(): CryptoSession {
    if (stage !== 'ready' || !rootRef.current) {
      throw new Error('M2 encryption key locked.');
    }
    return rootRef.current;
  }
  async function execute(
    action: () => Promise<void>, onFailure?: (error: unknown) => void,
  ): Promise<void> {
    if (runningRef.current) return;
    runningRef.current = true;
    const generation = generationRef.current;
    setBusy(true);
    setStatus('');
    try {
      await action();
    } catch (error) {
      if (generationRef.current === generation) {
        if (onFailure) onFailure(error);
        else setStatus('Operation unavailable or not verified. Existing encrypted data and queued writes were preserved.');
      }
    } finally {
      runningRef.current = false;
      if (generationRef.current === generation) setBusy(false);
    }
  }

  function prepareRoot(): void {
    void execute(async () => {
      const candidate = await InitialRootEnrollment.prepare(owner);
      enrollmentRef.current = candidate;
      setSavedKey(candidate.displayRecoveryKey);
      setRetypedKey('');
      setStage('backup');
    });
  }
  function activateRoot(): void {
    void execute(async () => {
      const candidate = enrollmentRef.current;
      if (!candidate || !retypedKey.trim()) return;
      await candidate.confirmSavedRecoveryKey(retypedKey);
      const session = await candidate.commit(gate, remote, indexedDbRememberedRoots);
      rootRef.current = session;
      enrollmentRef.current = null;
      setSavedKey(''); setRetypedKey(''); setStage('ready');
      setStatus('Root created and remote recovery envelope verified.');
    });
  }
  function recoverRoot(): void {
    void execute(async () => {
      const session = await recoverAccountRoot(
        owner, recoveryInput, gate, remote, indexedDbRememberedRoots,
      );
      rootRef.current = session;
      setRecoveryInput('');
      setStage('ready');
      setStatus('Independent recovery key verified; device remembered.');
    });
  }

  async function scan(only: OwnerOnlyCollection = collection): Promise<void> {
    const session = requireRoot();
    const docs = await scanAndDecryptOwnerCollection(owner, session, only, rpc, gate);
    setRecords(docs.filter(doc => doc.isDeleted !== true));
    setPending((await listEncryptedOwnerIntents(owner)).length);
  }

  function refresh(): void {
    void execute(async () => {
      await scan();
      setStatus('Encrypted remote records decrypted and verified.');
    });
  }
  function write(deleted = false): void {
    void execute(async () => {
      const session = requireRoot();
      const existing = records.find(row => row.id === selectedId);
      if (deleted && !existing) return;
      if (!deleted && collection !== 'bucketTaskLinks' && !value.trim()) return;
      const doc = existing
        ? syntheticDoc(ownerId, collection, value.trim(), linkedBucket, linkedTask, existing)
        : syntheticDoc(ownerId, collection, value.trim(), linkedBucket, linkedTask);
      if (deleted) doc.isDeleted = true;
      const mutation = await prepareEncryptedOwnerMutation(
        owner, session, collection, doc,
        existing ? existing.__e2eeRevision : null,
      );
      // Persist identical ciphertext + IV + op ID BEFORE attempting network.
      await queueEncryptedOwnerIntent(owner, mutation);
      setPending((await listEncryptedOwnerIntents(owner)).length);
      try {
        await replayEncryptedOwnerIntents(owner, session, rpc, gate);
      } catch {
        setStatus('Ciphertext retained locally. Reconnect and select Sync pending.');
        return;
      }
      setSelectedId(''); setValue('');
      await scan();
      setStatus('Ciphertext committed, fetched and decrypted.');
    });
  }
  function syncPending(): void {
    void execute(async () => {
      const session = requireRoot();
      const count = await replayEncryptedOwnerIntents(owner, session, rpc, gate);
      await scan();
      setStatus('Authenticated encrypted operations synced: ' + String(count));
    });
  }
  function checkMedia(): void {
    void execute(async () => {
      const session = requireRoot();
      const source = fileRef.current?.files?.[0];
      if (!source) {
        setMediaStatus('Choose a synthetic photo to verify locally.');
        return;
      }
      setMediaStatus('Checking local encryption and decryption…');
      const payload = await sealPrivateMedia(session.root, owner, session.keyId, source);
      const recovered = await openPrivateMedia(
        session.root, owner, payload.manifest, payload.ciphertext,
      );
      const a = new Uint8Array(await source.arrayBuffer());
      const b = new Uint8Array(await recovered.arrayBuffer());
      if (a.length !== b.length || a.some((byte, index) => byte !== b[index])) {
        throw new Error('Local media AEAD mismatch.');
      }
      setMediaStatus('Local photo encryption/decryption verified. To test the remote server, select Upload and verify encrypted photo.');
    }, () => setMediaStatus('Local photo encryption/decryption failed. No remote upload was attempted.'));
  }

  function remoteMediaFailure(error: unknown): void {
    // Never display raw server/SDK error messages; they can include private context.
    const code = error && typeof error === 'object' && 'code' in error
      ? (error as { code?: unknown }).code : undefined;
    const rawPhase = error && typeof error === 'object' && 'phase' in error
      ? (error as {phase?:unknown}).phase : undefined;
    const phase = ['upload','ack','readback','decrypt'].includes(String(rawPhase))
      ? String(rawPhase) : 'local preparation or network';
    const timedOut = Boolean(error && typeof error === 'object' &&
      'timedOut' in error && (error as {timedOut?:unknown}).timedOut === true);
    const reason = typeof code === 'number' && Number.isSafeInteger(code) &&
      code >= 400 && code <= 599 ? 'HTTP ' + code :
      timedOut ? 'request timeout' : 'no verified HTTP status';
    // Only whitelisted stage/code metadata; never show private SDK messages.
    const rawServerReason = error && typeof error === 'object' &&
      'reason' in error ? (error as {reason?:unknown}).reason : undefined;
    const safeServerReasons = [
      'storage_write_forbidden', 'storage_bucket_missing',
      'storage_size_rejected', 'storage_rate_limited',
      'storage_request_rejected', 'storage_service_unavailable',
      'storage_write_unknown', 'storage_readback_unavailable',
      'storage_transport_dns', 'storage_transport_refused',
      'storage_transport_timeout', 'storage_transport_reset',
      'storage_transport_tls', 'storage_transport_payload',
      'storage_transport_unknown', 'storage_sdk_input',
    ];
    const serverReason = typeof rawServerReason === 'string' &&
      safeServerReasons.includes(rawServerReason)
      ? ' Storage: ' + rawServerReason + '.' : '';
    const detail = ' Stage: ' + phase + '. Result: ' + reason + '.' + serverReason;
    if (code === 401 || code === 403) {
      setMediaStatus('Remote encrypted-photo access was denied. Check the synthetic Scratch login, MFA and server gate.' + detail + ' The selected file can be retried.');
    } else {
      setMediaStatus('Remote photo upload or readback did not complete.' + detail + ' The server may have received some chunks; retry the same selected file to reuse its original ciphertext.');
    }
  }

  function uploadMedia(): void {
    void execute(async () => {
      const session = requireRoot();
      const source = fileRef.current?.files?.[0];
      if (!source) {
        setMediaStatus('Choose a synthetic photo before testing remote upload.');
        return;
      }
      setMediaStatus('Encrypting selected photo locally…');
      // The ciphertext is retained in memory during retries, preventing a
      // new random media ID/nonce from replacing a lost upload ACK. This is
      // NOT a persistent offline media outbox or a normal-app media editor.
      if (mediaSourceRef.current !== source || !mediaRef.current) {
        mediaRef.current = await sealPrivateMedia(
          session.root, owner, session.keyId, source,
        );
        mediaSourceRef.current = source;
      }
      const sealed = mediaRef.current;
      setMediaStatus('Uploading encrypted photo chunks to Scratch…');
      await uploadEncryptedOwnerMedia(owner, session, sealed, rpc, gate,
        (done,total) => {
          if (rootRef.current === session) {
            setMediaStatus('Ciphertext chunks uploaded and read back: ' + done + '/' + total);
          }
        });
      setMediaStatus('Downloading and decrypting the remote ciphertext…');
      const recovered = await downloadEncryptedOwnerMedia(
        owner, session, sealed.manifest, rpc, gate,
      );
      const a = new Uint8Array(await source.arrayBuffer());
      const b = new Uint8Array(await recovered.arrayBuffer());
      if (a.length !== b.length || a.some((byte,index)=>byte!==b[index])) {
        throw new Error('Remote media AEAD mismatch.');
      }
      setMediaStatus('Synthetic encrypted photo upload, server readback and local decryption verified.');
    }, remoteMediaFailure);
  }

  const selected = records.find(row => row.id === selectedId);
  return <main className="mx-auto max-w-2xl space-y-5 p-4 pb-24 text-sm text-foreground">
    <header className="space-y-2">
      <h1 className="text-xl font-semibold">Private data E2EE — M2 test lab</h1>
      <p className="text-muted-foreground">
        Isolated Scratch and synthetic data only. This is not the normal Mosaic
        sync engine, not a Production encryption release, and not a replacement
        for old-client write-denial testing.
      </p>
    </header>
    {status && <p role="status" className="rounded-lg border p-3">{status}</p>}
    {stage === 'checking' && <p>Checking the authenticated owner root…</p>}
    {stage === 'new' && <section className="space-y-3">
      <h2 className="font-semibold">Set up an independent encryption root</h2>
      <p>Save a new 256-bit emergency recovery key before creating any remote root.</p>
      <button disabled={busy} onClick={prepareRoot} className="rounded-lg border p-3">Generate emergency recovery key</button>
    </section>}
    {stage === 'backup' && <section className="space-y-3">
      <h2 className="font-semibold">Save the key somewhere private</h2>
      <p className="break-all font-mono select-all">{savedKey}</p>
      <label className="block">Re-enter your independently saved recovery key
        <input aria-label="Confirm saved M2 recovery key" value={retypedKey}
          onChange={e => setRetypedKey(e.target.value)}
          className="w-full rounded-lg border p-3" autoComplete="off" />
      </label>
      <button disabled={busy || !retypedKey.trim()} onClick={activateRoot}
        className="rounded-lg border p-3">Verify key and initialize root</button>
    </section>}
    {stage === 'recovery' && <section className="space-y-3">
      <h2 className="font-semibold">Unlock existing encrypted root</h2>
      <label className="block">Saved independent recovery key
        <input aria-label="M2 recovery key" value={recoveryInput}
          onChange={e => setRecoveryInput(e.target.value)}
          className="w-full rounded-lg border p-3" autoComplete="off" />
      </label>
      <button disabled={busy || !recoveryInput.trim()} onClick={recoverRoot}
        className="rounded-lg border p-3">Recover and remember this device</button>
      <p>Do not reset or overwrite an unknown root; retry when authenticated MFA is ready.</p>
    </section>}
    {stage === 'ready' && <section className="space-y-4">
      <h2 className="font-semibold">Six synthetic private-data domains</h2>
      <label className="block">Data type
        <select aria-label="Private data type" value={collection} disabled={busy}
          onChange={e => {
            setCollection(e.target.value as OwnerOnlyCollection);
            setRecords([]); setSelectedId(''); setValue(''); setStatus('');
          }} className="w-full rounded-lg border p-3">
          {OWNER_ONLY_COLLECTIONS.map(id => <option key={id} value={id}>{names[id]}</option>)}
        </select>
      </label>
      <label className="block">Entry
        <input aria-label="Synthetic entry text" value={value} disabled={busy}
          onChange={e => setValue(e.target.value)}
          className="w-full rounded-lg border p-3" />
      </label>
      {collection === 'bucketTaskLinks' && <>
        <label className="block">Bucket List local ID
          <input aria-label="Bucket List ID" value={linkedBucket}
            onChange={e => setLinkedBucket(e.target.value)}
            className="w-full rounded-lg border p-3" />
        </label>
        <label className="block">Task local ID
          <input aria-label="Linked task ID" value={linkedTask}
            onChange={e => setLinkedTask(e.target.value)}
            className="w-full rounded-lg border p-3" />
        </label>
      </>}
      <div className="flex flex-wrap gap-2">
        <button disabled={busy || (collection !== 'bucketTaskLinks' && !value.trim())}
          onClick={() => write()} className="rounded-lg border p-3">
          {selected ? 'Update encrypted entry' : 'Add encrypted entry'}
        </button>
        <button disabled={busy || !selected} onClick={() => write(true)}
          className="rounded-lg border p-3">Delete encrypted entry</button>
        <button disabled={busy} onClick={refresh} className="rounded-lg border p-3">
          Refresh and decrypt
        </button>
        <button disabled={busy} onClick={syncPending} className="rounded-lg border p-3">
          Sync pending ({pending})
        </button>
      </div>
      <div className="space-y-2">
        {records.length === 0 && <p className="text-muted-foreground">No verified entries loaded.</p>}
        {records.map(row => <button key={String(row.id)}
          aria-pressed={selectedId === row.id}
          onClick={() => {
            setSelectedId(String(row.id)); setValue(display(row));
          }} className="block w-full rounded-lg border p-3 text-left">
          <span className="block break-words">{display(row)}</span>
          <span className="block text-xs text-muted-foreground">Local ID: {String(row.id)}</span>
        </button>)}
      </div>
      <div className="space-y-2 border-t pt-4">
        <h3 className="font-semibold">Encrypted synthetic media check</h3>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
          aria-label="Synthetic photo" disabled={busy}
          onChange={() => {
            // A newly selected file must not inherit the old test result or
            // ciphertext; retries for an unchanged file reuse the original IV.
            mediaRef.current = null;
            mediaSourceRef.current = null;
            setMediaStatus('');
          }} />
        <button disabled={busy} onClick={checkMedia} className="rounded-lg border p-3">
          Verify local photo encryption
        </button>
        <button disabled={busy} onClick={uploadMedia} className="rounded-lg border p-3">
          Upload and verify encrypted photo
        </button>
        {mediaStatus && <p role="status">{mediaStatus}</p>}
        <p className="text-muted-foreground">
          Remote testing uses the separately approved synthetic-account M2 server gate.
          Local verification alone does not upload a file. Normal-app photo sync,
          durable offline photo retries and orphan cleanup remain unverified.
        </p>
      </div>
    </section>}
  </main>;
}
