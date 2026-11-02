import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'styles.css'), 'utf8');
const config = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
const mustHave = ['<html lang="en">', '<title>', 'name="description"', 'id="main"', 'id="features"', 'id="project"', 'id="development"', 'Skip to main content', 'role="img"', 'not an app screenshot'];
assert(html.includes('class="ui-month-grid"'), 'Missing calendar month illustration');
assert(html.includes('October 2026'), 'Missing calendar context');
assert(html.includes('fictional, nonpersonal tasks'), 'Preview must disclose sample data');
assert(!html.includes('@testy') && !html.includes('Bulk API probe'), 'Unexpected private screenshot content');
// The site's source-of-truth logo must remain byte-for-byte identical to Mosaic's shipped icon.
assert.equal(readFileSync(join(root,'favicon.svg'),'utf8'), readFileSync(join(root,'../life-tracker/public/favicon.svg'),'utf8'), 'Landing logo diverged from Mosaic logo');
for (const item of mustHave) assert(html.includes(item), 'Missing site contract: '+item);
const ids = new Set([...html.matchAll(/\bid="([a-zA-Z][a-zA-Z0-9_-]*)"/g)].map(x => x[1]));
assert.equal(ids.size, [...html.matchAll(/\bid="([a-zA-Z][a-zA-Z0-9_-]*)"/g)].length, 'Duplicate HTML IDs');
for (const [, target] of html.matchAll(/\bhref="#([^"]+)"/g)) assert(ids.has(target), 'Missing in-page target: '+target);
for (const [,path] of html.matchAll(/(?:href|src)="\/(.*?)"/g)) assert(path === 'demo/' || existsSync(join(root,path)), 'Missing local asset: '+path);
for (const [,url] of html.matchAll(/\bhref="(https?:[^"]+)"/g)) {
  const parsed = new URL(url);
  assert.equal(parsed.protocol, 'https:');
  assert(['mosaic-life-tracker.vercel.app','github.com'].includes(parsed.hostname), 'Unexpected external link');
}
assert(html.includes('<script src="/demo-loader.js" defer></script>'), "Missing first-party demo loader");
assert(!/<iframe\b|<form\b|<video\b|<audio\b/i.test(html), "Unexpected eager active content");
assert(!/analytics|posthog|gtag|google-analytics|segment\./i.test(html+css), 'Third-party tracking reference');
assert(css.includes('@media(max-width:490px)'), 'Missing small-screen layout');
assert(css.includes('prefers-reduced-motion:reduce'), 'Missing motion preferences');
assert.equal(config.framework, null, 'Standalone static site only');
assert(config.headers.some(x=>x.headers?.some(y=>y.key === 'Content-Security-Policy' && y.value.includes("connect-src 'none'"))), 'Missing no-network CSP');
assert(readFileSync(join(root,'favicon.svg'),'utf8').startsWith('<svg'), 'Missing original Mosaic SVG');
assert(readFileSync(join(root,'apple-touch-icon.png')).equals(readFileSync(join(root,'../life-tracker/public/apple-touch-icon.png'))), 'Landing PWA icon must equal the Mosaic app icon');
assert(html.includes('<link rel="icon" href="/apple-touch-icon.png" type="image/png">'), 'Browser must use the Mosaic PWA icon');
assert(html.includes('<link rel="apple-touch-icon" href="/apple-touch-icon.png">'), 'Apple icon must use the Mosaic PWA icon');
assert.equal([...html.matchAll(/<img src="\/apple-touch-icon\.png"/g)].length, 2, 'Header and footer must both use actual Mosaic app logo');
assert.equal([...html.matchAll(/<span>Mosaic<\/span>/g)].length, 2, 'Header and footer must both use Mosaic brand name');
console.log('MOSAIC_LANDING_STATIC_CONTRACT_PASS');
