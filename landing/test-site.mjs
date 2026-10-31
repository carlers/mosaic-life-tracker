import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'styles.css'), 'utf8');
const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
const mustHave = ['<html lang="en">', '<title>', 'name="description"', 'id="main"', 'id="features"', 'id="project"', 'id="development"', 'Skip to main content', 'role="img"', 'not an app screenshot'];
for (const item of mustHave) assert(html.includes(item), 'Missing site contract: '+item);
const ids = new Set([...html.matchAll(/\bid="([a-zA-Z][a-zA-Z0-9_-]*)"/g)].map(x => x[1]));
assert.equal(ids.size, [...html.matchAll(/\bid="([a-zA-Z][a-zA-Z0-9_-]*)"/g)].length, 'Duplicate HTML IDs');
for (const [, target] of html.matchAll(/\bhref="#([^"]+)"/g)) assert(ids.has(target), 'Missing in-page target: '+target);
for (const [,path] of html.matchAll(/(?:href|src)="\/(.*?)"/g)) assert(existsSync(join(root,path)), 'Missing local asset: '+path);
for (const [,url] of html.matchAll(/\bhref="(https?:[^"]+)"/g)) {
  const parsed = new URL(url);
  assert.equal(parsed.protocol, 'https:');
  assert(['mosaic-life-tracker.vercel.app','github.com'].includes(parsed.hostname), 'Unexpected external link');
}
assert(!/<script\b/i.test(html), 'Unexpected browser script');
assert(!/\b(?:<form|<iframe|<video|<audio)\b/i.test(html), 'Unexpected active content');
assert(!/analytics|posthog|gtag|google-analytics|segment\./i.test(html+css), 'Third-party tracking reference');
assert(css.includes('@media(max-width:490px)'), 'Missing small-screen layout');
assert(css.includes('prefers-reduced-motion:reduce'), 'Missing motion preferences');
assert.equal(config.framework, null, 'Standalone static site only');
assert(config.headers.some(x=>x.headers?.some(y=>y.key === 'Content-Security-Policy' && y.value.includes("connect-src 'none'"))), 'Missing no-network CSP');
assert(readFileSync(join(root,'favicon.svg'),'utf8').startsWith('<svg'), 'Missing original Mosaic SVG');
console.log('MOSAIC_LANDING_STATIC_CONTRACT_PASS');
