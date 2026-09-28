import { APP_VERSION } from './appVersion';

const TODOMATE_FIREBASE_INIT_URL =
  'https://www.todomate.net/__/firebase/init.json';
const IDENTITY_TOOLKIT_URL =
  'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';

type JsonRecord = Record<string, unknown>;

interface TodoMateCredentials {
  email: string;
  password: string;
}

interface TodoMateImportOptions {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  onProgress?: (message: string) => void;
}

interface FirestoreRecord {
  id: string;
  fields: JsonRecord;
  createTime: string;
  updateTime: string;
}

export interface TodoMateTransferPreview {
  categories: number;
  tasks: number;
  diary: number;
  unscheduledMovedToToday: number;
  photosSkipped: number;
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

async function loadFirebaseConfig(fetchImpl: typeof fetch): Promise<{
  apiKey: string;
  projectId: string;
}> {
  let response: Response;
  try {
    response = await fetchImpl(TODOMATE_FIREBASE_INIT_URL, {
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new Error(
      'Mosaic could not load TodoMate’s public connection settings. Try again from an online browser.'
    );
  }

  if (!response.ok) {
    throw new Error(
      'Mosaic could not load TodoMate’s public connection settings. Try again later.'
    );
  }

  const payload = await readJson(response);
  if (!isRecord(payload)) {
    throw new Error('TodoMate’s public connection settings are invalid.');
  }

  return {
    apiKey: requireString(payload.apiKey, 'Firebase key'),
    projectId: requireString(payload.projectId, 'Firebase project'),
  };
}

async function signInTodoMate(
  credentials: TodoMateCredentials,
  apiKey: string,
  fetchImpl: typeof fetch
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
      }
    );
  } catch {
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
  fetchImpl: typeof fetch
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
    throw new Error('Could not read TodoMate data. Check your connection and try again.');
  }

  if (!response.ok) {
    throw new Error(
      'TodoMate did not allow Mosaic to read this history. TodoMate may have changed its web data format.'
    );
  }

  return parseRunQuery(await readJson(response));
}

function makeMosaicBackup(
  email: string,
  uid: string,
  goals: FirestoreRecord[],
  todos: FirestoreRecord[],
  diaries: FirestoreRecord[],
  now: Date
): { file: File; preview: TodoMateTransferPreview } {
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
  let photosSkipped = 0;
  const routineIds = new Set<string>();

  const tasks = todos
    .filter((todo) => Boolean(maybeString(todo.fields.content)))
    .map((todo) => {
      let date = firestoreDateKey(todo.fields.date);
      if (!date) {
        unscheduledMovedToToday += 1;
        date = today;
      }

      if (maybeString(todo.fields.photoURL)) photosSkipped += 1;
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
        image: '',
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
    photosSkipped,
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
      included: false,
      referenced: [],
      missingImages: [],
      note:
        photosSkipped > 0
          ? 'TodoMate photo attachments are not included in this migration.'
          : 'No TodoMate photo attachments were included.',
    },
  };

  return {
    file: new File(
      [JSON.stringify(payload)],
      `todomate-to-mosaic-${today}.json`,
      { type: 'application/json' }
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
  const report = options.onProgress ?? (() => {});

  report('Connecting to TodoMate…');
  const config = await loadFirebaseConfig(fetchImpl);

  report('Signing in to TodoMate…');
  const session = await signInTodoMate(
    { email, password: credentials.password },
    config.apiKey,
    fetchImpl
  );

  report('Reading TodoMate history…');
  const [goals, todos, diaries] = await Promise.all([
    queryOwnedCollection(
      'Goal',
      'userID',
      session.uid,
      session.idToken,
      config.projectId,
      fetchImpl
    ),
    queryOwnedCollection(
      'TodoItem',
      'writerID',
      session.uid,
      session.idToken,
      config.projectId,
      fetchImpl
    ),
    queryOwnedCollection(
      'Diary',
      'writerID',
      session.uid,
      session.idToken,
      config.projectId,
      fetchImpl
    ),
  ]);

  report('Preparing Mosaic import…');
  return makeMosaicBackup(email, session.uid, goals, todos, diaries, now());
}
