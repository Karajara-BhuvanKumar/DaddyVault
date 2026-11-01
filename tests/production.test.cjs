'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {openDatabase}=require('../database.cjs'),{createHandler,configuration}=require('../server.cjs');
const {hashPassword}=require('../auth.cjs'),F=require('../dist/ledger.js');
const password=require('node:crypto').randomBytes(32).toString('hex');
const hashed=hashPassword(password);
async function fixture(t,filename=':memory:'){
  const db=openDatabase(filename),passwordHash=await hashed;
  const options={production:true,passwordHash,origins:['https://vault.test'],backendHost:'backend.test'};
  const handler=createHandler(db,8080,options);
  const server=process.env.RUN_HTTP_TESTS==='1'?http.createServer(handler):null;
  if(server)await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{if(server)await new Promise(r=>server.close(r));db.close();});
  const request=async(route,method='GET',data,headers={})=>{
    if(!server){
      const req=require('node:stream').Readable.from(data!==undefined?[Buffer.from(JSON.stringify(data))]:[]);
      Object.assign(req,{url:route,method,headers:{host:'backend.test',origin:'https://vault.test','content-type':'application/json',...headers}});
      return new Promise((resolve,reject)=>{
        let status,responseHeaders;
        handler(req,{writeHead(s,h){status=s;responseHeaders=new Headers(h);},end(text){let body;try{body=JSON.parse(text);}catch{body=String(text);}resolve({status,headers:responseHeaders,body});}}).catch(reject);
      });
    }
    const response=await fetch('http://127.0.0.1:'+server.address().port+route,{method,headers:{host:'backend.test',origin:'https://vault.test','content-type':'application/json',...headers},...(data!==undefined?{body:JSON.stringify(data)}:{})});
    const text=await response.text();let body;try{body=JSON.parse(text);}catch{body=text;}
    return {status:response.status,headers:response.headers,body};
  };
  const login=async()=>{const result=await request('/api/session','POST',{password});assert.equal(result.status,200);return {cookie:result.headers.get('set-cookie').split(';')[0],'x-vault-token':result.body.csrf};};
  return {db,request,login,options};
}
test('production startup fails closed for missing credentials, origins, persistent path and unsafe binding',async()=>{
  assert.throws(()=>configuration({NODE_ENV:'production'}),/Production requires/);
  assert.throws(()=>configuration({HOST:'0.0.0.0'}),/authentication/);
  assert.throws(()=>configuration({PORT:'NaN'}),/PORT/);
  assert.throws(()=>configuration({NODE_ENV:'production',DADDYVAULT_ORIGINS:'http://vault.test'}),/HTTPS/);
  assert.throws(()=>configuration({DADDYVAULT_PASSWORD_HASH:'invalid'}),/Invalid password/);
  const valid=configuration({NODE_ENV:'production',DADDYVAULT_ORIGINS:'https://vault.test',DADDYVAULT_PASSWORD_HASH:await hashed,DADDYVAULT_DB:path.join(os.tmpdir(),'vault.sqlite')});
  assert.equal(valid.host,'0.0.0.0');
});
test('production request handlers: authentication, secure cookies, CSRF, logout, health and asset routes',async t=>{
  const {request,login}=await fixture(t);
  assert.equal((await request('/api/health')).status,200);
  assert.equal((await request('/api/state')).status,401);
  assert.equal((await request('/api/state','PUT',{state:F.emptyState(),revision:0})).status,401);
  assert.equal((await request('/api/session')).body.authenticated,false);
  assert.equal((await request('/api/session','POST',{password:'incorrect'})).status,401);
  const raw=await request('/api/session','POST',{password});
  const cookie=raw.headers.get('set-cookie');
  for(const marker of ['__Host-daddyvault=','HttpOnly','Secure','SameSite=Strict','Path=/','Max-Age=43200'])assert.ok(cookie.includes(marker));
  assert.ok(!cookie.includes('Domain='));
  const headers=await login(),first=await request('/api/state','GET',undefined,headers);
  assert.equal(first.body.allowBrowserImport,false);
  const s=F.emptyState();s.accounts[0].openingBalance=1000;
  assert.equal((await request('/api/state','PUT',{state:s,revision:0},headers)).status,200);
  assert.equal((await request('/api/state','PUT',{state:s,revision:0},headers)).status,409);
  assert.equal((await request('/api/state','PUT',{state:s,revision:1},{cookie:headers.cookie})).status,403);
  assert.equal((await request('/api/state','PUT',{state:s,revision:1},{...headers,origin:''})).status,403);
  assert.equal((await request('/api/state','GET',undefined,{...headers,origin:'https://attacker.test'})).status,403);
  assert.equal((await request('/api/state','GET',undefined,{...headers,host:'attacker.test'})).status,403);
  assert.equal((await request('/api/state','GET',undefined,{cookie:'__Host-daddyvault='+'a'.repeat(64)})).status,401);
  assert.equal((await request('/api/state','PUT',{state:{},revision:1},headers)).status,422);
  assert.equal((await request('/api/state','PUT',{state:s,revision:1},{...headers,'content-type':'text/plain'})).status,415);
  for(const route of ['/','/index.html','/app.js','/auth.js','/auth.css','/assets/brand/favicon.svg','/site.webmanifest']){
    const r=await request(route);assert.equal(r.status,200,route);assert.match(r.headers.get('content-security-policy'),/script-src 'self'/);
  }
  for(const route of ['/server.cjs','/.env','/.data/daddyvault.sqlite','/api/missing','/missing.js'])assert.equal((await request(route)).status,404,route);
  assert.equal((await request('/api/session','DELETE',undefined,headers)).status,200);
  assert.equal((await request('/api/state','GET',undefined,headers)).status,401);
});
test('separate signed-in clients share persisted records and detect concurrent writes',async t=>{
  const {request,login}=await fixture(t);const a=await login(),b=await login();
  const state=F.emptyState();state.accounts[0].openingBalance=25000;
  assert.equal((await request('/api/state','PUT',{state,revision:0},a)).status,200);
  const second=await request('/api/state','GET',undefined,b);assert.equal(second.body.state.accounts[0].openingBalance,25000);
  state.accounts[0].openingBalance=30000;
  assert.equal((await request('/api/state','PUT',{state,revision:1},b)).status,200);
  assert.equal((await request('/api/state','PUT',{state,revision:1},a)).status,409);
  assert.equal((await request('/api/state','GET',undefined,a)).body.state.accounts[0].openingBalance,30000);
});
test('migration from v1 preserves financial records; sessions survive restart and expire or rotate',async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'daddyvault-production-')),file=path.join(folder,'vault.sqlite');let db;
  try{
    const {DatabaseSync}=require('node:sqlite'),raw=new DatabaseSync(file);
    raw.exec(fs.readFileSync(path.join(__dirname,'../migrations/001_local_workspace.sql'),'utf8'));
    const state=F.emptyState();state.accounts[0].openingBalance=789;
    raw.prepare('INSERT INTO workspace VALUES(1,1,?,?)').run(JSON.stringify(state),new Date().toISOString());raw.close();
    db=openDatabase(file);let auth=db.authenticate(await hashed),session=await auth.login(password);
    db.close();db=openDatabase(file);auth=db.authenticate(await hashed);
    assert.equal(db.read().state.accounts[0].openingBalance,789);assert.ok(auth.session(session.token));
    const sql=new DatabaseSync(file);sql.prepare('UPDATE auth_sessions SET expires=0').run();sql.close();
    assert.equal(auth.session(session.token),undefined);
    session=await auth.login(password);
    const rotated=await hashPassword(require('node:crypto').randomBytes(32).toString('hex'));
    assert.equal(db.authenticate(rotated).session(session.token),undefined);
  }finally{db?.close();assert.ok(path.resolve(folder).startsWith(path.resolve(os.tmpdir())+path.sep)&&path.basename(folder).startsWith('daddyvault-production-'));fs.rmSync(folder,{recursive:true});}
});
test('login throttling blocks guessing; oversized login requests are rejected',async t=>{
  const {request}=await fixture(t);
  assert.equal((await request('/api/session','POST',{password:'x'.repeat(3000)})).status,413);
  for(let i=0;i<10;i++)assert.equal((await request('/api/session','POST',{password:null})).status,401);
  assert.equal((await request('/api/session','POST',{password})).status,429);
});
