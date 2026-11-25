import {test, expect} from '@playwright/test';
const base=process.env.MOSAIC_E2E_BASE_URL??'https://127.0.0.1:4173';
test.use({ignoreHTTPSErrors:true,viewport:{width:900,height:700}});
test('@performance #2298 offline numeric drag recorder, no private text',async({page})=>{
 await page.goto(base+'/tests/e2e/2298-drag-frame-audit.html?mosaic2298Perf=1');
 const hud=page.getByRole('region',{name:'Drag performance recorder'});
 await expect(hud).toBeVisible();
 const input=page.getByRole('button',{name:'Sensitive diary content must never be copied'});
 const r=await input.boundingBox(); if(!r)throw Error('Missing target');
 await page.mouse.move(r.x+20,r.y+10);await page.mouse.down();
 await page.mouse.move(r.x+95,r.y+35,{steps:20});await page.mouse.up();
 const field=page.getByRole('textbox',{name:'Numeric drag performance summary'});
 await expect.poll(async()=>JSON.parse(await field.inputValue()).gestureCount).toBe(1);
 const value=JSON.parse(await field.inputValue());
 expect(value.samples[0]).toMatchObject({presentation:'panel',gesture:'task'});
 expect(value.samples[0].pointerMoves).toBeGreaterThan(2);
 expect(value.samples[0].sampleFrames).toBeGreaterThanOrEqual(1);
 expect(JSON.stringify(value)).not.toContain('Sensitive diary content');
 expect(JSON.stringify(value)).not.toContain('synthetic_task');
 await hud.getByRole('button',{name:'Clear'}).click();
 await expect.poll(async()=>JSON.parse(await field.inputValue()).gestureCount).toBe(0);
});
test('@performance #2298 profiler disabled unless explicit flag',async({page})=>{
 await page.goto(base+'/tests/e2e/2298-drag-frame-audit.html');
 await expect(page.getByRole('region',{name:'Drag performance recorder'})).toHaveCount(0);
});
