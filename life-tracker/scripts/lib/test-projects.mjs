export const TEST_PROJECTS = [
  {
    name: 'unit',
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
  {
    name: 'handlers',
    environment: 'node',
    include: ['tests/handlers/**/*.test.ts'],
  },
  {
    name: 'dom',
    environment: 'happy-dom',
    include: [
      'tests/react/**/*.test.tsx',
      'tests/components/**/*.test.tsx',
      'tests/hooks/**/*.test.tsx',
    ],
    setupFiles: ['./tests/setup/react.ts'],
    env: { NODE_ENV: 'test' },
  },
];

export function toVitestProject(project) {
  return {
    test: {
      globals: true,
      ...project,
    },
  };
}
