import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Diagnostic-only mutation inside a disposable GitHub Actions checkout.
// Makes the immediate Home-neighbor route preload a no-op; on other routes,
// preloads remain unchanged. Real route navigation/swipe is untouched.
const path = resolve('src/components/layout/AppLayout.tsx');
let source = readFileSync(path, 'utf8');
const target = `  useEffect(() => {
    if (!user?.$id) return;

    const destinations = [leftSwipeDestination, rightSwipeDestination].filter(Boolean);`;
const replacement = `  useEffect(() => {
    if (!user?.$id || path === '/home') return;

    const destinations = [leftSwipeDestination, rightSwipeDestination].filter(Boolean);`;
if (source.split(target).length !== 2) throw new Error('Unexpected AppLayout preload effect');
source = source.replace(target, replacement);
const deps = `  }, [leftSwipeDestination, messagesIsAdjacent, rightSwipeDestination, user?.$id]);`;
if (source.split(deps).length !== 2) throw new Error('Unexpected preload effect dependency array');
source = source.replace(deps,
  `  }, [leftSwipeDestination, messagesIsAdjacent, path, rightSwipeDestination, user?.$id]);`);
writeFileSync(path, source);
console.log('Experiment-only: Home neighbor preloads suppressed; swipe and other routes unchanged.');
