import { createPwaDiagnosticRecorder } from '../../src/lib/pwaUpdateDiagnostics';

function fixture(enabled = true) {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  let elapsed = 0;
  let visible = true;
  const make = () => createPwaDiagnosticRecorder({
    enabled, storage, now: () => elapsed, wallNow: () => 1_795_000_000_000 + elapsed,
    visible: () => visible, online: () => true,
  });
  return {
    make, storage, values,
    advance: (ms: number) => { elapsed += ms; },
    hide: () => { visible = false; },
    show: () => { visible = true; },
  };
}

describe('Preview-only local update timing', () => {
  it('records comparable background/manual stage timings and visibility transitions', () => {
    const f = fixture();
    const recorder = f.make();
    const background = recorder.start('background');
    f.advance(300);
    recorder.mark(background, 'checking');
    f.advance(400);
    recorder.mark(background, 'update-found');
    f.hide();
    recorder.visibilityChanged();
    f.advance(1_000);
    recorder.progress({ completed: 2, total: 5, completedBytes: 40, totalBytes: 100 });
    recorder.progress({ completed: 3, total: 5, completedBytes: 60, totalBytes: 100 });
    f.show();
    recorder.visibilityChanged();
    f.advance(100);
    recorder.end(background, 'ready');
    const report = recorder.getRecords()[0];
    expect(report.source).toBe('background');
    expect(report.durationMs).toBe(1800);
    expect(report.events.map((e) => e.stage)).toEqual([
      'started', 'checking', 'update-found', 'visibility-hidden',
      'asset-quarter', 'asset-half', 'visibility-visible', 'ready',
    ]);
    expect(report.events.find((e) => e.stage === 'asset-quarter')).toMatchObject({
      elapsedMs: 1700, completedAssets: 2, totalAssets: 5,
      completedAssetBytes: 40, totalAssetBytes: 100,
    });
    const manual = recorder.start('manual');
    f.advance(30);
    recorder.end(manual, 'up-to-date');
    expect(recorder.getRecords().map((r) => r.source)).toEqual(['background', 'manual']);
    const restored = f.make().getRecords();
    expect(restored).toHaveLength(2);
    expect(restored[0].durationMs).toBe(1800);
  });

  it('never persists or collects in non-Preview builds', () => {
    const f = fixture(false);
    const recorder = f.make();
    expect(recorder.start('manual')).toBeNull();
    recorder.progress({ completed: 1, total: 1, completedBytes: 10, totalBytes: 10 });
    expect(recorder.getRecords()).toEqual([]);
    expect(f.values.size).toBe(0);
  });

  it('bounds histories and ignores invalid or expired records', () => {
    const f = fixture();
    const recorder = f.make();
    for (let i = 0; i < 27; i += 1) {
      const id = recorder.start('manual');
      recorder.end(id, 'up-to-date');
      f.advance(10);
    }
    expect(recorder.getRecords()).toHaveLength(24);
    const json = JSON.parse(recorder.exportJson()) as { records: unknown[] };
    expect(json.records).toHaveLength(24);
    expect(recorder.exportJson()).not.toContain('user@example');
    recorder.clear();
    expect(f.values.size).toBe(0);
    expect(recorder.getRecords()).toHaveLength(0);
    f.storage.setItem('mosaic_preview_pwa_update_timings_v1', JSON.stringify([
      { id: 'invalid', source: 'manual', events: [] },
    ]));
    expect(f.make().getRecords()).toEqual([]);
  });

  it('does not let unavailable storage abort update tracing', () => {
    const recorder = createPwaDiagnosticRecorder({
      enabled: true,
      storage: { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('quota'); }, removeItem: () => { throw new Error('blocked'); } },
      now: () => 100, wallNow: () => 1_795_000_000_000,
    });
    const id = recorder.start('manual');
    recorder.end(id, 'up-to-date');
    expect(recorder.getRecords()[0].outcome).toBe('up-to-date');
    expect(() => recorder.clear()).not.toThrow();
  });
});
