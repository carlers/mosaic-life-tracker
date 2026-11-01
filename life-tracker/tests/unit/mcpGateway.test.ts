'use strict';
import { test } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const assert=require('node:assert/strict');
const {dispatch,tools,dateValid}=require('../../server/mcpGateway.cjs');
const {enabled,metadata}=require('../../server/mcpAuth.cjs');

const owner='owner1';
function rows(){
  const calls=[];
  return {
    calls,
    categories:async id=>{calls.push(['categories',id]);return [
      {$id:'catA',user_id:'owner1',deleted:false,name:'School',secret:'never-return'}];},
    tasks:async(id,date)=>{calls.push(['tasks',id,date]);return [
      {$id:'taskA',user_id:'owner1',deleted:false,title:'Homework',date:date||'',
       category_id:'catA',is_completed:false,memo:'never-return',image:'never-return'}];}
  };
}
const req=(method,params,id=2)=>({jsonrpc:'2.0',id,method,params});
test('only read-only tools are advertised',async()=>{
  const s=rows();
  const result=await dispatch(req('tools/list'),owner,s);
  assert.deepEqual(result.result.tools.map(t=>t.name),
    ['mosaic_list_categories','mosaic_list_tasks']);
  assert.equal(tools.some(t=>/delete|write|create/i.test(t.name)),false);
  assert.equal(s.calls.length,0);
});
test('all owner access comes from the verified token, never tool inputs',async()=>{
  const s=rows();
  const result=await dispatch(req('tools/call',{
    name:'mosaic_list_tasks',arguments:{date:'2026-11-02'}}),owner,s);
  assert.equal(result.result.isError,false);
  assert.equal(result.result.content[0].text.includes('never-return'),false);
  assert.deepEqual(s.calls,[['tasks',owner,'2026-11-02']]);
  const bad=await dispatch(req('tools/call',{
    name:'mosaic_list_tasks',arguments:{ownerId:'intruder'}}),owner,s);
  assert.equal(bad.error.code,-32602);
});
test('dangerous or unsupported tool requests cannot write',async()=>{
  const s=rows();
  const result=await dispatch(req('tools/call',{
    name:'mosaic_delete_tasks',arguments:{ids:['taskA']}}),owner,s);
  assert.equal(result.error.code,-32602);
  assert.equal(s.calls.length,0);
});
test('rejects unsafe datastore rows and malformed calendar dates',async()=>{
  const store={categories:async()=>[{$id:'x',user_id:'intruder',deleted:false}],
    tasks:async()=>[]};
  const result=await dispatch(req('tools/call',{name:'mosaic_list_categories',arguments:{}}),owner,store);
  assert.equal(result.result.isError,true);
  assert.equal(dateValid('2026-02-31'),false);
  assert.equal(dateValid('2026-11-02'),true);
});
test('fail closed unless exact Scratch preview configuration and key exist',()=>{
  const cfg={VERCEL_ENV:'preview',MOSAIC_MCP_SCRATCH_ONLY:'true',
    MOSAIC_MCP_PROJECT_ID:'6a96e82d000d1310b3be',
    MOSAIC_MCP_ISSUER:'https://fra.cloud.appwrite.io/v1/oauth2/6a96e82d000d1310b3be',
    MOSAIC_MCP_RESOURCE:'https://mcp-preview.example.com/mcp',
    MOSAIC_MCP_READ_KEY:'dummy_only_for_unit_tests'};
  assert.equal(enabled(cfg),true);
  assert.equal(enabled({...cfg,VERCEL_ENV:'production'}),false);
  assert.equal(enabled({...cfg,MOSAIC_MCP_PROJECT_ID:'6a9703c50016b37110ff'}),false);
  assert.equal(enabled({...cfg,MOSAIC_MCP_READ_KEY:''}),false);
  assert.equal(metadata(cfg).scopes_supported[0],'tasks.read');
});
