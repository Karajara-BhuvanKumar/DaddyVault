(function(root){
 'use strict';
 if(location.protocol==='file:')return;
 const get=id=>document.getElementById(id);
 let client,pending=null,identity=null;
 function connection(){
  if(!root.supabase)throw Error('Supabase sign-in could not load. Check your internet connection and reload.');
  return client||(client=root.supabase.createClient(root.VaultCloudConfig.url,root.VaultCloudConfig.key));
 }
 async function prompt(){
  if(pending)return pending;
  const dialog=get('auth-dialog'),form=get('auth-form'),error=get('auth-error');
  if(!dialog.open)dialog.showModal();
  get('auth-email').focus();
  pending=new Promise(resolve=>{
   form.onsubmit=async event=>{
    event.preventDefault();event.stopPropagation();get('auth-submit').disabled=true;error.textContent='';
    try{
     const {data,error:failure}=await connection().auth.signInWithPassword({email:get('auth-email').value.trim(),password:get('auth-password').value});
     if(failure)throw failure;
     if(identity&&identity!==data.user.id){location.reload();return;}
     identity=data.user.id;form.reset();dialog.close();get('sign-out').hidden=false;pending=null;resolve();
    }catch(e){error.textContent=e.message;}finally{get('auth-submit').disabled=false;}
   };
  });
  return pending;
 }
 async function ensure(){
  const {data,error}=await connection().auth.getSession();if(error)throw error;
  if(!data.session)await prompt();else{identity=data.session.user.id;get('sign-out').hidden=false;}
 }
 async function getToken(){
  const {data,error}=await connection().auth.getSession();if(error)throw error;
  if(!data.session){await prompt();return getToken();}
  if(identity&&identity!==data.session.user.id){location.reload();throw Error('Account changed. Reloading.');}
  identity=data.session.user.id;return data.session.access_token;
 }
 get('sign-out').onclick=async()=>{
  if(!confirm('Sign out of this device? Any unsaved form will be discarded.'))return;
  const {error}=await connection().auth.signOut({scope:'local'});if(error){alert(error.message);return;}location.reload();
 };
 root.VaultAuth={ensure,prompt,getToken,required:true,csrf:''};
})(window);
