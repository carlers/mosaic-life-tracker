import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startCoreRealtimeWake } from '../../src/lib/supabaseRealtimeWake';

const owner = '11111111-1111-4111-8111-111111111111';
const foreign = '22222222-2222-4222-8222-222222222222';
type Frame = { topic: string; event: string; ref: string; payload: Record<string, unknown> };
class FakeSocket {
  static sockets: FakeSocket[] = [];
  readyState = 0;
  frames: Frame[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) { FakeSocket.sockets.push(this); }
  open() { this.readyState = 1; this.onopen?.(); }
  send(text: string) { this.frames.push(JSON.parse(text)); }
  close() { this.closed = true; this.readyState = 3; }
  receive(frame: object) { this.onmessage?.({ data: JSON.stringify(frame) }); }
  acceptJoin() {
    const join = this.frames.find(frame => frame.event === 'phx_join')!;
    const configured = (join.payload.config as { postgres_changes: Array<{ event: string; table: string }> }).postgres_changes;
    this.receive({
      topic: join.topic, event: 'phx_reply', ref: join.ref,
      payload: { status: 'ok', response: { postgres_changes: configured.map((entry, i) => ({
        id: i + 7, event: entry.event, table: entry.table, schema: 'public',
      })) } },
    });
  }
  change(id: number, type: string, ownerId: string) {
    this.receive({ topic: 'realtime:mosaic-core-sync', event: 'postgres_changes',
      payload: { ids: [id], data: { schema: 'public',
        table: 'mosaic_candidate_tasks', type, record: { owner_id: ownerId, title: 'ignored' } } } });
  }
}
const publishableKey = 'sb_publishable_test_test_test';
function harness() {
  const signed = { userId: owner, accessToken: 'signed-owner-token', sessionEpoch: 3 };
  const diagnostics = { active: 0, online: 0, visible: 0, factory: 0 };
  const session = { getVerifiedSession: vi.fn(async () => ({ ...signed })) };
  const onWake = vi.fn(async () => {});
  let active = true;
  const stop = startCoreRealtimeWake({
    baseUrl: 'https://hcxtiifzxoaflhjgoglb.supabase.co',
    publishableKey, session, onWake, isActive: () => { diagnostics.active++; return active; },
    socketFactory: url => { diagnostics.factory++; return new FakeSocket(url) as unknown as WebSocket; },
    isOnline: () => { diagnostics.online++; return true; },
    isVisible: () => { diagnostics.visible++; return true; },
  });
  return { session, signed, stop, onWake, diagnostics, deactivate: () => { active = false; } };
}
async function getSocket(h: ReturnType<typeof harness>) {
  await vi.waitFor(() => {
    if (!FakeSocket.sockets.length) throw Error('No socket: ' + JSON.stringify({ ...h.diagnostics,
      sessionCalls: h.session.getVerifiedSession.mock.calls.length }));
  });
  return FakeSocket.sockets.at(-1)!;
}

describe('Supabase signed owner realtime wake (#1187)', () => {
  beforeEach(() => {
    FakeSocket.sockets = [];
    vi.useRealTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('subscribes only to owner-filtered INSERT/UPDATE, then wakes incremental pull without applying payloads', async () => {
    const h = harness();
    const socket = await getSocket(h);
    expect(socket.url).toContain('vsn=1.0.0');
    expect(socket.url).not.toContain('signed-owner-token');
    socket.open();
    const join = socket.frames.find(f => f.event === 'phx_join')!;
    const cfg = join.payload.config as { postgres_changes: Array<{ event: string; table: string; filter: string }> };
    expect(cfg.postgres_changes).toHaveLength(4);
    expect(cfg.postgres_changes.map(x => x.event).sort()).toEqual(['INSERT', 'INSERT', 'UPDATE', 'UPDATE']);
    expect(cfg.postgres_changes.every(x => x.filter === 'owner_id=eq.' + owner)).toBe(true);
    expect(join.payload.access_token).toBe('signed-owner-token');
    socket.acceptJoin();
    await vi.waitFor(() => expect(h.onWake).toHaveBeenCalledTimes(1));
    socket.change(7, 'INSERT', foreign);
    socket.change(7, 'DELETE', owner);
    socket.change(500, 'INSERT', owner);
    await new Promise(resolve => setTimeout(resolve, 270));
    expect(h.onWake).toHaveBeenCalledTimes(1);
    socket.change(7, 'INSERT', owner);
    socket.change(7, 'INSERT', owner);
    await vi.waitFor(() => expect(h.onWake).toHaveBeenCalledTimes(2));
    h.stop();
    expect(socket.closed).toBe(true);
    socket.change(7, 'INSERT', owner);
    expect(h.onWake).toHaveBeenCalledTimes(2);
  });

  it('fences in-flight changes after session replacement or account switch', async () => {
    const h = harness();
    const socket = await getSocket(h);
    socket.open();
    socket.acceptJoin();
    await vi.waitFor(() => expect(h.onWake).toHaveBeenCalledTimes(1));
    h.signed.sessionEpoch++;
    socket.change(7, 'INSERT', owner);
    await vi.waitFor(() => expect(socket.closed).toBe(true));
    expect(h.onWake).toHaveBeenCalledTimes(1);
    h.deactivate();
    h.stop();
  });

  it('rejects a rejected channel and keeps a bounded fallback instead of trusting notifications', async () => {
    const h = harness();
    const socket = await getSocket(h);
    socket.open();
    const join = socket.frames[0];
    socket.receive({ topic: join.topic, event: 'phx_reply', ref: join.ref, payload: { status: 'error' } });
    expect(socket.closed).toBe(true);
    expect(h.onWake).not.toHaveBeenCalled();
    h.stop();
  });
});
