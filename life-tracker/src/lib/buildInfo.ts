import { APP_VERSION } from './appVersion';

export type AppBuildChannel = 'Preview' | 'Production' | 'Local';

type EmbeddedBuildInfo = {
  commit: string | null;
  commitMessage: string | null;
  branch: string | null;
  builtAt: string | null;
  channel: AppBuildChannel;
};

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function parseEmbeddedBuildInfo(
  value: string | null | undefined
): EmbeddedBuildInfo | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;
    const channel =
      parsed.channel === 'Preview' ||
      parsed.channel === 'Production' ||
      parsed.channel === 'Local'
        ? parsed.channel
        : 'Local';
    return {
      commit: optionalString(parsed.commit),
      commitMessage: optionalString(parsed.commitMessage),
      branch: optionalString(parsed.branch),
      builtAt: optionalString(parsed.builtAt),
      channel,
    };
  } catch {
    return null;
  }
}

function readEmbeddedBuildInfo(): EmbeddedBuildInfo | null {
  if (typeof document === 'undefined') return null;
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[name="mosaic-build-info"]'
  );
  return parseEmbeddedBuildInfo(meta?.content);
}

const embedded = readEmbeddedBuildInfo();
const commit = embedded?.commit ?? null;

export const APP_BUILD_INFO = Object.freeze({
  version: APP_VERSION,
  buildId: commit ?? 'local',
  commit,
  commitShort: commit ? commit.slice(0, 8) : null,
  commitMessage: embedded?.commitMessage ?? null,
  branch: embedded?.branch ?? null,
  builtAt: embedded?.builtAt ?? null,
  channel: embedded?.channel ?? 'Local',
});
