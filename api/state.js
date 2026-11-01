'use strict';
const F=require('../dist/ledger.js'),config=require('../supabase-config.cjs');
function createHandler(fetcher=fetch){
 return async(req,res)=>{
 const send=(status,data)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.statusCode=status;res.end(JSON.stringify(data));};
 try{
  if(!['GET','PUT'].includes(req.method))return send(405,{error:'Method not allowed.'});
  const authorization=req.headers.authorization;
  if(!/^Bearer [A-Za-z0-9._-]+$/.test(authorization||''))return send(401,{error:'Sign in to access your vault.'});
  async function call(route,options={}){
   const response=await fetcher(config.url+route,{...options,headers:{apikey:config.key,Authorization:authorization,'Content-Type':'application/json'},signal:AbortSignal.timeout(12000)});
   const data=await response.json();
   if(!response.ok){const e=Error(data.code==='40001'?'Another device saved newer records. Reload saved data before retrying.':data.message||data.msg||'Supabase request failed.');e.status=response.status===401?401:data.code==='40001'?409:response.status===403?403:502;throw e;}
   return data;
  }
  const user=await call('/auth/v1/user');
  const owners=await call('/rest/v1/vault_owners?select=user_id&user_id=eq.'+encodeURIComponent(user.id));
  if(!owners.length)return send(403,{error:'This account has not been enabled as the vault owner. Add its user ID in Supabase before continuing.'});
  if(req.method==='GET'){
   const rows=await call('/rest/v1/vault_workspaces?select=payload,revision,updated_at&user_id=eq.'+encodeURIComponent(user.id));
   const row=rows[0];return send(200,{state:row?F.validate(row.payload):null,revision:row?.revision||0,updatedAt:row?.updated_at||null,storage:'Supabase cloud database',allowBrowserImport:false});
  }
  let input=req.body;
  if(input===undefined){let length=0,chunks=[];for await(const chunk of req){length+=chunk.length;if(length>4000000)return send(413,{error:'Workspace exceeds the 4 MB limit.'});chunks.push(Buffer.from(chunk));}input=Buffer.concat(chunks).toString('utf8');}
  if(typeof input==='string'){try{input=JSON.parse(input);}catch{return send(400,{error:'Invalid JSON.'});}}
  try{F.validate(input?.state);if(input.state.demo)throw Error('Demo records cannot replace real records.');if(!Number.isSafeInteger(input.revision)||input.revision<0)throw Error('Invalid revision.');}catch(e){return send(422,{error:e.message});}
  if(Buffer.byteLength(JSON.stringify(input))>4000000)return send(413,{error:'Workspace exceeds the 4 MB limit.'});
  return send(200,await call('/rest/v1/rpc/save_vault',{method:'POST',body:JSON.stringify({p_state:input.state,p_revision:input.revision})}));
 }catch(e){return send(e.status||503,{error:e.status?e.message:'Cannot reach Supabase. Reload saved records before retrying a save.'});}
 };
}
module.exports=createHandler();module.exports.createHandler=createHandler;
