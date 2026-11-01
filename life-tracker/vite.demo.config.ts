import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const source=(name:string)=>fileURLToPath(new URL('./src/'+name,import.meta.url));
const replacements:Record<string,string>={
 'db/database':source('demo/runtimeDatabase.ts'),
 'hooks/AuthProvider':source('demo/DemoAuthProvider.tsx'),
 'hooks/useTaskImage':source('demo/noImage.ts'),
 'hooks/useConnectivity':source('demo/useDemoConnectivity.ts'),
 'hooks/useMyProfile':source('demo/useDemoProfile.ts'),
 'lib/posthog':source('demo/noTelemetry.ts'),
};
export default defineConfig({
 root:'demo',publicDir:false,base:'/demo/',
 plugins:[{
  name:'mosaic-demo-runtime',enforce:'pre' as const,
  resolveId(id:string,importer?:string){
   if(id==='appwrite')return source('demo/noRemoteSdk.ts');
   const lookup=id.startsWith('.') && importer ? resolve(dirname(importer),id) : id;
   for(const [suffix,path] of Object.entries(replacements))if(lookup.endsWith('/'+suffix))return path;
   return null;
  },
  generateBundle(_opts,bundle){
   const forbidden=['/node_modules/appwrite/','/src/main.tsx','/src/demo/DemoApp.tsx','/src/lib/posthog.ts','/src/db/database.ts'];
   const modules=Object.values(bundle).flatMap(entry=>entry.type==='chunk'?Object.keys(entry.modules):[]);
   for(const path of forbidden) if(modules.some(id=>id.includes(path)))throw new Error('Demo runtime imports forbidden source: '+path);
  },
 },react()],
 build:{outDir:'../../landing/demo',emptyOutDir:true,sourcemap:false},
});
