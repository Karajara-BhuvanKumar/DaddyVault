(function(root){
 'use strict';
 if(location.protocol==='file:')return;
 const get=id=>document.getElementById(id);
 const params=new URLSearchParams(location.search||''),fragment=new URLSearchParams((location.hash||'').slice(1));
 let recovery=params.get('auth')==='recovery'||fragment.get('type')==='recovery';
 let linkError=fragment.get('error_description')||params.get('error_description');
 let client,pending=null,resolvePending=null,identity=null,mode='login',submitting=false;
 const redirect='https://daddy-vault.vercel.app/';
 function cleanURL(){if(root.history)root.history.replaceState(null,'',location.pathname||'/');}
 function connection(){
  if(!root.supabase)throw Error('Supabase sign-in could not load. Check your internet connection and reload.');
  if(!client){
   client=root.supabase.createClient(root.VaultCloudConfig.url,root.VaultCloudConfig.key);
   client.auth.onAuthStateChange?.((event)=>{
    // Keep SDK callbacks synchronous to avoid holding the auth lock.
    if(event==='PASSWORD_RECOVERY'){recovery=true;prompt('reset');}
   });
  }
  return client;
 }
 function screen(next){
  mode=next;get('auth-error').textContent='';get('auth-notice').textContent='';
  get('auth-title').textContent={login:'Unlock DaddyVault',signup:'Create your account',forgot:'Forgot your password?',reset:'Set a new password'}[mode];
  get('auth-description').textContent={login:'Sign in to your private financial vault.',signup:'Your finances stay private to your account.',forgot:'Enter your email to request a password reset link.',reset:'Choose a new password for your account.'}[mode];
  const email=mode!=='reset',password=mode!=='forgot',confirm=mode==='signup'||mode==='reset';
  get('auth-email-field').hidden=!email;get('auth-email').required=email;get('auth-email').disabled=!email;
  get('auth-password-field').hidden=!password;get('auth-password').required=password;get('auth-password').disabled=!password;
  get('auth-password').minLength=confirm?12:1;get('auth-password').autocomplete=confirm?'new-password':'current-password';
  get('auth-confirm-field').hidden=!confirm;get('auth-confirm').required=confirm;get('auth-confirm').disabled=!confirm;
  get('auth-password').value='';get('auth-confirm').value='';
  get('auth-submit').textContent={login:'Sign in',signup:'Create account',forgot:'Send reset link',reset:'Update password'}[mode];
  get('auth-login').hidden=mode==='login'||mode==='reset';get('auth-signup').hidden=mode!=='login';get('auth-forgot').hidden=mode!=='login';
 }
 function unlock(user){
  if(identity&&identity!==user.id){location.reload();return;}
  identity=user.id;get('auth-form').reset();get('auth-dialog').close();get('sign-out').hidden=false;
  cleanURL();
  pending=null;const resolve=resolvePending;resolvePending=null;resolve?.();
 }
 function prompt(next='login'){
  if(!pending)pending=new Promise(resolve=>resolvePending=resolve);
  screen(next);const dialog=get('auth-dialog');if(!dialog.open)dialog.showModal();
  get(next==='reset'?'auth-password':'auth-email').focus();
  return pending;
 }
 for(const [id,next] of [['auth-login','login'],['auth-signup','signup'],['auth-forgot','forgot']])get(id).onclick=()=>{if(!submitting)prompt(next);};
 get('auth-form').onsubmit=async event=>{
  event.preventDefault();event.stopPropagation();if(submitting)return;
  submitting=true;get('auth-submit').disabled=true;get('auth-error').textContent='';get('auth-notice').textContent='';
  try{
   const auth=connection().auth,email=get('auth-email').value.trim(),password=get('auth-password').value;
   if(mode==='signup'||mode==='reset'){
    if(password.length<12)throw Error('Use at least 12 characters for your password.');
    if(password!==get('auth-confirm').value)throw Error('The passwords do not match.');
   }
   if(mode==='forgot'){
    const {error}=await auth.resetPasswordForEmail(email,{redirectTo:redirect+'?auth=recovery'});if(error)throw error;
    get('auth-notice').textContent='If an account exists for this email, a reset link has been requested. Check your inbox and spam folder.';
   }else if(mode==='signup'){
    const {data,error}=await auth.signUp({email,password,options:{emailRedirectTo:redirect}});if(error)throw error;
    if(data.session)unlock(data.user);else{screen('login');get('auth-notice').textContent='Check your email to confirm your account, then sign in. If you already have an account, sign in or reset your password.';}
   }else if(mode==='reset'){
    const {data:sessionData,error:sessionError}=await auth.getSession();
    if(sessionError||!sessionData.session)throw Error('This reset link is invalid or expired. Request a new link.');
    const {error}=await auth.updateUser({password});if(error)throw error;
    const {error:logoutError}=await auth.signOut({scope:'global'});if(logoutError)throw logoutError;
    recovery=false;identity=null;cleanURL();screen('login');get('auth-notice').textContent='Password updated. Sign in with your new password.';
   }else{
    const {data,error}=await auth.signInWithPassword({email,password});if(error)throw error;unlock(data.user);
   }
  }catch(e){get('auth-error').textContent=e.message||'Please try again.';}
  finally{submitting=false;get('auth-submit').disabled=false;}
 };
 async function ensure(){
  const {data,error}=await connection().auth.getSession();
  if(linkError){cleanURL();linkError=null;recovery=false;prompt('forgot');get('auth-error').textContent='This email link is invalid or expired. Request a new one.';return pending;}
  if(error)throw error;
  if(recovery){
   if(!data.session){cleanURL();recovery=false;prompt('forgot');get('auth-error').textContent='This reset link is invalid or expired. Request a new link.';}
   else prompt('reset');
   return pending;
  }
  if(!data.session)await prompt();else{identity=data.session.user.id;get('sign-out').hidden=false;if(fragment.get('access_token')||params.get('access_token'))cleanURL();}
 }
 async function getToken(){
  if(recovery)await prompt('reset');
  const {data,error}=await connection().auth.getSession();if(error)throw error;
  if(!data.session){await prompt();return getToken();}
  if(identity&&identity!==data.session.user.id){location.reload();throw Error('Account changed. Reloading.');}
  identity=data.session.user.id;return data.session.access_token;
 }
 get('sign-out').onclick=async()=>{
  if(!confirm('Sign out of this device? Any unsaved form will be discarded.'))return;
  try{const {error}=await connection().auth.signOut({scope:'local'});if(error)throw error;location.reload();}catch(e){alert(e.message);}
 };
 root.VaultAuth={ensure,prompt,getToken,required:true,csrf:''};
})(window);
