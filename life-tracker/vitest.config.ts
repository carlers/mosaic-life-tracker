import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          globals: true,
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'handlers',
          environment: 'node',
          globals: true,
          include: ['tests/handlers/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'react',
          environment: 'happy-dom',
          globals: true,
          include: ['tests/react/**/*.test.tsx'],
          setupFiles: ['./tests/setup/react.ts'],
          env: { NODE_ENV: 'test' },
        },
      },
    ],
  },
});
