import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AppLayout sync watchdog contract', () => {
  it('keeps a bounded visible-only incremental catch-up loop', () => {
    const source = readFileSync(
      new URL('../../src/components/layout/AppLayout.tsx', import.meta.url),
      'utf8'
    );

    expect(source).toContain('window.setInterval');
    expect(source).toContain("document.visibilityState === 'visible'");
    expect(source).toContain("schedule('watchdog')");
    expect(source).toContain('120_000');
    expect(source).toContain('window.clearInterval(watchdogTimer)');
  });
});
