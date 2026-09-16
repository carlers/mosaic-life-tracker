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
    ],
  },
});
