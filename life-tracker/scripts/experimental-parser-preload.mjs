import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Synthetic cold-start experiment. Modifies already-built dist/index.html ONLY
// inside a disposable CI checkout. This cannot be shipped as-is because the
// PWA precache was generated before the mutation.
const dist = 'dist';
const manifest = JSON.parse(readFileSync(join(dist, '.vite/manifest.json'), 'utf8'));
const find = path => {
  const item = Object.values(manifest).find(m => m.src === path);
  if (!item) throw new Error('Manifest missing ' + path);
  if (!item.file?.endsWith('.js')) throw new Error('Not JS ' + path);
  return item.file;
};
const db = find('src/db/database.ts');
const shell = find('src/components/layout/AppDataShell.tsx');
const home = find('src/pages/HomePage.tsx');
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
