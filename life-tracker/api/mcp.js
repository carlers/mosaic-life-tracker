'use strict';
const {dispatch}=require('../server/mcpGateway.cjs');
const {enabled,verifyAuthorization,repository}=require('../server/mcpAuth.cjs');
module.exports=async function(req,res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(!enabled(process.env))return res.status(404).json({error:'Not found'});
  if(req.headers.host!==new URL(process.env.MOSAIC_MCP_RESOURCE).host)
    return res.status(404).json({error:'Not found'});
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return res.status(405).json({error:'Method not allowed'});
  }
  if(Number(req.headers['content-length'])>65536)
    return res.status(413).json({error:'Request too large'});
  let owner;
  try {owner=await verifyAuthorization(req.headers.authorization,process.env);}
  catch {
    res.setHeader('WWW-Authenticate','Bearer resource_metadata="'+
      new URL('/.well-known/oauth-protected-resource',process.env.MOSAIC_MCP_RESOURCE).href+
      '", error="invalid_token"');
    return res.status(401).json({error:'Unauthorized'});
  }
  let body;
  try {
    body=typeof req.body==='string'?JSON.parse(req.body):req.body;
  }catch {return res.status(400).json({error:'Invalid JSON'});}
  try {
    const result=await dispatch(body,owner,repository(process.env));
    return result===null?res.status(202).end():res.status(200).json(result);
  }catch {return res.status(400).json({error:'Request rejected'});}
};
