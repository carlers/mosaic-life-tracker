import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: 'demo',
  publicDir: false,
  base: '/demo/',
  plugins: [
    {
      name: 'demo-local-image-only',
      enforce: 'pre' as const,
      resolveId(id: string) {
        if (id.endsWith('/hooks/useTaskImage')) {
          return fileURLToPath(new URL('./src/demo/noImage.ts', import.meta.url));
        }
        return null;
      },
    },
    react(),
  ],
  build: {
    outDir: '../../landing/demo',
    emptyOutDir: true,
    sourcemap: false,
  },
});
