export default {
  // Fully parallel mode lets Playwright distribute individual tests evenly between
  // CI shards instead of being constrained by the large interaction-contract file.
  fullyParallel: true,
  // Each browser shard gets its own GitHub runner; keep one worker per runner for
  // deterministic CPU/memory use and let CI-level sharding provide the parallelism.
  workers: process.env.CI ? 1 : undefined,
};
