import { parse } from 'acorn';

// Static inspection of the bundled injectManifest worker. Inspect emitted code,
// not source assumptions: protect the existing offline/push/update policy.
export function inspectInjectedWorker(source) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
  const manifestCandidates = [];
  const importedScripts = [];
  const waits = [];
  const claims = [];
  let fallback = null;
  let denylist = null;
  const stringBindings = new Map();
  const boundUrlArgs = [];

  function propName(node) {
    if (!node) return '';
    if (node.type === 'Identifier') return node.name;
    return typeof node.value === 'string' ? node.value : '';
  }

  function objectValue(node, name) {
    return node.properties.find((prop) =>
      prop.type === 'Property' && propName(prop.key) === name
    )?.value;
  }

  function walk(node, ancestors = []) {
    if (!node || typeof node !== 'object' || typeof node.type !== 'string') return;
    const path = [...ancestors, node];
    if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init?.type === 'Literal' && typeof node.init.value === 'string') {
      stringBindings.set(node.id.name, node.init.value);
    }
    if (node.type === 'ArrayExpression' && node.elements.length > 0 &&
        node.elements.every((entry) => entry?.type === 'ObjectExpression' &&
          objectValue(entry, 'url')?.type === 'Literal' &&
          typeof objectValue(entry, 'url').value === 'string')) {
      manifestCandidates.push(node.elements.map((entry) => ({
        url: objectValue(entry, 'url').value,
        bytes: objectValue(entry, 'mosaicBytes')?.value ?? null,
      })));
    }
    if (node.type === 'CallExpression') {
      const method = propName(node.callee?.property) ||
        (node.callee?.type === 'Identifier' ? node.callee.name : '');
      if (method === 'importScripts') {
        importedScripts.push(...node.arguments.map((arg) => arg.value));
      }
      if (method === 'skipWaiting') waits.push(path);
      if (method === 'claim' && propName(node.callee?.object?.property) === 'clients') {
        claims.push(path);
      }
      if (method === 'createHandlerBoundToURL') {
        boundUrlArgs.push(node.arguments[0]);
        if (typeof node.arguments[0]?.value === 'string') fallback = node.arguments[0].value;
      }
    }
    if (node.type === 'Property' && propName(node.key) === 'denylist' &&
        node.value?.type === 'ArrayExpression') {
      denylist = node.value.elements.map((item) => item.regex?.pattern);
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'start' || key === 'end' || key === 'loc') continue;
      if (Array.isArray(value)) value.forEach((child) => walk(child, path));
      else walk(value, path);
    }
  }
  walk(ast);

  if (!source.includes('__MOSAIC_ASSETS__')) {
    throw new Error('Missing injected Mosaic precache progress manifest.');
  }
  if (!fallback) {
    fallback = boundUrlArgs.filter((arg) => arg?.type === 'Identifier')
      .map((arg) => stringBindings.get(arg.name))
      .find((url) => url === 'index.html') ?? null;
  }
  const precacheEntries = manifestCandidates.sort((a, b) => b.length - a.length)[0];
  const precacheUrls = precacheEntries?.map((entry) => entry.url);
  const precacheSizes = precacheEntries?.map((entry) => entry.bytes);
  if (!precacheUrls?.length || !fallback || !denylist) {
    throw new Error('Missing injected precache, fallback, or navigation denylist. ' +
      JSON.stringify({ manifestArrayCount: manifestCandidates.length,
        longestManifest: precacheEntries?.length ?? 0,
        fallback, denylist,
        boundUrlArgs: boundUrlArgs.map((arg) => ({ type: arg?.type, value: arg?.name ?? arg?.value })),
        routeCalls: [...source.matchAll(/createHandlerBoundToURL/g)].length,
        indexHtmlReferences: [...source.matchAll(/index\\.html/g)].length,
        denylistReferences: [...source.matchAll(/denylist/g)].length,
      }));
  }
  let skipWaitingOnStartup = false;
  let skipWaitingOnLifecycle = false;
  let skipWaitingOnUnrelatedMessage = false;
  let skipWaitingOnRequest = false;
  for (const path of waits) {
    const event = path.filter((parent) =>
      parent.type === 'CallExpression' &&
      propName(parent.callee?.property) === 'addEventListener'
    ).map((parent) => parent.arguments[0]?.value).at(-1);
    const guarded = path.some((parent) =>
      (parent.type === 'IfStatement' || parent.type === 'ConditionalExpression' ||
       parent.type === 'LogicalExpression') && source.slice(
        (parent.test ?? parent.left).start, (parent.test ?? parent.left).end
      ).includes('SKIP_WAITING')
    );
    if (event === 'install' || event === 'activate') skipWaitingOnLifecycle = true;
    else if (event === 'message' && guarded) skipWaitingOnRequest = true;
    else if (event === 'message') skipWaitingOnUnrelatedMessage = true;
    else skipWaitingOnStartup = true;
  }
  if (!skipWaitingOnRequest) {
    throw new Error('Update confirmation message handler is missing.');
  }
  return {
    skipWaitingOnStartup,
    skipWaitingOnLifecycle,
    skipWaitingOnUnrelatedMessage,
    skipWaitingOnRequest,
    clientsClaim: claims.length > 0,
    precacheUrls,
    precacheSizes,
    navigationFallback: fallback,
    navigationDenylist: denylist,
    importedScripts,
  };
}
