// Immutable v0.32.4 deployment; the old protected alias still points to an earlier build.
// Only advance this exact origin after new signed/hosted acceptance and operator review.
export const EMAIL_PREVIEW = 'https://mosaic-life-tracker-6luuatyml-carls-projects-72516fde.vercel.app';
export const EMAIL_PREVIEW_SHA = '70d7485b06c0004769f03b0ad96189669777f05a';
export const EMAIL_ROUTES = [EMAIL_PREVIEW + '/auth/confirm', EMAIL_PREVIEW + '/reset-password'];
export const EMAIL_TEMPLATES = {
  mailer_templates_confirmation_content:
    `<h2>Confirm your Mosaic email</h2><p>Your one-time code: <strong>{{ .Token }}</strong></p><p><a href="${EMAIL_ROUTES[0]}">Enter code in Mosaic</a></p>`,
  mailer_templates_recovery_content:
    `<h2>Reset your Mosaic password</h2><p>Your one-time code: <strong>{{ .Token }}</strong></p><p><a href="${EMAIL_ROUTES[1]}">Enter code in Mosaic</a></p>`,
};

/**
 * Fail closed before any hosted policy write: Vercel's SSO redirect can retain
 * fragments, so a template URL must never contain a credential or hash.
 */
export function assertCredentialFreeEmailTemplates(templates = EMAIL_TEMPLATES) {
  const values = [templates.mailer_templates_confirmation_content,
    templates.mailer_templates_recovery_content];
  values.forEach((html, index) => {
    if (typeof html !== 'string' || !html.includes('{{ .Token }}') ||
        /TokenHash|token_hash|access_token|refresh_token/i.test(html))
      throw Error('Preview email template must use a code, never a link token');
    const links = [...html.matchAll(/href="([^"]+)"/g)].map(match => new URL(match[1]));
    if (links.length !== 1 || links[0].href !== EMAIL_ROUTES[index])
      throw Error('Preview email links must be credential-free exact routes');
  });
  return true;
}

export function previewEmailPolicy(current) {
  assertCredentialFreeEmailTemplates();
  if (!['http://localhost:3000', EMAIL_PREVIEW].includes(current.site_url) ||
      typeof current.uri_allow_list !== 'string' || current.mailer_autoconfirm !== false)
    throw Error('Unexpected isolated Auth policy; inspect before changing email configuration');
  const redirects = current.uri_allow_list.split(',').map(value => value.trim()).filter(Boolean);
  return { site_url: EMAIL_PREVIEW,
    uri_allow_list: [...new Set([...redirects, ...EMAIL_ROUTES])].join(','),
    ...EMAIL_TEMPLATES };
}

export function inspectEmailPolicy(current) {
  return {
    confirmationRequired: current.mailer_autoconfirm === false,
    siteReady: current.site_url === EMAIL_PREVIEW,
    redirectsReady: typeof current.uri_allow_list === 'string' &&
      EMAIL_ROUTES.every(route => current.uri_allow_list.split(',').map(value => value.trim()).includes(route)),
    templatesReady: Object.entries(EMAIL_TEMPLATES).every(([key, value]) => current[key] === value),
    customSmtpConfigured: Boolean(current.smtp_host),
    brevoRelayConfigured: current.smtp_host === 'smtp-relay.brevo.com',
    smtpSenderConfigured: Boolean(current.smtp_admin_email),
    emailRateLimit: current.rate_limit_email_sent ?? null,
  };
}

/** Fail closed before hosted fixtures: only the verified immutable build and a
 * temporary share URL with no credential-bearing callback parameters are valid. */
export function requireDeployedPreviewAccess(preview, shareUrl) {
  if (preview?.origin !== EMAIL_PREVIEW || preview.sha !== EMAIL_PREVIEW_SHA)
    throw Error('Hosted Preview requires the reviewed immutable origin and exact deployed SHA');
  let url;
  try { url = new URL(shareUrl); } catch { throw Error('Hosted Preview requires a scoped temporary share URL'); }
  const token = url.searchParams.get('_vercel_share');
  if (typeof shareUrl !== 'string' || shareUrl.length > 2048 || url.origin !== EMAIL_PREVIEW ||
      url.pathname !== '/' || url.hash || url.searchParams.size !== 1 ||
      !/^[a-zA-Z0-9_-]{16,}$/.test(token ?? ''))
    throw Error('Hosted Preview requires a scoped temporary share URL');
  return shareUrl;
}
