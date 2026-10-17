import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Diagnostic-only source rewrite on the GitHub Actions runner. Never deploy.
const file = resolve('src/components/layout/AppLayout.tsx');
const source = readFileSync(file, 'utf8');
function replaceOnce(current, before, after) {
  if (current.split(before).length !== 2) {
    throw new Error('Unexpected baseline AppLayout source during Home preload A/B');
  }
  return current.replace(before, () => after);
}
let candidate = replaceOnce(
  source,
  '    if (destinations.length === 0) return;',
  "    if (destinations.length === 0 || path === '/home') return;"
);
candidate = replaceOnce(
  candidate,
  '  }, [leftSwipeDestination, messagesIsAdjacent, rightSwipeDestination, user?.$id]);',
  '  }, [leftSwipeDestination, messagesIsAdjacent, path, rightSwipeDestination, user?.$id]);'
);
writeFileSync(file, candidate);
console.log('Applied disposable no-Home-adjacent-Explore prefetch candidate.');
