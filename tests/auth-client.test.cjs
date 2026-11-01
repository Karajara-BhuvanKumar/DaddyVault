'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {createStorage}=require('../dist/storage.js'),F=require('../dist/ledger.js');
test('sign-in UI keeps rejected password retryable and unlocks only on successful authentication',async()=>{
  const elements=new Map();
  const get=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:true,textContent:'',open:false,disabled:false,addEventListener(){},showModal(){this.open=true;},close(){this.open=false;},focus(){},reset(){get('auth-password').value='';}});return elements.get(id);};
  let loggedIn=false,signIns=0;
  const context=vm.createContext({document:{getElementById:get},location:{protocol:'https:',reload(){}},AbortSignal,console,confirm:()=>true,alert(){},fetch:async(url,options)=>{
    if(options.method==='GET')return {ok:true,json:async()=>({required:true,authenticated:loggedIn})};
    if(options.method==='POST'){signIns++;loggedIn=JSON.parse(options.body).password==='test-only-password';return {ok:loggedIn,json:async()=>loggedIn?{authenticated:true,csrf:'test-csrf'}:{error:'Incorrect password.'}};}
  }});context.window=context;
  vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../dist/auth.js'),'utf8'),context);
  const ensure=context.VaultAuth.ensure();await new Promise(r=>setImmediate(r));assert.equal(get('auth-dialog').open,true);
  get('auth-password').value='wrong';await get('auth-form').onsubmit({preventDefault(){},stopPropagation(){}});
  assert.equal(get('auth-dialog').open,true);assert.match(get('auth-error').textContent,/Incorrect/);
  get('auth-password').value='test-only-password';await get('auth-form').onsubmit({preventDefault(){},stopPropagation(){}});await ensure;
  assert.equal(get('auth-dialog').open,false);assert.equal(context.VaultAuth.csrf,'test-csrf');assert.equal(get('auth-password').value,'');assert.equal(signIns,2);assert.equal(get('sign-out').hidden,false);
});
test('private server starts empty instead of silently importing records from a different browser workspace',async()=>{
  const legacy=F.emptyState();legacy.accounts[0].openingBalance=99999;
  let saved;
  const client=createStorage({storage:{getItem:()=>JSON.stringify(legacy)},fetcher:async(url,options)=>({ok:true,json:async()=>{
    if(options.method==='GET')return {state:null,revision:0,token:'test',allowBrowserImport:false,storage:'Private server database'};
    saved=JSON.parse(options.body).state;return {state:saved,revision:1};
  }})});
  assert.equal((await client.load()).accounts[0].openingBalance,0);assert.equal(saved.accounts[0].openingBalance,0);assert.equal(client.mode,'Private server database');
});
test('expired authentication retries pending save once with the new CSRF token and same revision',async()=>{
  const previous=globalThis.VaultAuth;let calls=0,prompts=0;
  globalThis.VaultAuth={csrf:'old',async prompt(){prompts++;this.csrf='new';}};
  try{
    const client=createStorage({storage:{getItem:()=>null},fetcher:async(url,options)=>{
      if(options.method==='GET')return {ok:true,json:async()=>({state:F.emptyState(),revision:7,token:'old'})};
      calls++;if(calls===1)return {status:401,ok:false};
      assert.equal(options.headers['X-Vault-Token'],'new');assert.equal(JSON.parse(options.body).revision,7);
      return {ok:true,json:async()=>({state:JSON.parse(options.body).state,revision:8})};
    }});
    const state=await client.load();state.accounts[0].openingBalance=100;await client.save(state);assert.equal(prompts,1);assert.equal(calls,2);
  }finally{if(previous===undefined)delete globalThis.VaultAuth;else globalThis.VaultAuth=previous;}
});
test('Vercel configuration proxies only API routes, preserving root assets and hash navigation',()=>{
  const {createConfig}=require('../scripts/configure-vercel.cjs');
  const config=createConfig('https://backend.onrender.com');
  assert.equal(config.outputDirectory,'dist');assert.deepEqual(config.rewrites,[{source:'/api/:path*',destination:'https://backend.onrender.com/api/:path*'}]);
  assert.throws(()=>createConfig('http://backend.onrender.com'),/HTTPS/);
  assert.throws(()=>createConfig('https://backend.onrender.com/'),/HTTPS/);
});
