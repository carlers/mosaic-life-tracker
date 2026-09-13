const { Client, TablesDB, Query } = require('node-appwrite');

const DATABASE_ID = 'life_tracker';

module.exports = async ({ req, res, log, error }) => {
    const callerId = req.headers['x-appwrite-user-id'];
    if (!callerId) {
        error('Unauthorized: no x-appwrite-user-id header');
        return res.json({ error: 'Unauthorized' }, 401);
    }

    let friendUserId;
    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        friendUserId = body?.friendUserId;
        if (!friendUserId || typeof friendUserId !== 'string') {
            throw new Error('friendUserId is required');
        }
    } catch (e) {
        error(`Bad Request: ${e.message}`);
        return res.json({ error: 'Bad Request: friendUserId is required' }, 400);
    }

    if (callerId === friendUserId) {
        error('Bad Request: caller requested their own calendar');
        return res.json({ error: 'Bad Request: cannot query your own calendar' }, 400);
    }

    const client = new Client()
        .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
        .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
        .setKey(req.headers['x-appwrite-key']);

    const tablesDB = new TablesDB(client);

    try {
        // 1. Authorize: accepted friendship must exist
        const friendshipCheck = await tablesDB.listRows({
            databaseId: DATABASE_ID,
            tableId: 'friendships',
            queries: [
                Query.equal('user_id', callerId),
                Query.equal('friend_id', friendUserId),
                Query.equal('status', 'accepted'),
                Query.equal('deleted', false),
                Query.limit(1),
            ],
        });

        if (friendshipCheck.rows.length === 0) {
            error(`Forbidden: no accepted friendship ${callerId} -> ${friendUserId}`);
            return res.json({ error: 'Forbidden: not friends with this user' }, 403);
        }

        // 2. Fetch ALL categories (unfiltered) — we need their visibility
        //    to resolve inheritance on tasks, and to build the visible list.
        const categoriesRes = await tablesDB.listRows({
            databaseId: DATABASE_ID,
            tableId: 'categories',
            queries: [
                Query.equal('user_id', friendUserId),
                Query.equal('deleted', false),
                Query.orderAsc('order'),
                Query.limit(200),
            ],
        });

        const categoryVisibility = new Map();
        for (const c of categoriesRes.rows) {
            categoryVisibility.set(c.$id, c.visibility || 'private');
        }

        // 3. Fetch ALL tasks (unfiltered) — resolve visibility in memory.
        const tasksRes = await tablesDB.listRows({
            databaseId: DATABASE_ID,
            tableId: 'tasks',
            queries: [
                Query.equal('user_id', friendUserId),
                Query.equal('deleted', false),
                Query.orderAsc('date'),
                Query.limit(1000),
            ],
        });

        const visibleTasks = tasksRes.rows.filter((t) => {
            const taskVis = t.visibility;
            const effective =
                taskVis && taskVis !== ''
                    ? taskVis
                    : categoryVisibility.get(t.category_id) || 'private';
            return effective !== 'private';
        });

        // 4. Return only the visible categories (private ones stay hidden)
        const visibleCategories = categoriesRes.rows.filter(
            (c) => (c.visibility || 'private') !== 'private'
        );

        log(
            `OK: ${callerId} fetched ${visibleTasks.length}/${tasksRes.rows.length} tasks, ` +
                `${visibleCategories.length}/${categoriesRes.rows.length} categories for ${friendUserId}`
        );

        return res.json({
            tasks: visibleTasks,
            categories: visibleCategories,
            fetchedAt: new Date().toISOString(),
        });
    } catch (err) {
        error(`Internal error: ${err.message}`);
        if (err.cause) {
            error(`Cause: ${err.cause.code || err.cause.message || err.cause}`);
        }
        return res.json({ error: 'An internal error occurred' }, 500);
    }
};