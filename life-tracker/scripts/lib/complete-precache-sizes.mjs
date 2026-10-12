import { parse } from 'acorn';

// Workbox includes additionalManifestEntries after glob transforms. Add verified
// emitted sizes to those entries in the *finished* SW, not by another fetch.
function property(entry, key) {
  return entry.properties.find((item) =>
    item.type === 'Property' &&
    (item.key.name ?? item.key.value) === key
  )?.value;
}

function staticString(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map((part) => part.value.cooked).join('');
  }
  return null;
}

export function completePrecacheSizes(source, measureByUrl) {
  if (!source.includes('__MOSAIC_ASSETS__')) throw new Error('Missing Mosaic precache manifest');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const arrays = [];
  function walk(node) {
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
    if (node.type === 'ArrayExpression' && node.elements.length &&
        node.elements.every((entry) => entry?.type === 'ObjectExpression' &&
          staticString(property(entry, 'url')) !== null)) arrays.push(node);
    for (const [key, value] of Object.entries(node)) {
      if (['start', 'end', 'loc'].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(walk);
      else walk(value);
    }
  }
  walk(ast);
  arrays.sort((a, b) => b.elements.length - a.elements.length);
  const manifest = arrays[0];
  if (!manifest || (arrays[1] && arrays[1].elements.length === manifest.elements.length)) {
    throw new Error('Ambiguous injected precache manifest');
  }
  const urls = manifest.elements.map((entry) => staticString(property(entry, 'url')));
  if (!urls.includes('index.html') || new Set(urls).size !== urls.length) {
    throw new Error('Injected precache must contain a unique app shell');
  }
  const edits = [];
  const patchedUrls = [];
  for (const [i, entry] of manifest.elements.entries()) {
    const url = urls[i];
    const size = measureByUrl(url);
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error('Invalid emitted asset size for ' + url);
    }
    const value = property(entry, 'mosaicBytes');
    if (value === undefined) {
      edits.push({ start: entry.end - 1, end: entry.end - 1,
        text: (entry.properties.length ? ',' : '') + 'mosaicBytes:' + size });
      patchedUrls.push(url);
    } else if (value.type === 'Literal' && value.value === null) {
      edits.push({ start: value.start, end: value.end, text: String(size) });
      patchedUrls.push(url);
    } else if (value.type !== 'Literal' || value.value !== size) {
      throw new Error('Manifest size does not match emitted file: ' + url);
    }
  }
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  }
  return { source, patchedUrls };
}
