import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Experiment only: mutate this runner's disposable checkout after its exact
// baseline has been built and tested. Never commit an output of this script.
const path = resolve('index.html');
const source = readFileSync(path, 'utf8');
const needle = '</head>';
if (source.split(needle).length !== 2) {
  throw new Error('Unexpected index.html head; fail rather than modifying unknown HTML');
}
const preload = `
  <!-- EXPERIMENT #858 only: dispatch critical cached-Home imports from HTML,
       before the normal React/bootstrap entry has finished downloading. -->
  <script type="module">
    try {
      if (localStorage.getItem('mosaic_last_known_user') &&
          location.pathname !== '/login' &&
          location.pathname !== '/reset-password') {
        performance.mark('mosaic:head-preload-requested');
        void Promise.allSettled([
          import('/src/db/database.ts'),
          import('/src/components/layout/AppDataShell.tsx'),
          import('/src/pages/HomePage.tsx'),
        ]);
      }
    } catch {
      // A failed speculative import must never change account or DB authority.
    }
  </script>
`;
writeFileSync(path, source.replace(needle, preload + needle));
console.log('Experimental HTML critical-import kickoff inserted. Disposable CI runner only.');
