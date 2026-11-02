// Public landing production deployments must use Mosaic's released app tree.
if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_GIT_COMMIT_REF !== 'main') {
  console.error('MOSAIC_LANDING_PRODUCTION_MAIN_REQUIRED');
  process.exit(1);
}
console.log('MOSAIC_LANDING_SOURCE_BRANCH_PASS');
