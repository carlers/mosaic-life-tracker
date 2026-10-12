import { statSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { completePrecacheSizes } from './lib/complete-precache-sizes.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, 'dist');
const swPath = join(out, 'sw.js');
const input = await readFile(swPath, 'utf8');
const result = completePrecacheSizes(input, (url) => {
  if (/^(?:[a-z]+:)?\/\//i.test(url)) throw new Error('Precache URL must be same-origin: ' + url);
  const pathname = decodeURIComponent(url.split(/[?#]/, 1)[0]).replace(/^\/+/, '');
  const absolute = resolve(out, pathname);
  const local = relative(out, absolute);
  if (!pathname || !local || local.startsWith('..') || isAbsolute(local)) {
    throw new Error('Unsafe precache URL: ' + url);
  }
  return statSync(absolute).size;
});
if (result.patchedUrls.length) await writeFile(swPath, result.source);
console.log('Verified precache size metadata; completed ' +
  result.patchedUrls.length + ' additional asset weights.');
