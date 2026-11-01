import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname,'../life-tracker');
const r = spawnSync('npm',['run','build:demo'],{cwd:root,stdio:'inherit'});
if(r.status!==0)process.exit(r.status||1);
