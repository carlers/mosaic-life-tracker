import { APP_VERSION } from './appVersion';
import { hashString } from './settingsRowId';

const TODOMATE_FIREBASE_INIT_URL =
  'https://www.todomate.net/__/firebase/init.json';
const IDENTITY_TOOLKIT_URL =
  'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';

const TODOMATE_FIREBASE_FALLBACK = {
  apiKey: 'AIzaSyCtSjt1LBEXmQnZdjD8DOPXBc5I1acm0Ew',
  projectId: 'mate-914f3',
} as const;

type JsonRecord = Record<string, unknown>;

interface TodoMateCredentials {
  email: string;
  password: string;
}

export interface TodoMateProgress {
  message: string;
  percent: number;
  completed?: number;
  total?: number;
}

interface TodoMateImportOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  onProgressDetail?: (progress: TodoMateProgress) => void;
  photoProcessor?: (file: File) => Promise<Blob>;
  signal?: AbortSignal;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const error = new Error('TodoMate preview cancelled.');
  error.name = 'AbortError';
  throw error;
}

interface FirestoreRecord {
  id: string;
  fields: JsonRecord;
  createTime: string;
  updateTime: string;
}

interface PreparedTodoMatePhoto {
  sourceId: string;
  bytes: Uint8Array;
}

const TODOMATE_PHOTO_CONCURRENCY = 4;
const MAX_TODOMATE_PHOTO_BYTES = 20 * 1024 * 1024;

function photoSourceId(todoId: string, photoUrl: string): string {
  let stableUrl = photoUrl;
  try {
    const parsed = new URL(photoUrl);
    stableUrl = `${parsed.origin}${parsed.pathname}`;
  } catch {
    // Invalid URLs are rejected before download. Keeping the raw value here only
    // makes the deterministic ID stable for tests/callers that inspect it.
  }

  return `tmimg_${hashString(`${todoId}:${stableUrl}`)}`;
}

function googleStorageHost(hostname: string): boolean {
  return (
    hostname === 'firebasestorage.googleapis.com' ||
    hostname === 'storage.googleapis.com' ||
    hostname.endsWith('.storage.googleapis.com')
  );
}

function inferredImageType(url: URL, responseType: string): string {
  if (responseType.startsWith('image/')) return responseType;
  const pathname = url.pathname.toLowerCase();
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.webp')) return 'image/webp';
  if (pathname.endsWith('.gif')) return 'image/gif';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  return responseType || 'image/jpeg';
}

async function defaultPhotoProcessor(file: File): Promise<Blob> {
  const { compressImage } = await import('./storage');
  return compressImage(file);
}

