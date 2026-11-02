import {createHash} from 'node:crypto';
import {Client,TablesDB,Query,Permission,Role} from 'node-appwrite';
import {config,SCRATCH,ENDPOINT} from './config.js';

export function createRepository(owner,env=process.env) {
 const {key}=config(env);
 const client=new Client().setEndpoint(ENDPOINT).setProject(SCRATCH).setKey(key);
 const tables=new TablesDB(client),databaseId='life_tracker';
 const ownerQuery=(extra=[],limit=20)=>[
  Query.equal('user_id',owner),Query.equal('deleted',false),...extra,Query.limit(limit)
 ];
 async function list(tableId,extra=[],limit=20) {
   const response=await tables.listRows({databaseId,tableId,queries:ownerQuery(extra,limit)});
   const rows=response.rows??[];
   if(!Array.isArray(rows)||rows.some(r=>r.user_id!==owner||r.deleted!==false))
     throw Error('Ownership and soft-deletion contract violation');
   return {rows,total:response.total};
 }
 return {
   categories:()=>list('categories'),
   tasks:({date,categoryId,completed}={})=>{
     const filters=[
       ...(date!==undefined?[Query.equal('date',date)]:[]),
       ...(categoryId!==undefined?[Query.equal('category_id',categoryId)]:[]),
       ...(completed!==undefined?[Query.equal('is_completed',completed)]:[]),
     ];
     return list('tasks',filters,100);
   },
   async createTask(input){
     const category=await tables.getRow({databaseId,tableId:'categories',rowId:input.categoryId});
     if(category.user_id!==owner||category.deleted!==false)
       throw Error('Category is missing or not owner-controlled');
     const rowId='mcp_'+createHash('sha256').update(owner+':'+input.idempotencyKey).digest('hex').slice(0,30);
     const now=new Date().toISOString();
     const data={user_id:owner,title:input.title,category_id:input.categoryId,
       date:input.date,is_completed:false,order:0,created_at:now,updated_at:now,
       deleted:false,visibility:'private',source:'mcp'};
     try {
       const result=await tables.createRow({
         databaseId,tableId:'tasks',rowId,data,
         permissions:[Permission.read(Role.user(owner)),
           Permission.update(Role.user(owner)),Permission.delete(Role.user(owner))]});
       if(result.user_id!==owner||result.$id!==rowId)throw Error('Invalid created owner');
       return {id:rowId,created:true,date:input.date,title:input.title,categoryId:input.categoryId};
     }catch(error) {
       if(error?.code!==409)throw error;
       const existing=await tables.getRow({databaseId,tableId:'tasks',rowId});
       if(existing.user_id!==owner||existing.deleted!==false||
          existing.title!==input.title||existing.category_id!==input.categoryId||
          existing.date!==input.date)throw Error('Idempotency key reused with different task');
       return {id:rowId,created:false,date:existing.date,
         title:existing.title,categoryId:existing.category_id};
     }
   }
 };
}
