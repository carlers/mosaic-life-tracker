import { expect, test } from '@playwright/test';

const BASE = 'http://127.0.0.1:4173';
const fixtures = [
  { count: 25, scenario: 'dense' },
  { count: 250, scenario: 'dense' },
  { count: 1000, scenario: 'dense' },
  { count: 1000, scenario: 'month' },
  { count: 1000, scenario: 'years' },
];
const cases = ['baseline', 'day', 'block', 'both'].flatMap(memo =>
  ['structural', 'recreated'].map(snapshot => ({ memo, snapshot, mode: 'all' })));
const n = 3;
function median(arr) { const a = [...arr].sort((x,y) => x-y); return a[Math.floor(a.length/2)]; }
test.setTimeout(600_000);
test('@performance #858 immutable day signature vs TaskBlock memo A/B', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    serviceWorkers: 'block',
  });
  const results = [];
  try {
    for (const fixture of fixtures) {
      for (let trial = 0; trial < n; trial++) {
        // Match runner warmth by alternating which grouping algorithm goes first.
        const variants = trial % 2 ? [...cases].reverse() : cases;
        for (const opt of variants) {
          const page = await context.newPage();
          const cdp = await context.newCDPSession(page);
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
          try {
            const qs = new URLSearchParams({
              calendarReconcileLab: '1',
              count: String(fixture.count),
              scenario: fixture.scenario,
              mode: opt.mode,
              snapshot: opt.snapshot,
              memo: opt.memo,
              schedule: 'sync',
            });
            await page.goto(`${BASE}/tests/e2e/interaction-contract.html?${qs}`, {
              waitUntil: 'domcontentloaded', timeout: 45_000,
            });
            const root = page.getByTestId('reconcile-lab');
            await expect(root.getByRole('grid', { name: 'October 2026 calendar' }))
              .toBeVisible({ timeout: 40_000 });
            await expect(root.getByRole('grid')).toHaveCount(3);
            const result = await page.evaluate(() => new Promise((resolve, reject) => {
              const root = document.querySelector('[data-testid="reconcile-lab"]');
              const button = root?.querySelector('[data-testid="reconcile-update"]');
              const output = root?.querySelector('[data-testid="reconcile-revision"]');
              if (!(button instanceof HTMLButtonElement) || !output) {
                reject(Error('Missing isolated fixture')); return;
              }
              window.__mosaic858ReconcileCommits = [];
              const t0 = performance.now();
              const observer = new MutationObserver(() => {
                if (output.textContent !== '1') return;
                observer.disconnect();
                const committedMs = performance.now() - t0;
                const active = root.querySelector('[data-calendar-slide-index="30"]');
                const activeBlockCount = active?.querySelectorAll('[title^="Reconcile fixture "]').length ?? 0;
                const updatedCount = active?.querySelectorAll('[title="Reconcile fixture 0 changed"]').length ?? 0;
                const domNodes = root.querySelectorAll('*').length;
                const layoutStart = performance.now();
                const grids = root.querySelectorAll('[role="grid"]');
                grids.forEach(grid => grid.getBoundingClientRect());
                active?.getBoundingClientRect();
                const layoutReadMs = performance.now() - layoutStart;
                requestAnimationFrame(() => requestAnimationFrame(() => {
                  const entries = window.__mosaic858ReconcileCommits ?? [];
                  resolve({
                    committedMs: Math.round(committedMs * 10) / 10,
                    twoFrameMs: Math.round((performance.now()-t0)*10)/10,
                    layoutReadMs: Math.round(layoutReadMs*10)/10,
                    reactActualMs: Math.round((entries.at(-1)?.actualDuration ?? -1)*10)/10,
                    reactBaseMs: Math.round((entries.at(-1)?.baseDuration ?? -1)*10)/10,
                    profilerCommits: entries.length,
                    activeBlockCount, updatedCount, domNodes,
                    grids: grids.length,
                  });
                }));
              });
              observer.observe(output, { childList: true, subtree: true, characterData: true });
              button.click();
              setTimeout(() => { observer.disconnect(); reject(Error('Single task update timeout')); }, 20_000);
            }));
            const expectedVisible = fixture.scenario === 'years' ? 25 : fixture.count;
            expect(result.activeBlockCount).toBe(expectedVisible);
            expect(result.updatedCount).toBe(1);
            expect(result.grids).toBe(3);
            results.push({ ...fixture, ...opt, trial, ...result });
            console.log('MOSAIC_858_MEMO_ROW ' + JSON.stringify(results.at(-1)));
          } finally { await page.close(); }
        }
      }
      const sample = results.filter(x => x.count === fixture.count && x.scenario === fixture.scenario);
      const keyed = Object.fromEntries(cases.map(c => {
        const rows = sample.filter(x => x.memo === c.memo && x.snapshot === c.snapshot);
        return [c.memo + ':' + c.snapshot, {
          reactP50Ms: median(rows.map(x=>x.reactActualMs)),
          updateDOMP50Ms: median(rows.map(x=>x.committedMs)),
          twoFrameP50Ms: median(rows.map(x=>x.twoFrameMs)),
          layoutReadP50Ms: median(rows.map(x=>x.layoutReadMs)),
          nodesP50: median(rows.map(x=>x.domNodes)),
        }];
      }));
      console.log('MOSAIC_858_MEMO_GROUP ' +
        JSON.stringify({ ...fixture, repeats: n, groups: keyed }));
    }
    console.log('MOSAIC_858_MEMO_FINAL '+JSON.stringify({total:results.length,fixtures:fixtures.length}));
    expect(results).toHaveLength(fixtures.length*cases.length*n);
  } finally {await context.close();}
});