async function fetchTodoMatePhoto(
  photoUrl: string,
  idToken: string,
  fetchImpl: typeof fetch,
  photoProcessor: (file: File) => Promise<Blob>,
  signal?: AbortSignal
): Promise<Uint8Array | null> {
  throwIfAborted(signal);
  let url: URL;
  try {
    url = new URL(photoUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;

  const baseInit: RequestInit = {
    method: 'GET',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
    signal,
  };

  let response: Response | null = null;
  try {
    response = await fetchImpl(url.toString(), baseInit);
  } catch {
    throwIfAborted(signal);
    // Keep the initial null response and allow the guarded Google Storage
    // authentication retry below when applicable.
  }

  if (
    (!response || response.status === 401 || response.status === 403) &&
    googleStorageHost(url.hostname)
  ) {
    try {
      response = await fetchImpl(url.toString(), {
        ...baseInit,
        headers: { authorization: `Bearer ${idToken}` },
      });
    } catch {
      throwIfAborted(signal);
      response = null;
    }
  }

  if (!response?.ok) return null;

  const declaredLength = Number(response.headers.get('content-length') || '0');
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_TODOMATE_PHOTO_BYTES
  ) {
    return null;
  }

  throwIfAborted(signal);
  const blob = await response.blob();
  throwIfAborted(signal);
  if (blob.size === 0 || blob.size > MAX_TODOMATE_PHOTO_BYTES) return null;
  if (blob.type && !blob.type.startsWith('image/')) return null;

  const type = inferredImageType(url, blob.type);
  try {
    const processed = await photoProcessor(
      new File([blob], `todomate-photo-${Date.now()}`, { type })
    );
    throwIfAborted(signal);
    if (processed.size === 0 || processed.size > MAX_TODOMATE_PHOTO_BYTES) {
      return null;
    }
    return new Uint8Array(await processed.arrayBuffer());
  } catch {
    throwIfAborted(signal);
    return null;
  }
}

async function downloadTodoMatePhotos(
  todos: FirestoreRecord[],
  idToken: string,
  fetchImpl: typeof fetch,
  photoProcessor: (file: File) => Promise<Blob>,
  onPhotoProgress?: (completed: number, total: number) => void,
  signal?: AbortSignal
): Promise<{
  found: number;
  prepared: Map<string, PreparedTodoMatePhoto>;
}> {
  const candidates = todos
    .filter((todo) => Boolean(maybeString(todo.fields.content)))
    .map((todo) => ({
      todoId: todo.id,
      url: maybeString(todo.fields.photoURL),
    }))
    .filter((candidate) => Boolean(candidate.url));

  const prepared = new Map<string, PreparedTodoMatePhoto>();
  let cursor = 0;
  let completed = 0;

  const worker = async () => {
    while (true) {
      throwIfAborted(signal);
      const index = cursor;
      cursor += 1;
      if (index >= candidates.length) return;
      const candidate = candidates[index];
      const photo = await fetchTodoMatePhoto(
        candidate.url,
        idToken,
        fetchImpl,
        photoProcessor,
        signal
      );
      completed += 1;
      onPhotoProgress?.(completed, candidates.length);
      if (!photo) continue;
      prepared.set(candidate.todoId, {
        sourceId: photoSourceId(candidate.todoId, candidate.url),
        bytes: photo,
      });
    }
  };

  const workerCount = Math.min(TODOMATE_PHOTO_CONCURRENCY, candidates.length);
  await Promise.all(
    Array.from({ length: workerCount }, () => worker())
  );

  return { found: candidates.length, prepared };
}

async function zipAsync(
  files: Record<string, Uint8Array>
): Promise<Uint8Array> {
  const { zip } = await import('fflate');
  return new Promise((resolve, reject) => {
    // WebP payloads are already compressed; storing them avoids spending
    // preview CPU re-deflating bytes that will not meaningfully shrink.
    zip(files, { level: 0 }, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}

export interface TodoMateTransferPreview {
  categories: number;
  tasks: number;
  diary: number;
  unscheduledMovedToToday: number;
  photosFound: number;
  photosReady: number;
  photosUnavailable: number;
  routinesReferenced: number;
}

export interface PreparedTodoMateTransfer {
  file: File;
  preview: TodoMateTransferPreview;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) {
    throw new Error(`TodoMate returned invalid ${label} data.`);
  }
  return value;
}

function maybeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function maybeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function firestoreDateKey(value: unknown): string | null {
  const millis = maybeNumber(value);
  if (millis === null) return null;
  const date = new Date(millis);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function millisToIso(value: unknown): string {
  const millis = maybeNumber(value);
  if (millis === null) return '';
  const date = new Date(millis);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function documentTime(record: FirestoreRecord, fallback: string): string {
  const candidate = record.updateTime || record.createTime;
  return candidate && Number.isFinite(Date.parse(candidate))
    ? candidate
    : fallback;
}

function todoMateVisibility(fields: JsonRecord): 'public' | 'followers' | 'private' {
  if (fields.isPublic === true) return 'public';
  if (fields.isViewerIDsFollowers === true) return 'followers';
  return 'private';
}

function todoMateColor(value: unknown): string {
  const numeric = maybeNumber(value);
  if (numeric === null) return '#3B82F6';
  const rgb = Math.trunc(numeric) >>> 0;
  return `#${(rgb & 0xffffff).toString(16).padStart(6, '0').toUpperCase()}`;
}

function decodeFirestoreValue(value: unknown): unknown {
  if (!isRecord(value)) throw new Error('TodoMate returned invalid Firestore data.');

  if ('nullValue' in value) return null;
  if (typeof value.stringValue === 'string') return value.stringValue;
  if (typeof value.booleanValue === 'boolean') return value.booleanValue;
  if (typeof value.integerValue === 'string') {
    const parsed = Number(value.integerValue);
    if (!Number.isSafeInteger(parsed)) {
      throw new Error('TodoMate returned an unsupported integer value.');
    }
    return parsed;
  }
  if (
    typeof value.doubleValue === 'number' &&
    Number.isFinite(value.doubleValue)
  ) {
    return value.doubleValue;
  }
  if (typeof value.timestampValue === 'string') return value.timestampValue;

  if (isRecord(value.arrayValue)) {
    const values = Array.isArray(value.arrayValue.values)
      ? value.arrayValue.values
      : [];
    return values.map(decodeFirestoreValue);
  }

  if (isRecord(value.mapValue)) {
    const fields = isRecord(value.mapValue.fields)
      ? value.mapValue.fields
      : {};
    return decodeFirestoreFields(fields);
  }

  throw new Error('TodoMate returned an unsupported Firestore value.');
}

function decodeFirestoreFields(value: JsonRecord): JsonRecord {
  const decoded: JsonRecord = {};
  for (const [key, raw] of Object.entries(value)) {
    decoded[key] = decodeFirestoreValue(raw);
  }
  return decoded;
}

function parseRunQuery(value: unknown): FirestoreRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('TodoMate returned an invalid history response.');
  }

  const records: FirestoreRecord[] = [];
  for (const row of value) {
    if (!isRecord(row) || !isRecord(row.document)) continue;
    const document = row.document;
    const name = maybeString(document.name);
    const fields = isRecord(document.fields)
      ? decodeFirestoreFields(document.fields)
      : {};
    const fallbackId = name ? decodeURIComponent(name.split('/').at(-1) || '') : '';
    const id = maybeString(fields.id) || fallbackId;
    if (!id) continue;
    records.push({
      id,
      fields,
      createTime: maybeString(document.createTime),
      updateTime: maybeString(document.updateTime),
    });
  }
  return records;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error('TodoMate returned an unreadable response.');
  }
}

async function loadFirebaseConfig(
  fetchImpl: typeof fetch,
  signal?: AbortSignal
): Promise<{
  apiKey: string;
  projectId: string;
}> {
  try {
    const response = await fetchImpl(TODOMATE_FIREBASE_INIT_URL, {
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal,
    });

    if (response.ok) {
      const payload = await readJson(response);
      if (
        isRecord(payload) &&
        typeof payload.apiKey === 'string' &&
        payload.apiKey &&
        typeof payload.projectId === 'string' &&
        payload.projectId
      ) {
        return {
          apiKey: payload.apiKey,
          projectId: payload.projectId,
        };
      }
    }
  } catch {
    throwIfAborted(signal);
    // TodoMate's public Firebase init endpoint is not guaranteed to allow
    // cross-origin browser reads. Fall through to the public web config
    // shipped by TodoMate itself rather than failing before authentication.
  }

  return TODOMATE_FIREBASE_FALLBACK;
}

async function signInTodoMate(
  credentials: TodoMateCredentials,
  apiKey: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal
): Promise<{ idToken: string; uid: string }> {
  let response: Response;
  try {
    response = await fetchImpl(
      `${IDENTITY_TOOLKIT_URL}?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
          returnSecureToken: true,
        }),
        signal,
      }
    );
  } catch {
    throwIfAborted(signal);
    throw new Error('Could not reach TodoMate login. Check your connection and try again.');
  }

  if (!response.ok) {
    throw new Error('TodoMate login failed. Check your email and password.');
  }

  const payload = await readJson(response);
  if (!isRecord(payload)) {
    throw new Error('TodoMate login returned an invalid response.');
  }

  return {
    idToken: requireString(payload.idToken, 'login token'),
    uid: requireString(payload.localId, 'account'),
  };
}

async function queryOwnedCollection(
  collectionId: 'Goal' | 'TodoItem' | 'Diary',
  ownerField: 'userID' | 'writerID',
  uid: string,
  idToken: string,
  projectId: string,
  fetchImpl: typeof fetch,
  signal?: AbortSignal
): Promise<FirestoreRecord[]> {
  const url =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}` +
    '/databases/(default)/documents:runQuery';

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: {
        authorization: `Bearer ${idToken}`,
        'content-type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            fieldFilter: {
              field: { fieldPath: ownerField },
              op: 'EQUAL',
              value: { stringValue: uid },
            },
          },
        },
      }),
    });
  } catch {
    throwIfAborted(signal);
    throw new Error('Could not read TodoMate data. Check your connection and try again.');
  }

  if (!response.ok) {
    throw new Error(
      'TodoMate did not allow Mosaic to read this history. TodoMate may have changed its web data format.'
    );
  }

  return parseRunQuery(await readJson(response));
}

