import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// DIAGNOSTIC ONLY: mutate the Vite/Rolldown build config after collecting
// baseline metrics, never on a deployed branch. The entries-aware rule groups
// shared UI modules by route usage rather than bundling all lazy routes eagerly.
const path = resolve('vite.config.ts');
let source = readFileSync(path, 'utf8');
const needle = `  build: {
    // Vite 8.1+ can route chunk-to-chunk imports through an import map`;
const replacement = `  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{
            name: 'mosaic-shared-ui',
            test: /[\\/]src[\\/](?:components|hooks|lib)[\\/]/,
            entriesAware: true,
            includeDependenciesRecursively: false,
            minShareCount: 2,
            minSize: 2000,
            maxSize: 96000,
          }],
        },
      },
    },
    // Vite 8.1+ can route chunk-to-chunk imports through an import map`;
if (source.split(needle).length !== 2) throw new Error('Build config structure changed');
writeFileSync(path, source.replace(needle, replacement));
console.log('Experimental Rolldown entries-aware grouping enabled in disposable runner.');
