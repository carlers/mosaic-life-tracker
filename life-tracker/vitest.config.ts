import { defineConfig } from 'vitest/config';
import { TEST_PROJECTS, toVitestProject } from './scripts/lib/test-projects.mjs';

export default defineConfig({
  test: {
    // Large reported CPU counts in containers can create more workers than the
    // available quota can run efficiently. Four was the fastest conservative
    // cap in the 2026-09-20 local/cloud benchmark (see docs/TEST_WORKFLOW.md).
    maxWorkers: 4,
    projects: TEST_PROJECTS.map(toVitestProject),
  },
});
