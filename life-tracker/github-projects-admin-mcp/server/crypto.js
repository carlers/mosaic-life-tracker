import {randomBytes,createCipheriv,createDecipheriv,createHash,timingSafeEqual} from 'node:crypto';
export const epoch = () => Math.floor(Date.now() / 1000);
export const pkceChallenge = verifier => createHash('sha256').update(verifier).digest('base64url');
export function safeMatch(a,b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left,right);
}
export function seal(secret,data,ttlSeconds,now=epoch()) {
  const key = Buffer.from(secret,'base64url');
  if (key.length !== 32 || ttlSeconds < 1 || ttlSeconds > 86400 * 31) throw Error('Invalid seal settings');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from('mosaic-github-projects-admin-v1'));
  const payload = Buffer.from(JSON.stringify({...data,iat:now,exp:now+ttlSeconds}));
  const encrypted = Buffer.concat([cipher.update(payload),cipher.final()]);
  return [iv.toString('base64url'),encrypted.toString('base64url'),cipher.getAuthTag().toString('base64url')].join('.');
}
export function unseal(secret,value,type,now=epoch()) {
  if (typeof value !== 'string' || value.length > 10000 || !/^[A-Za-z0-9_.-]+$/.test(value)) throw Error('Invalid token');
  const parts = value.split('.');
  if (parts.length !== 3) throw Error('Invalid token');
  const key = Buffer.from(secret,'base64url');
  if (key.length !== 32) throw Error('Missing key');
  const iv = Buffer.from(parts[0],'base64url'),tag = Buffer.from(parts[2],'base64url');
  if (iv.length !== 12 || tag.length !== 16) throw Error('Invalid token');
  const decipher = createDecipheriv('aes-256-gcm',key,iv);
  decipher.setAAD(Buffer.from('mosaic-github-projects-admin-v1'));
  decipher.setAuthTag(tag);
  const raw = Buffer.concat([decipher.update(Buffer.from(parts[1],'base64url')),decipher.final()]).toString('utf8');
  const payload = JSON.parse(raw);
  if (!payload || payload.type !== type || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) ||
      payload.iat > now + 10 || payload.exp <= now || payload.exp - payload.iat > 86400 * 31) throw Error('Token expired or invalid');
  return payload;
}
