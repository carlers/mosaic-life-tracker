export const EMAIL_PREVIEW = 'https://mosaic-supabase-core-preview.vercel.app';
export const EMAIL_ROUTES = [EMAIL_PREVIEW + '/auth/confirm', EMAIL_PREVIEW + '/reset-password'];
export const EMAIL_TEMPLATES = {
  mailer_templates_confirmation_content:
    `<h2>Confirm your Mosaic email</h2><p><a href="${EMAIL_ROUTES[0]}#token_hash={{ .TokenHash }}&amp;type=signup">Confirm email</a></p>`,
  mailer_templates_recovery_content:
    `<h2>Reset your Mosaic password</h2><p><a href="${EMAIL_ROUTES[1]}#token_hash={{ .TokenHash }}&amp;type=recovery">Choose a new password</a></p>`,
};

export function previewEmailPolicy(current) {
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
    emailRateLimit: current.rate_limit_email_sent ?? null,
  };
}
