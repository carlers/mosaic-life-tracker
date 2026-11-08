import {config} from '../server/config.js';
import {registerClient,authorize,githubCallback,exchangeCode} from '../server/oauth.js';
function parse(req) {
  if (req.body && typeof req.body==='object' && !Array.isArray(req.body)) return req.body;
  if (typeof req.body==='string') return Object.fromEntries(new URLSearchParams(req.body));
  return {};
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  if (Number(req.headers['content-length'])>16384) return res.status(413).json({error:'Too large'});
  let cfg;
  try { cfg=config(); } catch { return res.status(503).json({error:'Admin MCP disabled'}); }
  try {
    const route=req.query.route;
    if (route==='register' && req.method==='POST') {
      return res.status(201).json(registerClient(parse(req),cfg));
    }
    if (route==='authorize' && req.method==='GET') {
      const location=authorize(req.query,cfg);
      res.setHeader('Location',location);
      return res.status(302).end();
    }
    if (route==='github-callback' && req.method==='GET') {
      const location=githubCallback(req.query,cfg);
      res.setHeader('Location',location);
      return res.status(302).end();
    }
    if (route==='token' && req.method==='POST') {
      res.setHeader('Pragma','no-cache');
      return res.status(200).json(await exchangeCode(parse(req),cfg));
    }
  } catch {
    return res.status(400).json({error:'OAuth request denied'});
  }
  return res.status(405).end();
}
