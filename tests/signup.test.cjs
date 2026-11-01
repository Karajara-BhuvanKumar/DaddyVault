const {test}=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
function harness({search='',hash='',session=null,signupSession=false,fail=false}={}){
 const elements=new Map(),calls=[];let listener;
 const get=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:true,open:false,showModal(){this.open=true;},close(){this.open=false;},focus(){},reset(){}});return elements.get(id);};
 const auth={onAuthStateChange(fn){listener=fn;},async getSession(){return {data:{session}};},
  async signUp(input){calls.push(['signup',input]);if(fail)return {error:Error('Rate limit exceeded')};return {data:{user:{id:'new-user'},session:signupSession?{user:{id:'new-user'}}:null}};},
  async resetPasswordForEmail(...input){calls.push(['forgot',...input]);return fail?{error:Error('Email provider unavailable')}:{error:null};},
  async updateUser(input){calls.push(['update',input]);return {error:null};},
  async signOut(input){calls.push(['logout',input]);session=null;return {error:null};},
  async signInWithPassword(){session={user:{id:'new-user'},access_token:'fresh'};return {data:session};}};
 const ctx=vm.createContext({URLSearchParams,document:{getElementById:get},location:{protocol:'https:',search,hash,pathname:'/'},history:{replaceState(...args){calls.push(['clean',...args]);}},VaultCloudConfig:{url:'https://example.supabase.co',key:'public'},supabase:{createClient:()=>({auth})},confirm:()=>true,alert(){}});ctx.window=ctx;
 vm.runInContext(fs.readFileSync(require.resolve('../dist/cloud-auth.js'),'utf8'),ctx);
 return {get,calls,ctx,event:name=>listener(name),submit:()=>get('auth-form').onsubmit({preventDefault(){},stopPropagation(){}}),tick:()=>new Promise(r=>setImmediate(r))};
}
test('signup validates confirmation, requests email confirmation and keeps vault locked',async()=>{
 const h=harness();h.ctx.VaultAuth.ensure();await h.tick();h.get('auth-signup').onclick();
 h.get('auth-email').value='new@example.com';h.get('auth-password').value='long-test-password';h.get('auth-confirm').value='wrong';await h.submit();
 assert.equal(h.calls.length,0);assert.match(h.get('auth-error').textContent,/do not match/);
 h.get('auth-confirm').value='long-test-password';await h.submit();
 assert.equal(h.calls[0][1].options.emailRedirectTo,'https://daddy-vault.vercel.app/');assert.equal(h.get('auth-dialog').open,true);
 assert.match(h.get('auth-notice').textContent,/confirm your account/);assert.equal(h.get('auth-confirm').disabled,true);
});
test('signup with an immediately confirmed session unlocks the app',async()=>{
 const h=harness({signupSession:true});const ready=h.ctx.VaultAuth.ensure();await h.tick();h.get('auth-signup').onclick();
 h.get('auth-email').value='new@example.com';h.get('auth-password').value=h.get('auth-confirm').value='long-test-password';await h.submit();await ready;
 assert.equal(h.get('auth-dialog').open,false);
});
test('forgot password uses recovery redirect and a non-enumerating acknowledgement',async()=>{
 const h=harness();h.ctx.VaultAuth.ensure();await h.tick();h.get('auth-forgot').onclick();h.get('auth-email').value='test@example.com';await h.submit();
 assert.equal(h.calls[0][2].redirectTo,'https://daddy-vault.vercel.app/?auth=recovery');
 assert.match(h.get('auth-notice').textContent,/If an account exists/);assert.equal(h.get('auth-password').disabled,true);
});
test('provider errors are visible and the form remains usable',async()=>{
 const h=harness({fail:true});h.ctx.VaultAuth.ensure();await h.tick();h.get('auth-forgot').onclick();await h.submit();
 assert.match(h.get('auth-error').textContent,/provider unavailable/);assert.equal(h.get('auth-notice').textContent,'');assert.equal(h.get('auth-submit').disabled,false);
 h.get('auth-signup').onclick();h.get('auth-password').value=h.get('auth-confirm').value='long-test-password';await h.submit();assert.match(h.get('auth-error').textContent,/Rate limit/);
});
test('valid recovery gates data, updates password, revokes sessions and requires sign-in',async()=>{
 const h=harness({search:'?auth=recovery',session:{user:{id:'new-user'},access_token:'recovery'}});let unlocked=false;
 const ready=h.ctx.VaultAuth.ensure().then(()=>unlocked=true);await h.tick();assert.equal(unlocked,false);assert.equal(h.get('auth-title').textContent,'Set a new password');
 h.get('auth-password').value=h.get('auth-confirm').value='replacement-password';await h.submit();
 assert.equal(h.calls[0][0],'update');assert.equal(h.calls[1][1].scope,'global');assert.equal(unlocked,false);assert.match(h.get('auth-notice').textContent,/Password updated/);
 h.get('auth-password').value='replacement-password';await h.submit();await ready;assert.equal(await h.ctx.VaultAuth.getToken(),'fresh');
});
test('expired recovery links show a fresh reset request and allow later login',async()=>{
 for(const options of [{search:'?auth=recovery'},{hash:'#error=access_denied&error_description=Expired'}]){
  const h=harness(options);const ready=h.ctx.VaultAuth.ensure();await h.tick();assert.match(h.get('auth-error').textContent,/expired/);assert.equal(h.get('auth-title').textContent,'Forgot your password?');
  h.get('auth-login').onclick();await h.submit();await ready;assert.equal(await h.ctx.VaultAuth.getToken(),'fresh');
 }
});
test('SDK recovery event opens password form synchronously without an auth lock request',async()=>{
 const h=harness({session:{user:{id:'new-user'}}});await h.ctx.VaultAuth.ensure();h.event('PASSWORD_RECOVERY');assert.equal(h.get('auth-title').textContent,'Set a new password');assert.equal(h.calls.length,0);
});
