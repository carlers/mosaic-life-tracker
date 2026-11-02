import { APP_VERSION } from './appVersion';
import { APP_BUILD_INFO } from './buildInfo';
import { sendAppAction } from './appAction';

export interface BugReportDraft {
  title: string;
  description: string;
  steps: string;
}
function browserFamily(ua: string): string {
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}
function osFamily(ua: string): string {
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Other';
}
export function newBugReportRequestId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
}
export function collectBugReportDiagnostics(): Record<string, string> {
  const ua = navigator.userAgent;
  return {
    version: APP_VERSION,
    build: APP_BUILD_INFO.commitShort ?? 'unknown',
    browser: browserFamily(ua),
    os: osFamily(ua),
    device: /Android|iPhone|iPad|iPod/.test(ua) ? 'mobile' : 'desktop',
    pwa: window.matchMedia?.('(display-mode: standalone)').matches ? 'standalone' : 'browser',
    screen: 'settings_about',
  };
}
export async function submitBugReport(
  draft: BugReportDraft,
  requestId: string,
  diagnostics: Record<string, string> | undefined,
): Promise<{ reportId: string; issueUrl: string }> {
  const result = await sendAppAction({
    action: 'publish_bug_report', requestId, publicConsent: true, ...draft,
    ...(diagnostics ? { diagnostics } : {}),
  });
  if (typeof result.reportId !== 'string' || !/^bug_[a-f0-9]{32}$/.test(result.reportId)) {
    throw new Error('Report confirmation unavailable');
  }
  if (typeof result.issueUrl !== 'string' ||
    !/^https:\/\/github\.com\/carlers\/mosaic-life-tracker\/issues\/[1-9]\d*$/.test(result.issueUrl)) {
    throw new Error('Public GitHub issue confirmation unavailable');
  }
  return { reportId: result.reportId, issueUrl: result.issueUrl };
}
