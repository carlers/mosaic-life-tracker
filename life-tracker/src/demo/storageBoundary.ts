/**
 * Demo-only localStorage namespace. Preserves all unrelated keys on the
 * landing origin even when shared production preference code uses old names.
 * The authenticated PWA build never imports this module.
 */
const PREFIX='mosaic_public_demo_v1:';
let installed=false;
export function installDemoStorageBoundary(){
 if(installed)return;
 installed=true;
 const storage=window.localStorage;
 const nativeGet=Storage.prototype.getItem;
 const nativeSet=Storage.prototype.setItem;
 const nativeRemove=Storage.prototype.removeItem;
 const nativeKey=Storage.prototype.key;
 const nativeClear=Storage.prototype.clear;
 const scoped=(self:Storage,key:string)=>self===storage?PREFIX+key:key;
 Storage.prototype.getItem=function(key:string){return nativeGet.call(this,scoped(this,key));};
 Storage.prototype.setItem=function(key:string,value:string){nativeSet.call(this,scoped(this,key),value);};
 Storage.prototype.removeItem=function(key:string){nativeRemove.call(this,scoped(this,key));};
 Storage.prototype.key=function(index:number){
  if(this!==storage)return nativeKey.call(this,index);
  let count=0;
  for(let i=0;i<this.length;i++){const k=nativeKey.call(this,i);if(k?.startsWith(PREFIX)){if(count++===index)return k.slice(PREFIX.length);}}
  return null;
 };
 Storage.prototype.clear=function(){
  if(this!==storage)return nativeClear.call(this);
  const keys:string[]=[];
  for(let i=0;i<this.length;i++){const k=nativeKey.call(this,i);if(k?.startsWith(PREFIX))keys.push(k);}
  for(const key of keys)nativeRemove.call(this,key);
 };
}
