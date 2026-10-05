import { APP_VERSION } from './appVersion';

export type AppBuildChannel = 'Preview' | 'Production' | 'Local';

type EmbeddedBuildInfo = {
  commit: string | null;
  commitMessage: string | null;
  branch: string | null;
  builtAt: string | null;
  channel: AppBuildChannel;
};

export function parseEmbeddedBuildInfo(
  value: string | null | undefined
): EmbeddedBuildInfo | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as EmbeddedBuildInfo | null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

const embedded =
  typeof document === 'undefined'
    ? null
    : parseEmbeddedBuildInfo(
        document.querySelector<HTMLMetaElement>(
          'meta[name="mosaic-build-info"]'
        )?.content
      );
const commit = embedded?.commit || null;

export const APP_BUILD_INFO = Object.freeze({
  version: APP_VERSION,
  buildId: commit ?? 'local',
  commit,
  commitShort: commit ? commit.slice(0, 8) : null,
  commitMessage: embedded?.commitMessage || null,
  branch: embedded?.branch || null,
  builtAt: embedded?.builtAt || null,
  channel: embedded?.channel || 'Local',
});
