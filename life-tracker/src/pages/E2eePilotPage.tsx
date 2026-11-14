import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from '../lib/appwriteConfig';
import {
  decryptDiary, encryptDiary, formatIndependentRecoverySecret,
  generateAccountRoot, generateIndependentRecoverySecret, generateKeyId,
  generateOpaqueRowId, generateRevision, parseIndependentRecoverySecret,
  unwrapRootFromRecovery, wrapRootForRecovery,
  type Bytes, type Owner,
} from '../lib/crypto/pilotCrypto';
import {
  clearPendingPilotCiphertext, listPendingPilotCiphertext,
  rememberPilotDevice, savePendingPilotCiphertext,
  unlockRememberedPilotDevice, type PendingCiphertext,
} from '../lib/crypto/pilotDeviceStore';
import {
  createPilotRoot, fetchPilotRoot, listPilotRows, putPilotRow,
  type PilotRemoteRow,
} from '../lib/crypto/pilotTransport';

type ViewRow = PilotRemoteRow & { text: string; emoji: string; failed: boolean };
type Stage = 'checking' | 'locked' | 'back-up-key' | 'ready';
type PendingSetup = { root: Bytes; secret: Bytes; kid: string };

const scratchProjectId = '6ae94a2100014d01f5ed';
const scratchEndpoint = 'https://129-221-244-67.sslip.io/v1';
const scratch = APPWRITE_PROJECT_ID === scratchProjectId &&
  APPWRITE_ENDPOINT === scratchEndpoint;

