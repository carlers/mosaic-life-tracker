// Authenticated real PG17 TOC gate before the ten-table disposable restore.
// Checks the SAME encrypted source independently using the R2 publication logic.
import {assertProfileToc,SEVEN,EIGHT_SETTINGS,TEN_BUCKET_LINKS}
  from '../recovery-profile.mjs';
const buffers=[];
for await(const chunk of process.stdin)buffers.push(Buffer.from(chunk));
const raw=Buffer.concat(buffers).toString('utf8');
const begin=raw.indexOf('{'),end=raw.lastIndexOf('}');
if(begin<0||end<begin||raw.length>16*1024)
 throw Error('Invalid authenticated ten-table archive report');
const toc=JSON.parse(raw.slice(begin,end+1));
assertProfileToc(toc,TEN_BUCKET_LINKS);
for(const older of [SEVEN,EIGHT_SETTINGS]){
 let rejected=false;
 try{assertProfileToc(toc,older);}catch{rejected=true;}
 if(!rejected)throw Error('Ten-table backup accepted under obsolete profile '+older);
}
console.log('MOSAIC_BUCKET_TEN_TABLE_R2_PROFILE_MATCH_PASS');
