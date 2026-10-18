import { expect, test } from '@playwright/test';

// Diagnostic-only paired React/DOM local-data reveal probe. This is NOT a
// browser-cached Home startup metric and has no account/network dependency.
const ORIGIN = 'http://127.0.0.1:4173';
const COUNTS = [0, 25, 250, 1000];
const REPEATS = 5;
const median = xs => {
  const a = [...xs].sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
};

test.use({
  ignoreHTTPSErrors: true,
  viewport: { width: 412, height: 915 },
  isMobile: true,
  hasTouch: true,
});
test.setTimeout(250_000);

test('@performance paired owner Calendar neighbor render reveal', async ({ browser }) => {
  const rows = [];
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true,
    serviceWorkers: 'block',
  });
  try {
    for (const count of COUNTS) {
      for (let i = 0; i < REPEATS; i++) {
        // Alternate direction to avoid drifting runner temperature/CPU biases.
        const variants = i % 2 ? ['deferred', 'baseline'] : ['baseline', 'deferred'];
        for (const variant of variants) {
          const page = await ctx.newPage();
          const cdp = await ctx.newCDPSession(page);
          await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
          try {
            await page.goto(`${ORIGIN}/tests/e2e/interaction-contract.html?calendarNeighborBench=1&count=${count}&variant=${variant}`, {
              waitUntil: 'domcontentloaded',
              timeout: 60_000,
            });
            const holder = page.getByTestId('neighbor-benchmark-root');
            await expect(holder).toBeVisible({ timeout: 30_000 });
            const initialGrids = await holder.getByRole('grid').count();
            expect(initialGrids).toBe(variant === 'deferred' ? 1 : 3);
            const sample = await page.evaluate(count => new Promise((resolve, reject) => {
              const holder = document.querySelector('[data-testid="neighbor-benchmark-root"]');
              const button = holder?.querySelector('[data-testid="neighbor-load"]');
              if (!(button instanceof HTMLButtonElement)) return reject(Error('No fixture button'));
              let done = false;
              let firstReady = 0;
              const started = performance.now();
              const observer = new MutationObserver(() => {
                if (done) return;
                const ready = holder.querySelector('[data-testid="neighbor-ready"]')?.textContent === 'ready';
                const active = holder.querySelector('[data-calendar-slide-index="30"]');
                const blocks = active?.querySelectorAll('[title^="Neighbor fixture "]').length ?? 0;
                if (!ready || blocks !== count) return;
                done = true;
                observer.disconnect();
                firstReady = performance.now() - started;
                requestAnimationFrame(() => requestAnimationFrame(() => {
                  resolve({
                    firstReadyMs: Math.round(firstReady * 10) / 10,
                    twoFrameMs: Math.round((performance.now() - started) * 10) / 10,
                    activeBlocks: blocks,
                    gridCountAfterTwoFrames: holder.querySelectorAll('[role="grid"]').length,
                    totalElements: holder.querySelectorAll('*').length,
                  });
                }));
              });
              observer.observe(holder, { subtree: true, childList: true, characterData: true });
              button.click();
              setTimeout(() => {
                observer.disconnect();
                if (!done) reject(Error('Calendar task DOM did not reveal'));
              }, 20_000);
            }), count);
            expect(sample.activeBlocks).toBe(count);
            rows.push({ count, variant, iteration: i + 1, initialGrids, ...sample });
            console.log('MOSAIC_858_NEIGHBOR_ROW ' + JSON.stringify(rows.at(-1)));
          } finally {
            await page.close();
          }
        }
      }
      const group = rows.filter(x => x.count === count);
      const baseline = group.filter(x => x.variant === 'baseline');
      const deferred = group.filter(x => x.variant === 'deferred');
      const summary = {
        count, repeats: REPEATS,
        baseline: {
          firstReadyP50Ms: median(baseline.map(x => x.firstReadyMs)),
          twoFrameP50Ms: median(baseline.map(x => x.twoFrameMs)),
          elementsP50: median(baseline.map(x => x.totalElements)),
        },
        deferred: {
          firstReadyP50Ms: median(deferred.map(x => x.firstReadyMs)),
          twoFrameP50Ms: median(deferred.map(x => x.twoFrameMs)),
          elementsP50: median(deferred.map(x => x.totalElements)),
        },
        pairedFirstReadyDeltaMs: median(Array.from({ length: REPEATS },
          (_, i) => deferred[i].firstReadyMs - baseline[i].firstReadyMs)),
      };
      console.log('MOSAIC_858_NEIGHBOR_GROUP ' + JSON.stringify(summary));
    }
    console.log('MOSAIC_858_NEIGHBOR_FINAL ' + JSON.stringify({ total: rows.length, counts: COUNTS }));
    expect(rows).toHaveLength(COUNTS.length * REPEATS * 2);
  } finally {
    await ctx.close();
  }
});