export default function E2eePilotPage() {
  const { user, mfaPending, isLoading } = useAuth();
  const [stage, setStage] = useState<Stage>('checking');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [keyId, setKeyId] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [content, setContent] = useState('');
  const [emoji, setEmoji] = useState('');
  const [rows, setRows] = useState<ViewRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const rootRef = useRef<Bytes | null>(null);
  const pendingSetupRef = useRef<PendingSetup | null>(null);
  const generationRef = useRef(0);
  const ownerId = user?.$id ?? '';
  const active = scratch && Boolean(ownerId) && !mfaPending && !isLoading;
  const owner: Owner = { projectId: APPWRITE_PROJECT_ID, ownerId };

  useEffect(() => {
    // Full-MFA authenticated user identity is a prerequisite. A remembered
    // key is never an authentication factor and cannot bypass a partial session.
    const generation = ++generationRef.current;
    rootRef.current?.fill(0);
    rootRef.current = null;
    pendingSetupRef.current = null;
    setKeyId(''); setRecoveryKey(''); setRecoveryInput('');
    setAcknowledged(false); setSelectedId(null);
    setRows([]); setPendingCount(0); setCursor(null);
    setStage('checking'); setMessage('');
    if (!scratch || !ownerId || mfaPending || isLoading) return;
    const scope = { projectId: APPWRITE_PROJECT_ID, ownerId };
    void unlockRememberedPilotDevice(scope).then((found) => {
      if (generation !== generationRef.current) return;
      if (found) {
        rootRef.current = found.root;
        setKeyId(found.kid); setStage('ready');
      } else {
        setStage('locked');
      }
    }).catch(() => {
      if (generation === generationRef.current) {
        setStage('locked');
        setMessage('This device cannot unlock the pilot. Use your saved recovery key.');
      }
    });
    return () => {
      ++generationRef.current;
      rootRef.current?.fill(0);
      rootRef.current = null;
      pendingSetupRef.current = null;
    };
  }, [ownerId, mfaPending, isLoading]);

  function requireOwner(): { scope: Owner; root: Bytes; kid: string; generation: number } {
    if (!active || stage !== 'ready' || !rootRef.current || !keyId) {
      throw new Error('Encrypted pilot is locked.');
    }
    return { scope: owner, root: rootRef.current, kid: keyId,
      generation: generationRef.current };
  }

  async function guarded(action: () => Promise<void>) {
    if (!active || busy) return;
    setBusy(true); setMessage('');
    try { await action(); }
    catch { setMessage('Operation unavailable or the encrypted data could not be verified. No content was discarded.'); }
    finally { setBusy(false); }
  }

  function prepare() {
    if (!active || stage !== 'locked' || busy) return;
    const root = generateAccountRoot();
    const secret = generateIndependentRecoverySecret();
    const kid = generateKeyId();
    pendingSetupRef.current = { root, secret, kid };
    setRecoveryKey(formatIndependentRecoverySecret(secret));
    setAcknowledged(false);
    setStage('back-up-key');
  }

  async function activate() {
    await guarded(async () => {
      const setup = pendingSetupRef.current;
      if (!setup || !acknowledged) return;
      const generation = generationRef.current;
      const envelope = await wrapRootForRecovery(setup.root, setup.secret, owner, setup.kid);
      await createPilotRoot(owner, envelope);
      // After successful remote write, still require a verified remote read.
      const stored = await fetchPilotRoot(owner);
      if (JSON.stringify(stored) !== JSON.stringify(envelope)) {
        throw new Error('Encrypted recovery envelope mismatch');
      }
      await rememberPilotDevice(setup.root, owner, setup.kid);
      if (generation !== generationRef.current) return;
      rootRef.current = setup.root;
      setKeyId(setup.kid); setStage('ready'); setMessage('Test device registered; encrypted root verified.');
      pendingSetupRef.current = null;
      setRecoveryKey('');
    });
  }

  async function recover() {
    await guarded(async () => {
      if (stage !== 'locked') return;
      const generation = generationRef.current;
      const secret = parseIndependentRecoverySecret(recoveryInput);
      const stored = await fetchPilotRoot(owner);
      const root = await unwrapRootFromRecovery(secret, owner, stored);
      await rememberPilotDevice(root, owner, stored.kid);
      if (generation !== generationRef.current) { root.fill(0); return; }
      rootRef.current = root;
      setKeyId(stored.kid); setRecoveryInput(''); setStage('ready');
      setMessage('Root recovered and this device remembered.');
    });
  }

  async function refresh(append = false) {
    await guarded(async () => {
      const { scope, root, kid, generation } = requireOwner();
      const result = await listPilotRows(scope, append && cursor ? cursor : undefined);
      const items: ViewRow[] = [];
      for (const row of result.rows) {
        if (!/^p_[a-f0-9]{32}$/.test(row.rowId) || row.keyId !== kid) {
          items.push({ ...row, text: '', emoji: '', failed: true });
          continue;
        }
        try {
          const plain = await decryptDiary(root, {
            ...scope, rowId: row.rowId, keyId: row.keyId, revision: row.revision,
          }, JSON.parse(row.envelope));
          items.push({ ...row, text: plain.content, emoji: plain.emoji, failed: false });
        } catch {
          items.push({ ...row, text: '', emoji: '', failed: true });
        }
      }
      if (generation !== generationRef.current) return;
      setRows(old => append ? [...old, ...items] : items);
      setCursor(result.after);
      setPendingCount((await listPendingPilotCiphertext(scope)).length);
    });
  }

  async function commit(deleted = false) {
    await guarded(async () => {
      const { scope, root, kid, generation } = requireOwner();
      const selected = rows.find(row => row.rowId === selectedId);
      if (selected && (selected.failed || selected.keyId !== kid || selected.deleted)) {
        throw new Error('Cannot overwrite an unreadable or deleted ciphertext.');
      }
      if (!deleted && !content.trim() && !emoji.trim()) {
        setMessage('Enter private test text before saving.');
        return;
      }
      if (deleted && !selected) return;
      const rowId = selected?.rowId ?? generateOpaqueRowId();
      const revision = generateRevision();
      const envelope = await encryptDiary(root, {
        ...scope, rowId, keyId: kid, revision,
      }, deleted ? { content: '', emoji: '' } : { content, emoji });
      const intent: PendingCiphertext = {
        rowId, opId: 'o_' + generateRevision().slice(2),
        expectedRevision: selected?.revision ?? null,
        envelope, deleted,
      };
      // Save EXACT ciphertext and op ID first. A retry must not generate a
      // different IV or revision after a lost network response.
      await savePendingPilotCiphertext(scope, intent);
      if (generation !== generationRef.current) return;
      setPendingCount((await listPendingPilotCiphertext(scope)).length);
      try {
        await putPilotRow(scope, intent);
        await clearPendingPilotCiphertext(scope, intent.opId);
      } catch {
        setMessage('Encrypted operation queued locally. Reconnect and select Sync pending.');
        return;
      }
      if (generation !== generationRef.current) return;
      setContent(''); setEmoji(''); setSelectedId(null);
      setPendingCount((await listPendingPilotCiphertext(scope)).length);
      setMessage('Ciphertext committed. Refresh to verify decryption.');
    });
  }

  async function syncPending() {
    await guarded(async () => {
      const { scope, generation } = requireOwner();
      const queued = await listPendingPilotCiphertext(scope);
      for (const item of queued) {
        if (generation !== generationRef.current) return;
        // Do not send even ciphertext while the account has changed/locked.
        await putPilotRow(scope, item);
        if (generation !== generationRef.current) return;
        await clearPendingPilotCiphertext(scope, item.opId);
      }
      if (generation === generationRef.current) {
        setPendingCount((await listPendingPilotCiphertext(scope)).length);
        setMessage('Encrypted pending operations synchronized.');
      }
    });
  }

  if (!scratch) return <main className="p-6 text-sm">Encrypted Diary pilot is unavailable outside Oracle Scratch.</main>;
  if (!user || mfaPending || isLoading) return <main className="p-6 text-sm">Complete normal sign-in and 2FA before unlocking this pilot.</main>;

  return <main className="mx-auto max-w-2xl p-4 pb-24 text-sm text-foreground space-y-5">
    <header className="space-y-2">
      <h1 className="text-xl font-semibold">Private Diary encryption pilot</h1>
      <p className="text-muted-foreground">
        Experimental, disposable Scratch data only. This editor is separate from
        your normal Diary. No six-digit PIN vault, migration, photo encryption,
        multi-device key approval or production E2EE is enabled.
      </p>
    </header>
    {message && <p role="status" className="rounded-xl border border-border p-3">{message}</p>}
    {stage === 'checking' && <p role="status">Checking remembered encrypted device…</p>}
    {stage === 'locked' && <section className="space-y-4 rounded-2xl border border-border p-4">
      <h2 className="font-semibold">Recovery required</h2>
      <p>This device does not have the encryption key. Existing ciphertext is preserved.</p>
      <label className="block space-y-1">
        <span>Independent high-entropy recovery key (pilot only; not a six-digit PIN)</span>
        <input type="password" autoComplete="off" spellCheck={false}
          aria-label="Encrypted recovery key" value={recoveryInput}
          onChange={event => setRecoveryInput(event.target.value)}
          className="w-full rounded-xl border border-border bg-transparent p-3" />
      </label>
      <button disabled={busy || !recoveryInput.trim()} onClick={() => void recover()}
        className="rounded-xl border border-border px-4 py-2 disabled:opacity-50">
        Recover on this device
      </button>
      <button disabled={busy} onClick={prepare}
        className="ml-2 rounded-xl border border-border px-4 py-2 disabled:opacity-50">
        Initialize new synthetic-only account key
      </button>
      <p className="text-muted-foreground">
        Initialization is rejected if this account already has a recovery envelope.
        Never regenerate a key to replace unreadable ciphertext.
      </p>
    </section>}
    {stage === 'back-up-key' && <section className="space-y-3 rounded-2xl border border-border p-4">
      <h2 className="font-semibold">Save this one-time pilot recovery key</h2>
      <p>If browser storage is cleared, this is needed to unlock encrypted test data.
        There is no account-email or MFA recovery substitute.</p>
      <input readOnly value={recoveryKey} aria-label="One-time high-entropy recovery key"
        className="w-full rounded-xl border border-border bg-transparent p-3 font-mono text-xs" />
      <label className="flex gap-2 items-center">
        <input type="checkbox" checked={acknowledged}
          onChange={event => setAcknowledged(event.target.checked)} />
        I have saved the recovery key separately.
      </label>
      <button disabled={busy || !acknowledged} onClick={() => void activate()}
        className="rounded-xl border border-border px-4 py-2 disabled:opacity-50">
        Verify and initialize encrypted pilot
      </button>
    </section>}
    {stage === 'ready' && <>
      <section className="space-y-3 rounded-2xl border border-border p-4">
        <h2 className="font-semibold">Encrypted test entry</h2>
        <p className="text-muted-foreground">
          {selectedId ? 'Editing an existing ciphertext revision' : 'Creating a new independent ciphertext row'}
        </p>
        <label className="block space-y-1">
          <span>Emoji (optional)</span>
          <input value={emoji} maxLength={32} onChange={event => setEmoji(event.target.value)}
            className="w-full rounded-xl border border-border bg-transparent p-3" />
        </label>
        <label className="block space-y-1">
          <span>Private test text</span>
          <textarea value={content} rows={6} onChange={event => setContent(event.target.value)}
            className="w-full rounded-xl border border-border bg-transparent p-3" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={() => void commit()}
            className="rounded-xl border border-border px-4 py-2 disabled:opacity-50">Save ciphertext</button>
          <button disabled={busy || !selectedId} onClick={() => void commit(true)}
            className="rounded-xl border border-border px-4 py-2 disabled:opacity-50">Delete (tombstone)</button>
          <button disabled={busy} onClick={() => {
            setContent(''); setEmoji(''); setSelectedId(null);
          }} className="rounded-xl border border-border px-4 py-2 disabled:opacity-50">New entry</button>
        </div>
      </section>
      <section className="space-y-3 rounded-2xl border border-border p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <button disabled={busy} onClick={() => void refresh()}
            className="rounded-xl border border-border px-4 py-2 disabled:opacity-50">Refresh and decrypt</button>
          <button disabled={busy || pendingCount === 0} onClick={() => void syncPending()}
            className="rounded-xl border border-border px-4 py-2 disabled:opacity-50">
            Sync pending ({pendingCount})
          </button>
        </div>
        {rows.map(row => <div key={row.rowId}
          className="rounded-xl border border-border p-3 space-y-1">
          <p className="font-mono text-xs text-muted-foreground">{row.rowId}</p>
          {row.failed ? <p role="alert">Ciphertext could not be verified. Original bytes preserved.</p>
            : row.deleted ? <p>Deleted (encrypted tombstone)</p>
              : <p>{row.emoji} {row.text}</p>}
          {!row.failed && !row.deleted && <button disabled={busy}
            onClick={() => {
              setSelectedId(row.rowId); setContent(row.text); setEmoji(row.emoji);
            }} className="rounded-lg border border-border px-3 py-1 disabled:opacity-50">Edit</button>}
        </div>)}
        {cursor && <button disabled={busy} onClick={() => void refresh(true)}
          className="rounded-xl border border-border px-4 py-2 disabled:opacity-50">Load more ciphertext</button>}
      </section>
    </>}
  </main>;
}
