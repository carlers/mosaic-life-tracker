import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {PINNED,tenant,READ_SCOPE} from '../server/config.js';

// Static RFC 9728 discovery must match the *deployment's* tenant.
// No key is needed at build time; runtime activation stays separately gated.
export function metadataForBuild(env=process.env) {
 let selected;
 if(!env.MOSAIC_MCP_ENV && !env.VERCEL_ENV)selected=PINNED.scratch;
 else selected=tenant(env);
 return {
   resource:selected.resource,
   authorization_servers:[selected.issuer],
   scopes_supported:[READ_SCOPE],
   bearer_methods_supported:['header']
 };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const destination=fileURLToPath(new URL('../dist/.well-known/oauth-protected-resource',import.meta.url));
 await mkdir(dirname(destination),{recursive:true});
 await writeFile(destination,JSON.stringify(metadataForBuild(),null,2)+'\n',{mode:0o644});
 process.stdout.write('MCP resource metadata matched deployment tenant.\n');
}
