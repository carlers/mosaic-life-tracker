import {config} from '../server/config.js';
import {authorizationMetadata,resourceMetadata} from '../server/oauth.js';
export default function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method!=='GET') return res.status(405).end();
  try {
    const cfg=config();
    if (req.query.kind==='resource') return res.status(200).json(resourceMetadata(cfg));
    if (req.query.kind==='authorization') return res.status(200).json(authorizationMetadata(cfg));
  } catch { return res.status(503).json({error:'Admin MCP disabled'}); }
  return res.status(404).end();
}
