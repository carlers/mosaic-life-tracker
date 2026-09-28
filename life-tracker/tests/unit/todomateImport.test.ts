import { unzipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';
import { prepareTodoMateTransfer } from '../../src/lib/todomateImport';

type FetchCall = {
  url: string;
  init?: RequestInit;
};

const identityPhotoProcessor = async (file: File): Promise<Blob> => file;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function fsValue(value: unknown): Record<string, unknown> {
  if (value === null) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && Number.isInteger(value)) {
    return { integerValue: String(value) };
  }
  if (typeof value === 'number') return { doubleValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(fsValue) } };
  }
  if (typeof value === 'object' && value) {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, item]) => [key, fsValue(item)])
        ),
      },
    };
  }
  throw new Error('unsupported fixture value');
}

function firestoreRow(
  collection: string,
  id: string,
  fields: Record<string, unknown>,
  updateTime = '2026-09-27T10:00:00.000000Z'
) {
  return {
    document: {
      name: `projects/mate-914f3/databases/(default)/documents/${collection}/${id}`,
      createTime: '2026-09-01T00:00:00.000000Z',
      updateTime,
      fields: Object.fromEntries(
        Object.entries({ id, ...fields }).map(([key, value]) => [
          key,
          fsValue(value),
        ])
      ),
    },
  };
}

function createFetch() {
  const calls: FetchCall[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });

    if (url === 'https://www.todomate.net/__/firebase/init.json') {
      return jsonResponse({
        apiKey: 'public-firebase-key',
        projectId: 'mate-914f3',
      });
    }
    if (url.startsWith('https://identitytoolkit.googleapis.com/')) {
      return jsonResponse({
        idToken: 'firebase-id-token',
        localId: 'todo_uid',
      });
    }
    if (url === 'https://example.invalid/private-photo') {
      return new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { 'content-type': 'image/webp' },
      });
    }
    if (url.includes('firestore.googleapis.com')) {
      const body = JSON.parse(String(init?.body ?? '{}'));
      const collection = body.structuredQuery?.from?.[0]?.collectionId;
      if (collection === 'Goal') {
        return jsonResponse([
          firestoreRow('Goal', 'goal_work', {
            userID: 'todo_uid',
            title: 'Work',
            priority: -5,
            color: 0xff3366cc,
            isPublic: false,
            isViewerIDsFollowers: true,
          }),
          firestoreRow('Goal', 'goal_personal', {
            userID: 'todo_uid',
            title: 'Personal',
            priority: 20,
            color: 0xff22aa77,
            isPublic: false,
            isViewerIDsFollowers: false,
          }),
        ]);
      }
      if (collection === 'TodoItem') {
        return jsonResponse([
          firestoreRow(
            'TodoItem',
            'todo_done',
            {
              writerID: 'todo_uid',
              content: 'Finish migration',
              date: Date.UTC(2026, 8, 27),
              createTime: Date.UTC(2026, 8, 20, 5),
              isDone: true,
              doneTime: Date.UTC(2026, 8, 27, 8),
              goalID: 'goal_work',
              memo: 'Keep the memo',
              remindAt: Date.UTC(2026, 8, 27, 7, 30),
              routineID: 'routine_daily',
              photoURL: 'https://example.invalid/private-photo',
            },
            '2026-09-27T09:15:00.000000Z'
          ),
          firestoreRow('TodoItem', 'todo_unscheduled', {
            writerID: 'todo_uid',
            content: 'Inbox item',
            date: null,
            createTime: Date.UTC(2026, 8, 26, 5),
            isDone: false,
            doneTime: null,
            goalID: 'goal_personal',
            memo: null,
            remindAt: null,
            routineID: null,
            photoURL: null,
          }),
        ]);
      }
      if (collection === 'Diary') {
        return jsonResponse([
          firestoreRow('Diary', 'diary_1', {
            writerID: 'todo_uid',
            date: Date.UTC(2026, 8, 25),
            body: 'A good day',
            emoji: '🌱',
            createTime: Date.UTC(2026, 8, 25, 10),
            isPublic: false,
            isViewerIDsFollowers: false,
          }),
        ]);
      }
    }

    throw new Error(`unexpected request: ${url}`);
  });

  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

