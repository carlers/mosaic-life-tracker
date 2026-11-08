export const OWNER = 'carlers';
export const PROJECT = Number(process.env.MCP_PROJECT_NUMBER || '1');
export const READ_SCOPE = 'projects.read';
export const WRITE_SCOPE = 'projects.write';
export const SCOPES = [READ_SCOPE, WRITE_SCOPE];
const https = value => {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw Error('Invalid HTTPS URL');
  return url;
};
export function config(env = process.env) {
  if (!Number.isSafeInteger(PROJECT) || PROJECT < 1 || PROJECT > 100 ||\n      env.MCP_ENABLED !== 'true' || env.VERCEL_ENV !== 'preview') throw Error('Admin MCP disabled outside dedicated Preview');
  const origin = https(env.MCP_PUBLIC_ORIGIN || '');
  if (origin.pathname !== '/' || origin.toString() !== origin.origin + '/') throw Error('Invalid MCP origin');
  const resource = origin.origin + '/api/mcp';
  const key = Buffer.from(env.MCP_ENCRYPTION_KEY || '', 'base64url');
  if (key.length !== 32 || !/^[A-Za-z0-9_-]{43}$/.test(env.MCP_ENCRYPTION_KEY || '')) throw Error('Missing MCP encryption key');
  const clientId = env.GITHUB_OAUTH_CLIENT_ID || '';
  const clientSecret = env.GITHUB_OAUTH_CLIENT_SECRET || '';
  if (!/^[a-zA-Z0-9_]{6,128}$/.test(clientId) || clientSecret.length < 20) throw Error('GitHub OAuth not configured');
  const redirect = https(env.MCP_ALLOWED_CLIENT_REDIRECT || '');
  if (!['chatgpt.com','chat.openai.com'].includes(redirect.hostname) ||
      redirect.pathname !== '/connector_platform_oauth_redirect' ||
      redirect.search || redirect.hash) throw Error('Unexpected OAuth client redirect');
  return {origin:origin.origin,resource,secret:env.MCP_ENCRYPTION_KEY,
    clientId,clientSecret,clientRedirect:redirect.toString()};
}
