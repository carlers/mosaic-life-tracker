import { APP_VERSION } from './appVersion';

export type AppBuildChannel = 'Preview' | 'Production' | 'Local';

const commit = import.meta.env.VITE_APP_BUILD_COMMIT?.trim() || null;
const commitMessage = import.meta.env.VITE_APP_BUILD_MESSAGE?.trim() || null;
const builtAt = import.meta.env.VITE_APP_BUILD_TIME?.trim() || null;
const channel = import.meta.env.VITE_APP_BUILD_CHANNEL;
const branch = import.meta.env.VITE_APP_BUILD_BRANCH?.trim() || 'local';

export const APP_BUILD_INFO = Object.freeze({
  version: APP_VERSION,
  buildId: commit ?? 'local',
  commit,
  commitShort: commit ? commit.slice(0, 8) : null,
  commitMessage,
  builtAt,
  branch,
  channel:
    channel === 'Preview' || channel === 'Production' || channel === 'Local'
      ? (channel as AppBuildChannel)
      : 'Local',
});
