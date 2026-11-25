import {expect, test} from '@playwright/test';
const BASE = process.env.MOSAIC_E2E_BASE_URL ?? 'https://127.0.0.1:4173';
test.use({ignoreHTTPSErrors: true, viewport: {width:1600,height:850}, hasTouch:false,isMobile:false});
function summarize(trace, mode, dims) {
 const events = trace.traceEvents ?? [];
 const sum = n => {
   const a=events.filter(e=>e.name===n&&e.ph==='X').map(e=>(e.dur??0)/1000).sort((a,b)=>a-b);
   return {count:a.length,ms:+a.reduce((u,v)=>u+v,0).toFixed(2),p95:+(a[Math.min(a.length-1,Math.ceil(a.length*.95)-1)]??0).toFixed(2),max:+(a.at(-1)??0).toFixed(2)};
 };
 const groups = {};
 for (const e of events) if (e.name==='EventDispatch' && e.ph==='X') {
   const type=e.args?.data?.type||'other';
   (groups[type]??=[]).push((e.dur??0)/1000);
 }
 const eventDispatch = Object.fromEntries(Object.entries(groups).map(([name,ms])=>[name,{
   count:ms.length,sumMs:+ms.reduce((a,b)=>a+b,0).toFixed(2),maxMs:+Math.max(...ms).toFixed(2)
 }]));
 const topCalls = events.filter(e=>e.name==='FunctionCall'&&e.ph==='X')
   .sort((a,b)=>(b.dur??0)-(a.dur??0)).slice(0,12).map(e=>({
      ms:+((e.dur??0)/1000).toFixed(2),data:JSON.stringify(e.args?.data??{}).slice(0,250)}));
 const invalid = events.filter(e=>e.name==='StyleRecalcInvalidationTracking');
 const reasons={};
 for(const e of invalid) reasons[e.args?.data?.reason||'?']=(reasons[e.args?.data?.reason||'?']??0)+1;
 return {mode,dims,events:Object.fromEntries(['UpdateLayoutTree','Layout','FunctionCall','HitTest','Paint','CompositeLayers','RunTask','EventDispatch'].map(name=>[name,sum(name)])),
   eventDispatch,topCalls,layoutRoots:[...new Set(events.filter(e=>e.name==='Layout'&&e.ph==='X').flatMap(e=>e.args?.endData?.layoutRoots?.map(r=>r.nodeName)??[]))],reasons};
}
async function endTrace(cdp){
 const completed=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));
 await cdp.send('Tracing.end'); const {stream}=await completed; const chunks=[];
 if(!stream)throw Error('Trace stream missing');
 try {while(true){const c=await cdp.send('IO.read',{handle:stream});chunks.push(Buffer.from(c.data,c.base64Encoded?'base64':'utf8'));if(c.eof)break;}}
 finally{await cdp.send('IO.close',{handle:stream});}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function center(locator) {
 await locator.scrollIntoViewIfNeeded();const r=await locator.boundingBox();if(!r)throw Error('No target geometry');
 return {x:r.x+r.width/2,y:r.y+r.height/2};
}
for(const mode of ['panel','sheet']) {
 test('@performance #2298 112-task panel-vs-sheet ' + mode,async({page})=>{
  test.setTimeout(110000);
  await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(BASE).origin?route.continue():route.abort());
  await page.goto(BASE+'/tests/e2e/interaction-contract.html?splitRows=1&splitDense=1&side=right&splitPanelProbe=grid'+(mode==='sheet'?'&splitSheet=1':''));
  const date=await page.getByTestId('split-workspace').getAttribute('data-profile-date');expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.locator('[data-calendar-slide-index="30"] [data-calendar-day="'+date+'"]').click();
  const root=mode==='sheet'?page.getByRole('dialog').first():page.getByRole('complementary',{name:'Day details'});
  await expect(root).toBeVisible({timeout:15000});
  const slide=root.locator('.swiper-slide-active [data-testid="day-slide"]');
  await expect(slide.locator('[data-task-id="dense_task_0"]')).toBeVisible({timeout:15000});
  const dims=await page.evaluate(()=>({nodes:document.querySelectorAll('*').length,documentInert:Boolean(document.getElementById('root')?.inert),panelCount:document.querySelectorAll('[data-testid="calendar-day-side-panel"]').length,visibleRows:document.querySelectorAll('.swiper-slide-active [data-task-id]').length}));
  expect(dims.visibleRows).toBeGreaterThanOrEqual(110);
  await page.waitForTimeout(300);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.invalidationTracking',transferMode:'ReturnAsStream'});
  try{
   for(let iteration=0;iteration<3;iteration++){
    const a=slide.getByRole('button',{name:'Dense task 1',exact:true}),b=slide.getByRole('button',{name:'Dense task 3',exact:true});
    const from=await center(a),to=await center(b);
    await page.mouse.move(from.x,from.y);await page.mouse.down();
    try{
      await page.waitForTimeout(560);
      await expect(page.locator('[data-task-drag-overlay="true"]')).toBeVisible({timeout:8000});
      for(let pass=0;pass<2;pass++){await page.mouse.move(to.x,to.y,{steps:30});await page.mouse.move(from.x,from.y,{steps:30});}
    }finally{await page.keyboard.press('Escape');await page.mouse.up();}
    await expect(page.locator('[data-task-drag-overlay="true"]')).toHaveCount(0);
   }
  }finally{
   const summary=summarize(await endTrace(cdp),mode,dims);
   console.log('MOSAIC_2298_PANEL_SHEET_DENSE_TRACE '+JSON.stringify(summary));
   await cdp.detach();
  }
 });
}
