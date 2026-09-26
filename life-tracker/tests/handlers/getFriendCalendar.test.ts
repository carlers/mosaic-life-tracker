import { describe, it, expect, beforeEach } from 'vitest';
import { invoke, makeMockDb, type MockDb } from '../helpers/invoke-handler';

const CALLER = 'user_a';
const FRIEND = 'user_b';

const friendshipRow = () => ({ $id: 'fr_test' });

describe('message-action / get_friend_calendar', () => {
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = makeMockDb();
  });

  it('returns 400 when friendUserId is missing', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'get_friend_calendar' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid friendUserId');
  });

  it('returns 400 when friendUserId equals callerId', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'get_friend_calendar', friendUserId: CALLER },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cannot query your own calendar');
  });

  // Regression: §20.3 (friend-calendar reads require accepted friendship).
  it('returns 403 when the caller is not friends with the target', async () => {
    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'get_friend_calendar', friendUserId: FRIEND },
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Not friends with this user');
  });

  // Regression: §20.3 (private tasks are excluded from friend calendars).
  it('filters out private tasks', async () => {
    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({
        rows: [
          {
            $id: 'cat_1',
            user_id: FRIEND,
            visibility: 'public',
            order: 0,
            deleted: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            $id: 't1',
            user_id: FRIEND,
            category_id: 'cat_1',
            visibility: 'public',
            date: '2026-01-01',
            deleted: false,
          },
          {
            $id: 't2',
            user_id: FRIEND,
            category_id: 'cat_1',
            visibility: 'private',
            date: '2026-01-02',
            deleted: false,
          },
        ],
      });

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'get_friend_calendar', friendUserId: FRIEND },
    });

    expect(res.status).toBe(200);
    expect(res.body.tasks.map((t: { $id: string }) => t.$id)).toEqual(['t1']);
  });

  // Regression: §20.3 (private categories are excluded from friend calendars).
  it('filters out private categories', async () => {
    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({
        rows: [
          {
            $id: 'cat_1',
            user_id: FRIEND,
            visibility: 'public',
            order: 0,
            deleted: false,
          },
          {
            $id: 'cat_2',
            user_id: FRIEND,
            visibility: 'private',
            order: 1,
            deleted: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            $id: 't1',
            user_id: FRIEND,
            category_id: 'cat_1',
            visibility: 'public',
            date: '2026-01-01',
            deleted: false,
          },
        ],
      });

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'get_friend_calendar', friendUserId: FRIEND },
    });

    expect(res.status).toBe(200);
    expect(res.body.categories.map((c: { $id: string }) => c.$id)).toEqual([
      'cat_1',
    ]);
  });

  // Regression: §20.3 (task visibility overrides category visibility when sharing).
  // included. The category's OWN visibility still governs whether the
  // category itself is returned: private categories are excluded even when
  // they host a visible task, and non-private categories are included.
  it('includes a public-override task on a private category; excludes the private category', async () => {
    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({
        rows: [
          {
            $id: 'cat_priv',
            user_id: FRIEND,
            visibility: 'private',
            order: 0,
            deleted: false,
          },
          {
            $id: 'cat_pub',
            user_id: FRIEND,
            visibility: 'public',
            order: 1,
            deleted: false,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            $id: 't1',
            user_id: FRIEND,
            category_id: 'cat_priv',
            visibility: 'public',
            date: '2026-01-01',
            deleted: false,
          },
          {
            $id: 't2',
            user_id: FRIEND,
            category_id: 'cat_pub',
            visibility: '',
            date: '2026-01-02',
            deleted: false,
          },
        ],
      });

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'get_friend_calendar', friendUserId: FRIEND },
    });

    expect(res.status).toBe(200);

    const taskIds = res.body.tasks.map((t: { $id: string }) => t.$id);
    expect(taskIds).toContain('t1');
    expect(taskIds).toContain('t2');

    const categoryIds = res.body.categories.map((c: { $id: string }) => c.$id);
    expect(categoryIds).toContain('cat_pub');
    expect(categoryIds).not.toContain('cat_priv');
  });

  // Regression: §20.3 (friend-calendar reads paginate through all visible tasks).
  it('pagination: >100 tasks triggers a second listRows with cursorAfter', async () => {
    const hundredTasks = Array.from({ length: 100 }, (_, i) => ({
      $id: `t${String(i).padStart(3, '0')}`,
      user_id: FRIEND,
      category_id: '',
      visibility: 'public',
      date: '2026-01-01',
      deleted: false,
    }));

    mockDb.listRows
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      .mockResolvedValueOnce({ rows: [friendshipRow()] })
      // Categories: empty, single page.
      .mockResolvedValueOnce({ rows: [] })
      // Tasks: page 1 (100 rows), page 2 (empty).
      .mockResolvedValueOnce({ rows: hundredTasks })
      .mockResolvedValueOnce({ rows: [] });

    const res = await invoke({
      userId: CALLER,
      mockDb,
      body: { action: 'get_friend_calendar', friendUserId: FRIEND },
    });

    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(100);

    // listRows call index 4 is the tasks second page.
    const secondPageQueries = mockDb.listRows.mock.calls[4][0].queries;
    expect(
      secondPageQueries.some((q: { op?: string }) => q?.op === 'cursorAfter')
    ).toBe(true);
  });
});
