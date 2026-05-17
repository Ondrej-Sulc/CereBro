export function getAppVersion(): string {
  return (
    process.env.APP_VERSION ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.RAILWAY_DEPLOYMENT_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.DEPLOYMENT_ID ||
    process.env.SOURCE_VERSION ||
    "dev"
  );
}
