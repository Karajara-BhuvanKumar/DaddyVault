const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHandler}=require('../api/state.js'),F=require('../dist/ledger.js');
function invoke(handler,method='GET',body,headers={authorization:'Bearer test.jwt.token'}){return new Promise(resolve=>handler({method,body,headers},{setHeader(){},end(data){resolve({status:this.statusCode,data:JSON.parse(data)});}}));}
function mock({owner=true,conflict=false}={}){let saved=null;return async(url,options)=>{
 if(url.endsWith('/auth/v1/user'))return {ok:true,json:async()=>({id:'owner-id'})};
 if(url.includes('vault_owners?')&&options.method==='POST')return {ok:true,json:async()=>[]};
 if(url.includes('vault_owners?'))return {ok:true,json:async()=>owner?[{user_id:'owner-id'}]:[]};
 if(url.includes('vault_workspaces?'))return {ok:true,json:async()=>saved?[{payload:saved,revision:1}]:[]};
 if(conflict)return {ok:false,status:400,json:async()=>({code:'40001'})};
 saved=JSON.parse(options.body).p_state;return {ok:true,json:async()=>({state:saved,revision:1})};
};}
test('Supabase API refuses missing authentication and initializes a new private vault',async()=>{
 assert.equal((await invoke(createHandler(mock()),'GET',undefined,{})).status,401);
 assert.equal((await invoke(createHandler(mock({owner:false})))).status,200);
});
test('Supabase API validates income, expense and transfer ledger before cloud persistence',async()=>{
 const h=createHandler(mock()),s=F.emptyState();s.accounts.push({id:'bank',name:'Bank',type:'Bank Account',openingBalance:0,archived:false});
 const tx=(id,type,amount,extra={})=>({id,type,amount,name:'Test',date:'2025-01-15',accountId:'cash',category:type==='income'?'Salary':'Food & drinks',paymentMethod:'Cash',notes:'',...extra});
 s.transactions=[tx('a','income',10000),tx('b','expense',2000),tx('c','transfer',1000,{toAccountId:'bank'})];
 assert.equal((await invoke(h,'PUT',{state:s,revision:0})).status,200);
 const loaded=(await invoke(h)).data;assert.equal(F.calculate(loaded.state).cash,8000);assert.equal(loaded.storage,'Supabase cloud database');
 assert.equal((await invoke(h,'PUT',{state:{},revision:1})).status,422);
 assert.equal((await invoke(h,'PUT',{state:F.sample(),revision:1})).status,422);
});
test('Supabase conflicts and outages are surfaced without claiming a save',async()=>{
 assert.equal((await invoke(createHandler(mock({conflict:true})),'PUT',{state:F.emptyState(),revision:1})).status,409);
 assert.equal((await invoke(createHandler(async()=>{throw Error('offline');}))).status,503);
});
test('cloud SDK auth uses email/password and supplies refreshed token to API',async()=>{
 const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');let session=null,credentials;
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:true,open:false,showModal(){this.open=true;},close(){this.open=false;},focus(){},reset(){}});return elements.get(id);};
 const client={auth:{async getSession(){return {data:{session}};},async signInWithPassword(input){credentials=input;session={user:{id:'owner'},access_token:'fresh.jwt'};return {data:session};}}};
 const ctx=vm.createContext({URLSearchParams,document:{getElementById:get},location:{protocol:'https:'},VaultCloudConfig:{url:'https://example.supabase.co',key:'public'},supabase:{createClient:()=>client},confirm:()=>true,alert(){}});ctx.window=ctx;
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist/cloud-auth.js'),'utf8'),ctx);
 const ready=ctx.VaultAuth.ensure();await new Promise(r=>setImmediate(r));get('auth-email').value='owner@example.com';get('auth-password').value='test-password';
 await get('auth-form').onsubmit({preventDefault(){},stopPropagation(){}});await ready;
 assert.equal(credentials.email,'owner@example.com');assert.equal(await ctx.VaultAuth.getToken(),'fresh.jwt');assert.equal(get('auth-dialog').open,false);
});
