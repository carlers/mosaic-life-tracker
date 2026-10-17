import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Runs ONLY in an ephemeral CI checkout. The analyzer emits static build
// metadata, with no credentials or user data; do not deploy the analyzed dist.
const path = resolve('vite.config.ts');
let config = readFileSync(path, 'utf8');
const imports = "import { defineConfig } from 'vite';";
const plugins = "    react(),";
if (config.split(imports).length !== 2 || config.split(plugins).length !== 2)
  throw new Error('Vite config structure changed; refusing to patch');
config = config.replace(imports,
  imports + "\nimport { bundleAnalyzerPlugin } from 'rolldown/experimental';");
config = config.replace(plugins,
  plugins + "\n    bundleAnalyzerPlugin({ format: 'md' }),");
writeFileSync(path, config);
console.log('Rolldown builtin experimental analyzer enabled only for disposable build.');
