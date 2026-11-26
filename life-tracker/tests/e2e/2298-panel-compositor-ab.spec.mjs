import {test, expect} from '@playwright/test';
const base = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
test.use({ignoreHTTPSErrors:true,viewport:{width:900,height:700}});
const computed = page => page.evaluate(() => ({
  blur: getComputedStyle(document.querySelector('[data-testid="sample-blur"]')).backdropFilter,
  transform: getComputedStyle(document.querySelector('[data-testid="day-panel-motion-host"] > div')).transform,
}));
test('#2298 compositor diagnostic off by default', async ({page}) => {
  await page.goto(base+'/tests/e2e/2298-panel-compositor-ab.html');
  await expect(page.getByRole('region',{name:'Panel compositor comparison'})).toHaveCount(0);
  expect(await computed(page)).toMatchObject({blur:'blur(15px)'});
  expect((await computed(page)).transform).not.toBe('none');
});
test('#2298 compositor modes isolate panel blur and only wrapper transform', async ({page}) => {
  await page.goto(base+'/tests/e2e/2298-panel-compositor-ab.html?mosaic2298Compositor=1');
  const hud=page.getByRole('region',{name:'Panel compositor comparison'});
  await expect(hud).toBeVisible();
  const baseline=await computed(page);
  expect(baseline.blur).toBe('blur(15px)');
  expect(baseline.transform).not.toBe('none');
  await hud.getByRole('button',{name:'No panel blur'}).click();
  expect((await computed(page)).blur).toBe('none');
  expect((await computed(page)).transform).not.toBe('none');
  await hud.getByRole('button',{name:'No panel wrapper transform'}).click();
  expect((await computed(page)).blur).toBe('blur(15px)');
  expect((await computed(page)).transform).toBe('none');
  await hud.getByRole('button',{name:'Both disabled'}).click();
  expect(await computed(page)).toEqual({blur:'none',transform:'none'});
  await hud.getByRole('button',{name:'Default'}).click();
  expect(await computed(page)).toEqual(baseline);
  expect(await hud.textContent()).not.toContain('Sensitive diary');
  await expect(hud.getByRole('status')).toHaveText('Mode: Default');
});