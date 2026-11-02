import { test, expect } from '@playwright/test';
const demoURL=process.env.MOSAIC_DEMO_TEST_URL;
test.describe('real production Mosaic UI in isolated public Demo Mode (#1617)',()=>{
 test.skip(!demoURL,'Only run with a built standalone demo.');
 test('uses actual navigation, DayViewSheet, persistent local CRUD and reset with zero remote requests',async({page})=>{
  const requests=[],errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',async route=>{
   if(new URL(route.request().url()).origin===new URL(demoURL).origin)return route.continue();
   requests.push(route.request().url());await route.abort();
  });
  await page.goto(demoURL);
  await expect(page.getByRole('navigation',{name:'Main'})).toBeVisible();
  for(const item of ['Home','Explore','Alerts','Chat','Me'])
   await expect(page.getByRole('navigation',{name:'Main'}).getByRole('button',{name:item,exact:true})).toBeVisible();
  await expect(page.getByText('DEMO · Fictional browser-only data')).toBeVisible();
  const now=new Date(),today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  await page.locator('[data-calendar-day="'+today+'"]').first().click();
  const sheet=page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button',{name:'Switch to timeline view'})).toBeVisible();
  await expect(sheet.getByRole('button',{name:'Previous day'}).first()).toBeVisible();
  await sheet.getByRole('button',{name:'Add a task to School'}).last().click();
  await sheet.getByPlaceholder('Add a task to School...').fill('Sample task added in the demo');
  await sheet.getByPlaceholder('Add a task to School...').press('Enter');
  await expect(sheet.getByText('Sample task added in the demo')).toBeVisible();
  await page.reload();
  await page.locator('[data-calendar-day="'+today+'"]').first().click();
  await expect(page.getByRole('dialog').getByText('Sample task added in the demo')).toBeVisible();
  await page.goto(demoURL);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  page.once('dialog',d=>d.accept());
  await page.getByRole('button',{name:'Reset',exact:true}).click();
  // Reset prompt must run before data is cleared.
  await expect(page).toHaveURL(/\/demo\/home$/);
  await page.locator('[data-calendar-day="'+today+'"]').first().click();
  await expect(page.getByRole('dialog').getByText('Sample task added in the demo')).toHaveCount(0);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
 });
 test('shows fictional friends and allows explicitly local chat interactions', async ({page}) => {
  const outbound=[], errors=[];
  const origin=new URL(demoURL).origin;
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/*',async route => {
   if(new URL(route.request().url()).origin===origin) return route.continue();
   outbound.push(route.request().url());return route.abort();
  });
  await page.goto(new URL('messages',demoURL).href);
  await expect(page.getByText('Lee (demo)')).toBeVisible();
  await expect(page.getByText('Ava (demo)')).toBeVisible();
  await page.getByText('Lee (demo)').first().click();
  await expect(page.getByText('The demo UI is looking good. Shall we check the task flow?')).toBeVisible();
  await page.getByPlaceholder('Message...').fill('Fictional local chat test');
  await page.getByRole('button',{name:'Send',exact:true}).click();
  await expect(page.getByText('Fictional local chat test')).toBeVisible();
  await expect(page.getByText('Saved in demo only')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Fictional local chat test')).toBeVisible();
  expect(outbound).toEqual([]);
  expect(errors).toEqual([]);
 });
});
