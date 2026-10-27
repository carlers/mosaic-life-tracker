/**
 * #1187: Supabase Realtime is a wake-up hint, never a replication writer.
 *
 * A single, owner-filtered Phoenix channel listens only for INSERT/UPDATE
 * on the two core tables (plus Diary only under an explicit profile). Durable values come from the existing
 * signed RxDB pull/CAS transport. DELETE is intentionally omitted because
 * Supabase Postgres Changes does not filter DELETE with row-level security;
 * Mosaic uses UPDATE tombstones instead.
 *
 * This self-contained protocol v1 client avoids a second Auth/refresh-token
 * SDK and has no permissions beyond the already verified session.
 */
import type { CandidateSessionProvider, CandidateVerifiedSession } from '../../supabase-poc/candidateHttpTransport';

export interface CoreRealtimeWakeOptions {
  baseUrl: string;
  publishableKey: string;
  session: CandidateSessionProvider;
  /** Called only while the matching guarded core writer is active. */
  isActive: () => boolean;
  /** Existing authenticated replication catch-up, not event payload apply. */
  onWake: () => Promise<void>;
  socketFactory?: (url: string) => WebSocket;
  /** Add the owner-private Diary wake only under the reviewed core-diary profile. */
  includeDiary?: boolean;
  includePersonal?: boolean;
  /** Test seams; defaults use browser connection/visibility state. */
  isOnline?: () => boolean;
  isVisible?: () => boolean;
}

type Notice = { event?: unknown; topic?: unknown; ref?: unknown; payload?: unknown };
type Payload = { status?: unknown; response?: { postgres_changes?: unknown }; ids?: unknown;
  data?: { schema?: unknown; table?: unknown; type?: unknown; record?: { owner_id?: unknown } } };
