/**
 * Compiled into the public demo instead of the Appwrite SDK.
 * Any accidental cloud invocation fails locally rather than contacting a server.
 */
const blocked=()=>Promise.reject(new Error('Unavailable in this fictional offline demo'));
const guard=(target:object)=>new Proxy(target,{
 get(t,key,receiver){if(key in t)return Reflect.get(t,key,receiver);return blocked;}
});
export class Client {
 setEndpoint(){return this;}
 setProject(){return this;}
 setSession(){return this;}
}
export class Account { constructor(_client?:unknown){void _client;return guard(this);} }
export class TablesDB { constructor(_client?:unknown){void _client;return guard(this);} }
export class Storage { constructor(_client?:unknown){void _client;return guard(this);} }
export class Functions { constructor(_client?:unknown){void _client;return guard(this);} }
const query=new Proxy({} as Record<string,unknown>,{get:()=>()=>''});
export const Query=query;
export const Role=query;
export const Permission=query;
export const ExecutionMethod={GET:'GET',POST:'POST',PUT:'PUT',PATCH:'PATCH',DELETE:'DELETE'};
export const ID={unique:()=>('demo_'+Math.random().toString(36).slice(2))};
