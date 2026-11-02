import {config} from '../server/config.js';
import {protectedResourceMetadata} from '../server/auth.js';
export default function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 try{config();}catch{return res.status(404).json({error:'Not found'});}
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 return res.status(200).json(protectedResourceMetadata());
}
