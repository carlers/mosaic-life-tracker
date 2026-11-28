import { MOSAIC_DATABASE, MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

const expected = MOSAIC_TABLES.find(table => table.id === 'task_requests');
const messageColumns = MOSAIC_TABLES.find(table => table.id === 'messages')?.columns
  .filter(column => ['task_request_id','task_request_event'].includes(column.key));

// Additive, existing-row-compatible. Refuse unknown schemas or grants.
export async function migrateTaskRequestsBackend({request, log=()=>{}, sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}) {
  if (!expected || messageColumns?.length !== 2) throw new Error('Task Requests manifest incomplete');
  const db = '/tablesdb/' + MOSAIC_DATABASE.id + '/tables';
  const optional = async path => {
    try {return await request('GET',path);}
    catch (error) {if (Number(error?.status)===404) return null; throw error;}
  };
  const tablePath = db + '/task_requests';
  let existing = await optional(tablePath);
  if (!existing) {
    log('Creating server-only task_requests table');
    await request('POST',db,{
      tableId:expected.id,name:expected.name,permissions:[],
      rowSecurity:true,enabled:true,columns:expected.columns,indexes:expected.indexes,
    });
  } else {
    const perms = existing.$permissions || existing.permissions || [];
    if (existing.$id !== 'task_requests' || existing.rowSecurity !== true ||
        existing.enabled === false || !Array.isArray(perms) || perms.length)
      throw new Error('Incompatible task_requests table access');
    const columns = new Map((existing.columns||[]).map(c=>[c.key,c]));
    for (const column of expected.columns) {
      const actual = columns.get(column.key);
      if (!actual || actual.type!==column.type || actual.required!==column.required ||
          (column.size && actual.size!==column.size) ||
          (Object.hasOwn(column,'default') && column.default!==actual.default))
        throw new Error('Incompatible task_requests column: '+column.key);
    }
    const indexes = new Map((existing.indexes||[]).map(x=>[x.key,x]));
    for (const index of expected.indexes) {
      const actual=indexes.get(index.key);
      if (!actual || actual.type!==index.type ||
          JSON.stringify(actual.attributes??actual.columns)!==JSON.stringify(index.attributes))
        throw new Error('Incompatible task_requests index: '+index.key);
    }
  }
  if (!await optional(db+'/messages')) throw new Error('Messages table unavailable');
  let newColumns = 0;
  for (const column of messageColumns) {
    const path = db + '/messages/columns/' + column.key;
    const prior = await optional(path);
    const validate = value => {
      if (value?.key!==column.key || value?.type!==column.type || value?.size!==column.size ||
          value?.required!==false || (value?.default??'')!=='')
        throw new Error('Incompatible messages field '+column.key);
      if (value.status === 'failed') throw new Error('Failed messages field '+column.key);
    };
    if (prior) validate(prior);
    else {
      await request('POST',db+'/messages/columns/varchar',{
        key:column.key,size:column.size,required:false,default:'',array:false,encrypt:false,
      });
      newColumns++;
    }
    let ready = false;
    for (let i=0;i<60;i++) {
      const value=await request('GET',path);
      validate(value);
      if (!value.status || value.status === 'available') {ready=true;break;}
      await sleep(500);
    }
    if (!ready) throw new Error('Task request message fields not ready');
  }
  return {table:'task_requests',created:!existing,messageColumnsAdded:newColumns};
}
