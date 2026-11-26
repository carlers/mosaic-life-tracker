import { expect, test } from '@playwright/test';

// Real IndexedDB durability and atomicity in local browser only, no Appwrite.
// Current source-only cursor consumer is not connected to normal RxDB sync.
const BASE=process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
if (!['127.0.0.1','localhost'].includes(new URL(BASE).hostname))
  throw new Error('Owner feed cursor tests require local Vite origin');
test.use({ignoreHTTPSErrors:true});

test('isolated E2EE owner cursor is CAS-protected and survives reload without private payload',async({page})=>{
  let backendWrites=0;
  await page.route('https://129-221-244-67.sslip.io/**',route=>{
    if (!['GET','HEAD','OPTIONS'].includes(route.request().method())) backendWrites++;
    return route.abort('blockedbyclient');
  });
  await page.goto(BASE+'/login',{waitUntil:'domcontentloaded'});
  const first=await page.evaluate(async()=>{
    const {indexedDbOwnerFeedCheckpoints:db}=await import('/src/lib/e2ee/ownerFeedIndexedDbCheckpoint.ts');
    const owner={projectId:'6b00671500279e901846',ownerId:'synthetic_feed_a'};
    const collection='tasks';
    const a={schema:1,...owner,collection,keyId:'k_'+'a'.repeat(32),generation:1,
      after:{updatedAt:'2026-11-26T02:00:00.000Z',rowId:'p_'+'b'.repeat(32)}};
    const b={...a,after:{updatedAt:'2026-11-26T02:01:00.000Z',rowId:'p_'+'c'.repeat(32)}};
    if(await db.read(owner,collection)!==null) throw new Error('Synthetic feed data was not empty');
    const written=await db.compareAndSet(owner,collection,null,a);
    const stale=await db.compareAndSet(owner,collection,null,b);
    const current=await db.read(owner,collection);
    const other=await db.read({...owner,ownerId:'synthetic_feed_b'},collection);
    return {written,stale,current,other};
  });
  expect(first.written).toBe(true);
  expect(first.stale).toBe(false);
  expect(first.other).toBeNull();
  expect(first.current.after.rowId).toBe('p_'+'b'.repeat(32));
  expect(JSON.stringify(first.current)).not.toContain('PRIVATE-TITLE');
  await page.reload({waitUntil:'domcontentloaded'});
  const recovered=await page.evaluate(async()=>{
    const {indexedDbOwnerFeedCheckpoints:db}=await import('/src/lib/e2ee/ownerFeedIndexedDbCheckpoint.ts');
    const owner={projectId:'6b00671500279e901846',ownerId:'synthetic_feed_a'};
    const collection='tasks';
    const before=await db.read(owner,collection);
    const next={...before,after:{updatedAt:'2026-11-26T02:01:00.000Z',rowId:'p_'+'c'.repeat(32)}};
    const accepted=await db.compareAndSet(owner,collection,before,next);
    const rollback=await db.compareAndSet(owner,collection,next,before).then(()=>false,()=>true);
    const oldKey={...before,keyId:'k_'+'f'.repeat(32)};
    const mistaken=await db.compareAndSet(owner,collection,oldKey,next);
    const after=await db.read(owner,collection);
    let crossProject=false;
    try { await db.read({...owner,projectId:'6ae9599c002ab812f9c3'},collection); }
    catch { crossProject=true; }
    return {accepted,rollback,mistaken,after,crossProject};
  });
  expect(recovered).toMatchObject({
    accepted:true,rollback:true,mistaken:false,crossProject:true,
  });
  expect(recovered.after.after.rowId).toBe('p_'+'c'.repeat(32));
  expect(backendWrites).toBe(0);
});


test('parallel tabs cannot both accept the same checkpoint baseline',async({browser})=>{
  const context=await browser.newContext({ignoreHTTPSErrors:true});
  let backendWrites=0;
  await context.route('https://129-221-244-67.sslip.io/**',route=>{
    if (!['GET','HEAD','OPTIONS'].includes(route.request().method())) backendWrites++;
    return route.abort('blockedbyclient');
  });
  try {
    const [a,b]=await Promise.all([context.newPage(),context.newPage()]);
    await Promise.all([a.goto(BASE+'/login',{waitUntil:'domcontentloaded'}),
      b.goto(BASE+'/login',{waitUntil:'domcontentloaded'})]);
    const attempt=(page,index)=>page.evaluate(async(i)=>{
      const {indexedDbOwnerFeedCheckpoints:db}=await import('/src/lib/e2ee/ownerFeedIndexedDbCheckpoint.ts');
      const owner={projectId:'6b00671500279e901846',ownerId:'synthetic_parallel_owner'};
      const next={schema:1,...owner,collection:'diary',keyId:'k_'+'a'.repeat(32),generation:1,
        after:{updatedAt:'2026-11-26T02:00:00.000Z',rowId:'p_'+i.repeat(32)}};
      return db.compareAndSet(owner,'diary',null,next);
    },index);
    const outcomes=await Promise.all([attempt(a,'a'),attempt(b,'b')]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    const saved=await a.evaluate(async()=>{
      const {indexedDbOwnerFeedCheckpoints:db}=await import('/src/lib/e2ee/ownerFeedIndexedDbCheckpoint.ts');
      return db.read({projectId:'6b00671500279e901846',
        ownerId:'synthetic_parallel_owner'},'diary');
    });
    expect(saved.after.rowId).toMatch(/^p_[ab]{32}$/);
    expect(backendWrites).toBe(0);
  } finally {
    await context.close();
  }
});
