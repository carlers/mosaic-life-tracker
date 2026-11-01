'use strict';
const {enabled,metadata}=require('../server/mcpAuth.cjs');
module.exports=function(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!enabled(process.env))return res.status(404).json({error:'Not found'});
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  return res.status(200).json(metadata(process.env));
};
