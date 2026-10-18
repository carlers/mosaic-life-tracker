import { expect, test } from '@playwright/test';

// Research-only synthetic A/B on the same Chromium runner and same source build.
// The comparator experiment is enabled exclusively on the non-deploying lab branch.
const BASE = 'http://127.0.0.1:4173';
const fixtures = [
  { count: 25, scenario: 'dense' },
  { count: 250, scenario: 'dense' },
  { count: 1000, scenario: 'dense' },
  { count: 1000, scenario: 'month' },
  { count: 1000, scenario: 'years' },
];
const repeats = 4;
const median = values => {
  const a = [...values].sort((x,y) => x-y);
  return a[Math.floor((a.length-1)/2)];
};
test.setTimeout(600_000);
test('@performance paired DayCell sequence comparator on one-task edits', async ({ browser }) => {
  const context = await browser.newContext({
    viewport:{width:412,height:915},deviceScaleFactor:2,isMobile:true,
    hasTouch:true,serviceWorkers:'block',
  });
  const rows = [];
  try {
    for (const fixture of fixtures) {
      for (const snapshot of ['structural','recreated']) {
        for (let trial = 0; trial < repeats; trial++) {
          const order = trial % 2 ? ['sequence','baseline'] : ['baseline','sequence'];
          for (const compare of order) {
            const page = await context.newPage();
            const cdp = await context.newCDPSession(page);
            await cdp.send('Emulation.setCPUThrottlingRate',{rate:2});
            try {
              const qs = new URLSearchParams({
                calendarReconcileLab:'1',mode:'all',
                count:String(fixture.count),scenario:fixture.scenario,
                snapshot,cellCompare:compare,schedule:'sync',
              });
              await page.goto(`${BASE}/tests/e2e/interaction-contract.html?${qs}`,{
                waitUntil:'domcontentloaded', timeout:60000,
              });
              const root = page.getByTestId('reconcile-lab');
              await expect(root.getByRole('grid',{name:'October 2026 calendar'}))
                .toBeVisible({timeout:40000});
              const result = await page.evaluate(() => new Promise((resolve,reject) => {
                const root=document.querySelector('[data-testid="reconcile-lab"]');
                const button=root?.querySelector('[data-testid="reconcile-update"]');
                const revision=root?.querySelector('[data-testid="reconcile-revision"]');
                if(!(button instanceof HTMLButtonElement)||!revision)
                  return reject(Error('Missing reconcile fixture'));
                window.__mosaic858ReconcileCommits=[];
                const t0=performance.now();
                const mo=new MutationObserver(()=>{
                  if(revision.textContent!=='1')return;
                  mo.disconnect();
                  const commitMs=performance.now()-t0;
                  const active=root.querySelector('[data-calendar-slide-index="30"]');
                  const taskCount=active?.querySelectorAll('[title^="Reconcile fixture "]').length ?? 0;
                  const editedCount=active?.querySelectorAll('[title="Reconcile fixture 0 changed"]').length ?? 0;
                  const gridCount=root.querySelectorAll('[role="grid"]').length;
                  const readStart=performance.now();
                  for(const cell of root.querySelectorAll('[role="gridcell"]'))
                    cell.getBoundingClientRect();
                  const layoutReadMs=performance.now()-readStart;
                  const elements=root.querySelectorAll('*').length;
                  requestAnimationFrame(()=>requestAnimationFrame(()=>{
                    const entries=window.__mosaic858ReconcileCommits??[];
                    resolve({commitMs,paintProxyMs:performance.now()-t0,
                      renderMs:entries.at(-1)?.actualDuration??-1,
                      taskCount,editedCount,gridCount,layoutReadMs,elements});
                  }));
                });
                mo.observe(revision,{subtree:true,childList:true,characterData:true});
                button.click();
                setTimeout(()=>{mo.disconnect();reject(Error('reconcile timeout'))},20000);
              }));
              expect(result.gridCount).toBe(3);
              expect(result.taskCount).toBe(fixture.scenario==='years'?25:fixture.count);
              expect(result.editedCount).toBe(1);
              rows.push({...fixture,snapshot,compare,trial,...result});
              console.log('MOSAIC_858_CELLMEMO_ROW '+JSON.stringify(rows.at(-1)));
            } finally { await page.close(); }
          }
        }
        const group=rows.filter(row=>row.count===fixture.count &&
          row.scenario===fixture.scenario && row.snapshot===snapshot);
        const ref=group.filter(row=>row.compare==='baseline');
        const alt=group.filter(row=>row.compare==='sequence');
        const summary={
          ...fixture,snapshot,repeats,
          baseline:{renderP50:median(ref.map(x=>x.renderMs)),
            commitP50:median(ref.map(x=>x.commitMs)),
            paintP50:median(ref.map(x=>x.paintProxyMs)),
            layoutReadP50:median(ref.map(x=>x.layoutReadMs)),
          },
          sequence:{renderP50:median(alt.map(x=>x.renderMs)),
            commitP50:median(alt.map(x=>x.commitMs)),
            paintP50:median(alt.map(x=>x.paintProxyMs)),
            layoutReadP50:median(alt.map(x=>x.layoutReadMs)),
          },
          pairedRenderDeltaP50:median(
            Array.from({length:repeats},(_,i)=>
              alt.find(row=>row.trial===i).renderMs-ref.find(row=>row.trial===i).renderMs)),
        };
        console.log('MOSAIC_858_CELLMEMO_GROUP '+JSON.stringify(summary));
      }
    }
    console.log('MOSAIC_858_CELLMEMO_FINAL '+JSON.stringify({total:rows.length}));
    expect(rows).toHaveLength(fixtures.length*2*2*repeats);
  } finally {await context.close();}
});