async function makeMosaicBackup(
  email: string,
  uid: string,
  goals: FirestoreRecord[],
  todos: FirestoreRecord[],
  diaries: FirestoreRecord[],
  now: Date,
  photoResult: {
    found: number;
    prepared: Map<string, PreparedTodoMatePhoto>;
  }
): Promise<PreparedTodoMateTransfer> {
  const exportedAt = now.toISOString();
  const today = localDateKey(now);

  const orderedGoals = [...goals].sort((a, b) => {
    const aPriority = maybeNumber(a.fields.priority) ?? Number.MAX_SAFE_INTEGER;
    const bPriority = maybeNumber(b.fields.priority) ?? Number.MAX_SAFE_INTEGER;
    return aPriority - bPriority;
  });

  const categories = orderedGoals.map((goal, index) => ({
    id: goal.id,
    name: maybeString(goal.fields.title) || 'Untitled TodoMate group',
    color: todoMateColor(goal.fields.color),
    order: index,
    visibility: todoMateVisibility(goal.fields),
    userId: uid,
    isDeleted: false,
    icon: '',
    updatedAt: documentTime(goal, exportedAt),
  }));

  let unscheduledMovedToToday = 0;
  const routineIds = new Set<string>();

  const tasks = todos
    .filter((todo) => Boolean(maybeString(todo.fields.content)))
    .map((todo) => {
      let date = firestoreDateKey(todo.fields.date);
      if (!date) {
        unscheduledMovedToToday += 1;
        date = today;
      }

      const preparedPhoto = photoResult.prepared.get(todo.id);
      const routineId = maybeString(todo.fields.routineID);
      if (routineId) routineIds.add(routineId);

      return {
        id: todo.id,
        title: maybeString(todo.fields.content),
        completed: todo.fields.isDone === true,
        categoryId: maybeString(todo.fields.goalID),
        tags: '',
        date,
        memo: maybeString(todo.fields.memo),
        image: preparedPhoto?.sourceId || '',
        createdAt:
          millisToIso(todo.fields.createTime) ||
          (todo.createTime && Number.isFinite(Date.parse(todo.createTime))
            ? todo.createTime
            : exportedAt),
        completedAt: millisToIso(todo.fields.doneTime),
        updatedAt: documentTime(todo, exportedAt),
        source: 'todomate',
        userId: uid,
        isDeleted: false,
        routineId,
        reminderTime: millisToIso(todo.fields.remindAt),
        reactions: '',
        visibility: '',
      };
    });

  const diary = diaries
    .map((entry) => {
      const date = firestoreDateKey(entry.fields.date);
      if (!date) return null;
      const body = maybeString(entry.fields.body);
      const emoji = maybeString(entry.fields.emoji);
      const content = [emoji, body].filter(Boolean).join(' ').trim();
      return {
        id: entry.id,
        date,
        content,
        visibility: todoMateVisibility(entry.fields),
        userId: uid,
        createdAt:
          millisToIso(entry.fields.createTime) ||
          (entry.createTime && Number.isFinite(Date.parse(entry.createTime))
            ? entry.createTime
            : exportedAt),
        updatedAt: documentTime(entry, exportedAt),
        isDeleted: false,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const preview: TodoMateTransferPreview = {
    categories: categories.length,
    tasks: tasks.length,
    diary: diary.length,
    unscheduledMovedToToday,
    photosFound: photoResult.found,
    photosReady: photoResult.prepared.size,
    photosUnavailable: photoResult.found - photoResult.prepared.size,
    routinesReferenced: routineIds.size,
  };

  const payload = {
    format: 'mosaic-user-backup',
    app: { name: 'Mosaic', version: APP_VERSION },
    version: 2,
    exportedAt,
    user: {
      id: `todomate_${uid}`,
      email,
      name: 'TodoMate import',
    },
    counts: {
      tasks: tasks.length,
      categories: categories.length,
      diary: diary.length,
      settings: 0,
      friendships: 0,
    },
    data: {
      tasks,
      categories,
      diary,
      settings: [],
      friendships: [],
    },
    images: {
      included: photoResult.prepared.size > 0,
      referenced: Array.from(photoResult.prepared.values(), (photo) => photo.sourceId),
      missingImages: [],
      note:
        photoResult.prepared.size > 0
          ? 'TodoMate photo attachments are bundled for Mosaic Storage migration.'
          : 'No TodoMate photo attachments were bundled.',
    },
  };

  if (photoResult.prepared.size === 0) {
    return {
      file: new File(
        [JSON.stringify(payload)],
        `todomate-to-mosaic-${today}.json`,
        { type: 'application/json' }
      ),
      preview,
    };
  }

  const encoder = new TextEncoder();
  const files: Record<string, Uint8Array> = {
    'manifest.json': encoder.encode(JSON.stringify(payload)),
  };
  for (const photo of photoResult.prepared.values()) {
    files[`images/${photo.sourceId}.webp`] = photo.bytes;
  }
  const zipped = await zipAsync(files);
  return {
    file: new File(
      [zipped.buffer as ArrayBuffer],
      `todomate-to-mosaic-${today}.zip`,
      { type: 'application/zip' }
    ),
    preview,
  };
}

export async function prepareTodoMateTransfer(
  credentials: TodoMateCredentials,
  options: TodoMateImportOptions = {}
): Promise<PreparedTodoMateTransfer> {
  const email = credentials.email.trim();
  if (!email || !credentials.password) {
    throw new Error('Enter your TodoMate email and password.');
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const reportDetail = (
    message: string,
    percent: number,
    completed?: number,
    total?: number
  ) => {
    options.onProgressDetail?.({
      message,
      percent: Math.max(0, Math.min(100, Math.round(percent))),
      ...(completed !== undefined ? { completed } : {}),
      ...(total !== undefined ? { total } : {}),
    });
  };
  const signal = options.signal;

  throwIfAborted(signal);
  reportDetail('Connecting to TodoMate…', 5);
  const config = await loadFirebaseConfig(fetchImpl, signal);

  reportDetail('Signing in to TodoMate…', 15);
  const session = await signInTodoMate(
    { email, password: credentials.password },
    config.apiKey,
    fetchImpl,
    signal
  );

  reportDetail('Reading TodoMate history…', 30);
  const [goals, todos, diaries] = await Promise.all([
    queryOwnedCollection(
      'Goal',
      'userID',
      session.uid,
      session.idToken,
      config.projectId,
      fetchImpl,
      signal
    ),
    queryOwnedCollection(
      'TodoItem',
      'writerID',
      session.uid,
      session.idToken,
      config.projectId,
      fetchImpl,
      signal
    ),
    queryOwnedCollection(
      'Diary',
      'writerID',
      session.uid,
      session.idToken,
      config.projectId,
      fetchImpl,
      signal
    ),
  ]);

  const photoProcessor = options.photoProcessor ?? defaultPhotoProcessor;
  reportDetail('TodoMate history loaded', 45);
  const photoResult = await downloadTodoMatePhotos(
    todos,
    session.idToken,
    fetchImpl,
    photoProcessor,
    (completed, total) => {
      const fraction = total > 0 ? completed / total : 1;
      reportDetail(
        'Fetching TodoMate photos (' + completed + '/' + total + ')…',
        45 + fraction * 40,
        completed,
        total
      );
    },
    signal
  );

  throwIfAborted(signal);
  reportDetail('Preparing Mosaic import…', 90);
  const prepared = await makeMosaicBackup(
    email,
    session.uid,
    goals,
    todos,
    diaries,
    now(),
    photoResult
  );
  reportDetail('Preview ready', 100);
  return prepared;
}