const CORE_TABLES = ['mosaic_candidate_tasks', 'mosaic_candidate_categories'] as const;
const EVENTS = ['INSERT', 'UPDATE'] as const;
const TOPIC = 'realtime:mosaic-core-sync';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function startCoreRealtimeWake(options: CoreRealtimeWakeOptions): () => void {
  const tables: readonly string[] = options.includePersonal
    ? [...CORE_TABLES, 'mosaic_candidate_diary', 'mosaic_candidate_settings', 'mosaic_candidate_buckets', 'mosaic_candidate_bucket_task_links']
    : options.includeDiary ? [...CORE_TABLES, 'mosaic_candidate_diary'] : CORE_TABLES;
  const base = new URL(options.baseUrl);
  if (!((base.protocol === 'https:' && base.hostname === 'hcxtiifzxoaflhjgoglb.supabase.co') ||
      (base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname))) ||
      base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('Realtime wake requires the isolated Supabase core origin');
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(options.publishableKey))
    throw new Error('Realtime wake requires a public publishable key');

  const url = new URL('/realtime/v1/websocket', base);
  url.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('apikey', options.publishableKey);
  url.searchParams.set('vsn', '1.0.0');

  const factory = options.socketFactory ?? (endpoint => new WebSocket(endpoint));
  let stopped = false;
  let current: WebSocket | null = null;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let wakeTimer: ReturnType<typeof setTimeout> | undefined;
  let nextDelayMs = 1000;
  let revision = 0;
  let ref = 0;
  let inFlight = false;
  let joined = false;
  let subscriptionIds = new Map<number, { table: string; event: string }>();
  let lastHeartbeatAck = 0;
  let lastHeartbeatSent = 0;

  const active = () => !stopped && options.isActive();

  function clearConnectionTimers() {
    if (heartbeat !== undefined) clearInterval(heartbeat);
    if (wakeTimer !== undefined) clearTimeout(wakeTimer);
    heartbeat = undefined;
    wakeTimer = undefined;
  }

  function send(socket: WebSocket, event: string, payload: object, topic = TOPIC, joinRef: string | null = '1'): string {
    const messageRef = String(++ref);
    socket.send(JSON.stringify({ topic, event, payload, ref: messageRef, join_ref: joinRef }));
    return messageRef;
  }

  function scheduleReconnect() {
    if (!active() || reconnectTimer !== undefined) return;
    const wait = nextDelayMs;
    nextDelayMs = Math.min(30_000, nextDelayMs * 2);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      void connect();
    }, wait);
  }

  function disconnect(socket: WebSocket, shouldRetry: boolean) {
    if (current !== socket) return;
    current = null;
    joined = false;
    subscriptionIds.clear();
    clearConnectionTimers();
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    try { socket.close(); } catch { /* Browser teardown is best effort. */ }
    if (shouldRetry) scheduleReconnect();
  }

  function queueWake(socket: WebSocket, captured: CandidateVerifiedSession) {
    if (!active() || !joined || current !== socket || wakeTimer !== undefined) return;
    wakeTimer = setTimeout(() => {
      wakeTimer = undefined;
      if (!active() || !joined || current !== socket || inFlight) return;
      inFlight = true;
      void (async () => {
        try {
          const latest = await options.session.getVerifiedSession();
          if (!active() || current !== socket || !latest ||
              latest.userId !== captured.userId ||
              latest.sessionEpoch !== captured.sessionEpoch ||
              latest.accessToken !== captured.accessToken) {
            disconnect(socket, true);
            return;
          }
          await options.onWake();
        } catch { /* Foreground and 60s signed sync remain fallback. */ }
        finally { inFlight = false; }
      })();
    }, 200);
  }

  async function connect() {
    if (!active() || current ||
        !(options.isOnline?.() ?? (typeof navigator === 'undefined' || navigator.onLine !== false)) ||
        !(options.isVisible?.() ?? (typeof document === 'undefined' || document.visibilityState !== 'hidden'))) return;
    const attempt = ++revision;
    let session: CandidateVerifiedSession | null;
    try { session = await options.session.getVerifiedSession(); }
    catch { scheduleReconnect(); return; }
    if (!active() || current || attempt !== revision) return;
    if (!session || !UUID.test(session.userId) || !session.accessToken ||
        !Number.isSafeInteger(session.sessionEpoch)) {
      scheduleReconnect();
      return;
    }
    let socket: WebSocket;
    try { socket = factory(url.toString()); } catch { scheduleReconnect(); return; }
    current = socket;
    let joinRef: string | null = null;
    const configurations = tables.flatMap(table => EVENTS.map(event => ({
      event, schema: 'public', table, filter: 'owner_id=eq.' + session.userId,
    })));

    socket.onopen = () => {
      if (!active() || current !== socket) { disconnect(socket, false); return; }
      joinRef = send(socket, 'phx_join', {
        config: {
          broadcast: { ack: false, self: false },
          presence: { enabled: false },
          postgres_changes: configurations,
          private: false,
        },
        access_token: session.accessToken,
      });
      lastHeartbeatAck = Date.now();
      heartbeat = setInterval(() => {
        if (!active() || current !== socket || socket.readyState !== 1) {
          disconnect(socket, active()); return;
        }
        // Give up on a zombie socket; the existing 60s fallback remains.
        if (lastHeartbeatSent && Date.now() - lastHeartbeatAck > 55_000) {
          disconnect(socket, true); return;
        }
        lastHeartbeatSent = Date.now();
        send(socket, 'heartbeat', {}, 'phoenix', null);
      }, 20_000);
    };

    socket.onmessage = event => {
      if (!active() || current !== socket || typeof event.data !== 'string') return;
      let message: Notice;
      try { message = JSON.parse(event.data) as Notice; }
      catch { return; }
      if (typeof message !== 'object' || !message) return;
      const data = (message.payload ?? {}) as Payload;
      if (message.event === 'phx_reply' && message.topic === 'phoenix') {
        if (data.status === 'ok') lastHeartbeatAck = Date.now();
        return;
      }
      if (message.event === 'phx_reply' && message.topic === TOPIC && message.ref === joinRef) {
        const subs = data.response?.postgres_changes;
        if (data.status !== 'ok' || !Array.isArray(subs) || subs.length !== configurations.length) {
          disconnect(socket, true);
          return;
        }
        const registrations = new Map<number, { table: string; event: string }>();
        for (const item of subs) {
          if (!item || typeof item.id !== 'number' || !tables.includes(item.table) ||
              !EVENTS.includes(item.event) || item.schema !== 'public' ||
              registrations.has(item.id)) {
            disconnect(socket, true); return;
          }
          registrations.set(item.id, { table: item.table, event: item.event });
        }
        if (registrations.size !== configurations.length ||
            configurations.some(expected => ![...registrations.values()].some(entry =>
              entry.table === expected.table && entry.event === expected.event))) {
          disconnect(socket, true); return;
        }
        subscriptionIds = registrations;
        joined = true;
        nextDelayMs = 1000;
        queueWake(socket, session); // Cover writes during initial channel setup.
        return;
      }
      if (message.topic !== TOPIC) return;
      if (message.event === 'phx_error' || message.event === 'phx_close' ||
          message.event === 'system' && data.status === 'error') {
        disconnect(socket, true); return;
      }
      if (message.event !== 'postgres_changes' || !joined || !Array.isArray(data.ids) ||
          !data.data || data.data.schema !== 'public' ||
          !tables.includes(data.data.table as string) ||
          !EVENTS.includes(data.data.type as typeof EVENTS[number]) ||
          data.data.record?.owner_id !== session.userId) return;
      if (!data.ids.some(value => typeof value === 'number' &&
            subscriptionIds.get(value)?.table === data.data?.table &&
            subscriptionIds.get(value)?.event === data.data?.type)) return;
      // Never consume title, memo, visibility or deletion fields from websocket.
      queueWake(socket, session);
    };
    socket.onerror = () => disconnect(socket, true);
    socket.onclose = () => disconnect(socket, true);
  }

  const resume = () => {
    if (active() && !current && reconnectTimer === undefined) void connect();
  };
  const visibility = () => {
    if (document.visibilityState === 'visible') resume();
  };
  if (typeof window !== 'undefined') window.addEventListener('online', resume);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', visibility);
  void connect();

  return () => {
    stopped = true;
    revision++;
    if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
    clearConnectionTimers();
    if (current) disconnect(current, false);
    if (typeof window !== 'undefined') window.removeEventListener('online', resume);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', visibility);
  };
}
