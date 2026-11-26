import {test,expect} from '@playwright/test';
const BASE=process.env.MOSAIC_E2E_BASE_URL??'https://127.0.0.1:4173';
if(!['127.0.0.1','localhost'].includes(new URL(BASE).hostname))
  throw new Error('E2EE raw storage probe must use localhost only');
test.use({ignoreHTTPSErrors:true});
test('Dexie raw storage retains _deleted tombstones and excludes foreign owner',async({page})=>{
  let writes=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))writes++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
    const {runOwnerRawDexieFixture}=await import(
      '/tests/e2e/fixtures/e2eeOwnerRawDexieFixture.ts'
    );
    return runOwnerRawDexieFixture();

  });
  expect(result).toEqual({rows:[
    {id:'alive',deleted:false,rev:true,meta:true,title:'SECRET-ALIVE'},
    {id:'gone',deleted:true,rev:true,meta:true,title:'SECRET-GONE'},
  ],foreign:['other']});
  expect(writes).toBe(0);
});
