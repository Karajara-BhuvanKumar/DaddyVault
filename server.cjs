'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {openDatabase}=require('./database.cjs');
const CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
function configuration(env=process.env){
  const production=env.NODE_ENV==='production',port=Number(env.PORT||8080);
  if(!Number.isInteger(port)||port<1||port>65535)throw Error('PORT must be between 1 and 65535.');
  const origins=(env.DADDYVAULT_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  for(const origin of origins){const u=new URL(origin);if(u.origin!==origin||!['https:','http:'].includes(u.protocol)||production&&u.protocol!=='https:')throw Error('DADDYVAULT_ORIGINS must contain exact HTTPS origins without paths or trailing slashes.');}
  const passwordHash=env.DADDYVAULT_PASSWORD_HASH||'';
  if(passwordHash&&!require('./auth.cjs').hashPattern.test(passwordHash))throw Error('Invalid password hash. Run npm run password:hash.');
  if(production&&(!passwordHash||!origins.length||!env.DADDYVAULT_DB||!path.isAbsolute(env.DADDYVAULT_DB)))throw Error('Production requires DADDYVAULT_PASSWORD_HASH, DADDYVAULT_ORIGINS and an absolute DADDYVAULT_DB path on persistent storage.');
  const host=env.HOST||(production?'0.0.0.0':'127.0.0.1');
  if(!passwordHash&&!['127.0.0.1','localhost','::1'].includes(host))throw Error('Public network binding requires owner authentication.');
  return {production,port,host,origins,passwordHash,backendHost:env.RENDER_EXTERNAL_HOSTNAME,filename:env.DADDYVAULT_DB||path.join(__dirname,'.data','daddyvault.sqlite')};
}
function createHandler(database,port=8080,options={}){
  const token=crypto.randomBytes(32).toString('hex'),root=path.join(__dirname,'dist');
  const auth=options.passwordHash?database.authenticate(options.passwordHash):null;
  if(options.production&&!auth)throw Error('Production authentication is required.');
  const origins=new Set(options.origins||[]);
  if(!options.production){origins.add('http://localhost:'+port);origins.add('http://127.0.0.1:'+port);}
  const hosts=new Set([...origins].map(x=>new URL(x).host));
  if(options.backendHost)hosts.add(options.backendHost);
  const cookieName=options.production?'__Host-daddyvault':'daddyvault-session';
  const cookie=(value,age)=>cookieName+'='+value+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+age+(options.production?'; Secure':'');
  const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
  return async(req,res)=>{
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','Content-Security-Policy':CSP,'Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
    if(options.production)headers['Strict-Transport-Security']='max-age=31536000';
    const json=(status,value,extra={})=>{res.writeHead(status,{...headers,'Content-Type':'application/json; charset=utf-8',...extra});res.end(JSON.stringify(value));};
    async function body(limit){
      if(!String(req.headers['content-type']).startsWith('application/json'))throw Object.assign(Error('JSON required.'),{status:415});
      const chunks=[];let length=0;
      for await(const chunk of req){length+=chunk.length;if(length>limit)throw Object.assign(Error('Request body exceeds the size limit.'),{status:413});chunks.push(Buffer.from(chunk));}
      try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw Object.assign(Error('Invalid JSON.'),{status:400});}
    }
    try{
      if(!hosts.has(req.headers.host))return json(403,{error:'Invalid host.'});
      if(req.headers.origin&&!origins.has(req.headers.origin))return json(403,{error:'Cross-origin requests are not allowed.'});
      if(options.production&&!['GET','HEAD'].includes(req.method)&&!origins.has(req.headers.origin))return json(403,{error:'A trusted request origin is required.'});
      const url=new URL(req.url,'http://'+req.headers.host);
      if(url.pathname==='/api/health'&&req.method==='GET'){try{database.health();return json(200,{ok:true});}catch{return json(503,{error:'Database unavailable.'});}}
      const sessionToken=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
      const session=auth?.session(sessionToken);
      if(url.pathname==='/api/session'){
        if(req.method==='GET')return json(200,{required:!!auth,authenticated:!auth||!!session,csrf:session?.csrf||null});
        if(req.method==='POST'&&auth){const input=await body(2048);const login=await auth.login(input?.password);if(!login)return json(401,{error:'Incorrect password.'});auth.logout(sessionToken);return json(200,{authenticated:true,csrf:login.csrf},{'Set-Cookie':cookie(login.token,43200)});}
        if(req.method==='DELETE'&&auth){if(!session)return json(401,{error:'Sign in to continue.'});if(req.headers['x-vault-token']!==session.csrf)return json(403,{error:'Invalid session token.'});auth.logout(sessionToken);return json(200,{ok:true},{'Set-Cookie':cookie('',0)});}
        return json(405,{error:'Method not allowed.'});
      }
      if(url.pathname==='/api/state'){
        if(auth&&!session)return json(401,{error:'Sign in to access your vault.'});
        if(req.method==='GET')return json(200,{...database.read(),token:session?.csrf||token,storage:auth?'Private server database':'Local SQLite database',allowBrowserImport:!auth});
        if(req.method!=='PUT')return json(405,{error:'Method not allowed.'});
        if(req.headers['x-vault-token']!==(session?.csrf||token))return json(403,{error:'Session expired. Reload saved data and retry.'});
        const input=await body(10000000);
        return json(200,database.save(input?.state,input?.revision));
      }
      if(url.pathname.startsWith('/api/'))return json(404,{error:'API route not found.'});
      if(!['GET','HEAD'].includes(req.method))return json(405,{error:'Method not allowed.'});
      const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
      if(!file.startsWith(root+path.sep))return json(403,{error:'Forbidden.'});
      if(!mime[path.extname(file)])return json(404,{error:'Not found.'});
      fs.readFile(file,(err,data)=>{if(err)return json(404,{error:'Not found.'});res.writeHead(200,{...headers,'Content-Type':mime[path.extname(file)]+'; charset=utf-8'});res.end(req.method==='HEAD'?undefined:data);});
    }catch(e){const sqlite=e.code?.startsWith('SQLITE')||e.code==='ERR_SQLITE_ERROR';json(e.status||(sqlite?503:422),{error:sqlite?'Database save failed. No partial changes were committed.':e.message});}
  };
}
if(require.main===module){
  try{
    const config=configuration();fs.mkdirSync(path.dirname(config.filename),{recursive:true});
    const database=openDatabase(config.filename),server=http.createServer(createHandler(database,config.port,config));
    server.requestTimeout=15000;server.headersTimeout=10000;
    server.listen(config.port,config.host,()=>console.log('DaddyVault listening on '+config.host+':'+config.port+' ('+(config.passwordHash?'owner authentication enabled':'local-only mode')+')'));
    for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{database.close();process.exit(0);}));
  }catch(e){console.error('Startup failed: '+e.message);process.exitCode=1;}
}
module.exports={createHandler,configuration,CSP};
