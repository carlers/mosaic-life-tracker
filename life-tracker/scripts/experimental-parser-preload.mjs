import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Synthetic cold-start experiment. Modifies already-built dist/index.html ONLY
// inside a disposable CI checkout. This cannot be shipped as-is because the
// PWA precache was generated before the mutation.
const dist = 'dist';
// Vite 8's chunk-import-map manifest need not expose a source's original
// path as a key. Resolve from the *emitted* exact basename with a uniqueness
// assertion; fail if bundle identity becomes ambiguous.
const assets = readdirSync(join(dist, 'assets'));
const find = prefix => {
  const matching = assets.filter(name =>
    name.startsWith(prefix + '-') && name.endsWith('.js'));
  if (matching.length !== 1) {
    throw new Error('Expected one ' + prefix + ' entry chunk; found ' +
      JSON.stringify(matching));
  }
  return 'assets/' + matching[0];
};
const db = find('database');
const shell = find('AppDataShell');
const home = find('HomePage');
const path = join(dist, 'index.html');
const html = readFileSync(path, 'utf8');
const marker = '<head>';
if (html.split(marker).length !== 2) throw new Error('Unexpected production HTML');
const inline = `
<script>
(function () {
  try {
    if (!localStorage.getItem('mosaic_last_known_user') ||
        location.pathname !== '/home') return;
    var mode = new URLSearchParams(location.search).get('preload');
    var files = {
      db: [${JSON.stringify(db)}],
      shell: [${JSON.stringify(shell)}],
      home: [${JSON.stringify(home)}],
      all: ${JSON.stringify([db,shell,home])},
    }[mode] || [];
    if (files.length) performance.mark('mosaic:parser-preload-requested');
    for (var i = 0; i < files.length; i++) {
      var link = document.createElement('link');
      link.rel = 'modulepreload';
      link.href = '/' + files[i];
      document.head.append(link);
    }
  } catch (e) {
    // Speculation may fail but can never affect local data authority.
  }
})();
</script>
`;
writeFileSync(path, html.replace(marker, marker + inline));
console.log('MOSAIC_PARSER_PRELOAD_TARGETS ' + JSON.stringify({ db, shell, home }));
console.log('Injected disposable classic-script modulepreload; no source or SW change.');