describe('TodoMate import adapter', () => {
  it('reads full owned history directly from TodoMate Firebase and maps it to Mosaic', async () => {
    const { fetchImpl, calls } = createFetch();

    const prepared = await prepareTodoMateTransfer(
      { email: 'person@example.com', password: 'private-password' },
      {
        fetchImpl,
        now: () => new Date(2026, 8, 28, 4, 0, 0),
        photoProcessor: identityPhotoProcessor,
      }
    );

    expect(prepared.preview).toEqual({
      categories: 2,
      tasks: 2,
      diary: 1,
      unscheduledMovedToToday: 1,
      photosFound: 1,
      photosReady: 1,
      photosUnavailable: 0,
      routinesReferenced: 1,
    });

    expect(prepared.file.type).toBe('application/zip');
    const archive = unzipSync(
      new Uint8Array(await prepared.file.arrayBuffer())
    );
    const payload = JSON.parse(new TextDecoder().decode(archive['manifest.json']));
    expect(payload).toMatchObject({
      format: 'mosaic-user-backup',
      version: 2,
      user: {
        id: 'todomate_todo_uid',
        email: 'person@example.com',
      },
    });

    expect(payload.data.categories).toEqual([
      expect.objectContaining({
        id: 'goal_work',
        name: 'Work',
        color: '#3366CC',
        order: 0,
        visibility: 'followers',
      }),
      expect.objectContaining({
        id: 'goal_personal',
        name: 'Personal',
        color: '#22AA77',
        order: 1,
        visibility: 'private',
      }),
    ]);

    expect(payload.data.tasks).toEqual([
      expect.objectContaining({
        id: 'todo_done',
        title: 'Finish migration',
        completed: true,
        categoryId: 'goal_work',
        date: '2026-09-27',
        memo: 'Keep the memo',
        image: expect.stringMatching(/^tmimg_[a-z0-9]+$/),
        source: 'todomate',
        routineId: 'routine_daily',
        reminderTime: '2026-09-27T07:30:00.000Z',
        completedAt: '2026-09-27T08:00:00.000Z',
        updatedAt: '2026-09-27T09:15:00.000000Z',
      }),
      expect.objectContaining({
        id: 'todo_unscheduled',
        title: 'Inbox item',
        date: '2026-09-28',
      }),
    ]);
    expect(payload.data.diary).toEqual([
      expect.objectContaining({
        id: 'diary_1',
        date: '2026-09-25',
        content: '🌱 A good day',
        visibility: 'private',
      }),
    ]);
    const sourceImageId = payload.data.tasks[0].image;
    expect(archive[`images/${sourceImageId}.webp`]).toEqual(
      new Uint8Array([1, 2, 3, 4])
    );
    expect(payload.images).toMatchObject({
      included: true,
      referenced: [sourceImageId],
      missingImages: [],
    });

    const urls = calls.map((call) => call.url);
    expect(urls).toHaveLength(6);
    expect(urls[0]).toBe('https://www.todomate.net/__/firebase/init.json');
    expect(urls[1]).toMatch(/^https:\/\/identitytoolkit\.googleapis\.com\//);
    expect(
      urls.slice(2, 5).every((url) =>
        url.startsWith('https://firestore.googleapis.com/')
      )
    ).toBe(true);
    expect(urls[5]).toBe('https://example.invalid/private-photo');
    expect(calls[5].init?.headers).toBeUndefined();
    expect(
      urls.some((url) => url.includes('todomate-api.3xhaust.dev'))
    ).toBe(false);

    const loginBody = JSON.parse(String(calls[1].init?.body));
    expect(loginBody).toEqual({
      email: 'person@example.com',
      password: 'private-password',
      returnSecureToken: true,
    });

    for (const call of calls.slice(2, 5)) {
      const body = JSON.parse(String(call.init?.body));
      const where = body.structuredQuery.where;
      expect(where.fieldFilter.field.fieldPath).toMatch(/^(userID|writerID)$/);
      expect(where.fieldFilter.value).toEqual({ stringValue: 'todo_uid' });
      expect(JSON.stringify(where)).not.toContain('"date"');
      expect(call.init?.headers).toMatchObject({
        authorization: 'Bearer firebase-id-token',
      });
    }
  });

  it('uses the Firebase token only when a Google Storage photo requires authentication', async () => {
    const photoUrl =
      'https://firebasestorage.googleapis.com/v0/b/mate-914f3/o/private%2Fphoto.jpg?alt=media';
    const photoCalls: FetchCall[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      photoCalls.push({ url, init });

      if (url === 'https://www.todomate.net/__/firebase/init.json') {
        return jsonResponse({
          apiKey: 'public-firebase-key',
          projectId: 'mate-914f3',
        });
      }
      if (url.startsWith('https://identitytoolkit.googleapis.com/')) {
        return jsonResponse({
          idToken: 'firebase-id-token',
          localId: 'todo_uid',
        });
      }
      if (url.includes('firestore.googleapis.com')) {
        const body = JSON.parse(String(init?.body ?? '{}'));
        const collection = body.structuredQuery?.from?.[0]?.collectionId;
        if (collection === 'TodoItem') {
          return jsonResponse([
            firestoreRow('TodoItem', 'todo_photo', {
              writerID: 'todo_uid',
              content: 'Private photo',
              date: Date.UTC(2026, 8, 27),
              createTime: Date.UTC(2026, 8, 20),
              isDone: false,
              doneTime: null,
              goalID: '',
              memo: null,
              remindAt: null,
              routineID: null,
              photoURL: photoUrl,
            }),
          ]);
        }
        return jsonResponse([]);
      }
      if (url === photoUrl) {
        const headers = init?.headers as Record<string, string> | undefined;
        if (headers?.authorization === 'Bearer firebase-id-token') {
          return new Response(new Uint8Array([9, 8, 7]), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
          });
        }
        return new Response('', { status: 403 });
      }

      throw new Error(`unexpected request: ${url}`);
    }) as unknown as typeof fetch;

    const prepared = await prepareTodoMateTransfer(
      { email: 'person@example.com', password: 'private-password' },
      {
        fetchImpl,
        now: () => new Date(2026, 8, 28, 4, 0, 0),
        photoProcessor: identityPhotoProcessor,
      }
    );

    expect(prepared.preview.photosFound).toBe(1);
    expect(prepared.preview.photosReady).toBe(1);
    expect(prepared.preview.photosUnavailable).toBe(0);
    const imageRequests = photoCalls.filter((call) => call.url === photoUrl);
    expect(imageRequests).toHaveLength(2);
    expect(imageRequests[0].init?.headers).toBeUndefined();
    expect(imageRequests[1].init?.headers).toEqual({
      authorization: 'Bearer firebase-id-token',
    });
  });

  it('falls back to TodoMate public Firebase config when browser config discovery is CORS-blocked', async () => {
    const calls: FetchCall[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });

      if (url === 'https://www.todomate.net/__/firebase/init.json') {
        throw new TypeError('Failed to fetch');
      }
      if (url.startsWith('https://identitytoolkit.googleapis.com/')) {
        return jsonResponse({
          idToken: 'firebase-id-token',
          localId: 'todo_uid',
        });
      }
      if (url.includes('firestore.googleapis.com')) {
        return jsonResponse([]);
      }

      throw new Error(`unexpected request: ${url}`);
    }) as unknown as typeof fetch;

    const prepared = await prepareTodoMateTransfer(
      { email: 'person@example.com', password: 'private-password' },
      {
        fetchImpl,
        now: () => new Date(2026, 8, 28, 4, 0, 0),
      }
    );

    expect(prepared.preview).toEqual({
      categories: 0,
      tasks: 0,
      diary: 0,
      unscheduledMovedToToday: 0,
      photosFound: 0,
      photosReady: 0,
      photosUnavailable: 0,
      routinesReferenced: 0,
    });
    expect(calls).toHaveLength(5);
    expect(calls[1].url).toContain(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='
    );
    expect(
      calls.slice(2).every((call) =>
        call.url.includes('/projects/mate-914f3/databases/(default)/documents:runQuery')
      )
    ).toBe(true);
  });

  it('stops after a rejected TodoMate login and never queries Firestore', async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/__/firebase/init.json')) {
        return jsonResponse({
          apiKey: 'public-key',
          projectId: 'mate-914f3',
        });
      }
      return jsonResponse({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }, 400);
    }) as unknown as typeof fetch;

    await expect(
      prepareTodoMateTransfer(
        { email: 'person@example.com', password: 'wrong' },
        { fetchImpl }
      )
    ).rejects.toThrow('TodoMate login failed');

    expect(calls).toHaveLength(2);
    expect(calls.some((url) => url.includes('firestore.googleapis.com'))).toBe(
      false
    );
  });

  it('rejects missing credentials before any network request', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    await expect(
      prepareTodoMateTransfer(
        { email: 'person@example.com', password: '' },
        { fetchImpl }
      )
    ).rejects.toThrow(/email and password/i);

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
