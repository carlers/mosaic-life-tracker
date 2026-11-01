import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root = resolve(import.meta.dirname);
const app = join(root,'demo');
assert(existsSync(join(app,'index.html')), 'Demo bundle was not staged');
const index = readFileSync(join(app,'index.html'),'utf8');
assert(index.includes('/demo/assets/'), 'Demo assets must be under /demo/');
const scripts = readdirSync(join(app,'assets')).filter(x=>x.endsWith('.js'));
assert(scripts.length>0,'Demo JavaScript is missing');
const source=scripts.map(x=>readFileSync(join(app,'assets',x),'utf8')).join('\n');
for(const forbidden of ['appwrite','posthog','sgp.cloud.appwrite.io','/v1/account','/v1/databases','navigator.serviceWorker.register','life_tracker_db']){
  assert(!source.toLowerCase().includes(forbidden.toLowerCase()),'Remote service or real app DB leaked into demo: '+forbidden);
}
const config=JSON.parse(readFileSync(join(root,'vercel.json'),'utf8'));
const demoHeaders=config.headers.find(h=>h.source==='/demo/(.*)')?.headers||[];
assert(demoHeaders.some(h=>h.key==='Content-Security-Policy'&&h.value.includes("connect-src 'none'")&&h.value.includes("frame-ancestors 'self'")), 'Missing demo isolation CSP');
console.log('MOSAIC_DEMO_STATIC_CONTRACT_PASS');
