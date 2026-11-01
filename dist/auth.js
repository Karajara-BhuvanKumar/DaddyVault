(function(root){
  'use strict';
  let csrf='',pending=null,required=false;
  const get=id=>document.getElementById(id);
  async function request(method,body){
    const response=await fetch('/api/session',{method,cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Vault-Token':csrf},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
    let data;try{data=await response.json();}catch{throw Error('The sign-in service is unavailable. Check the server connection.');}
    if(!response.ok)throw Error(data.error||'Sign-in failed.');
    csrf=data.csrf||'';return data;
  }
  function prompt(){
    if(pending)return pending;
    required=true;
    const dialog=get('auth-dialog'),form=get('auth-form'),error=get('auth-error');
    dialog.showModal();get('auth-password').focus();
    pending=new Promise(resolve=>{
      form.onsubmit=async event=>{
        event.preventDefault();event.stopPropagation();get('auth-submit').disabled=true;error.textContent='';
        try{await request('POST',{password:get('auth-password').value});form.reset();dialog.close();get('sign-out').hidden=false;pending=null;resolve();}
        catch(e){error.textContent=e.message;}
        finally{get('auth-submit').disabled=false;}
      };
    });
    return pending;
  }
  async function ensure(){
    if(location.protocol==='file:')return;
    const session=await request('GET');required=session.required;get('sign-out').hidden=!required;
    if(required&&!session.authenticated)await prompt();
  }
  get('auth-dialog').addEventListener('cancel',event=>event.preventDefault());
  get('sign-out').onclick=async()=>{
    if(!confirm('Sign out of this device? Any unsaved form will be discarded.'))return;
    try{await request('DELETE');location.reload();}catch(e){alert(e.message);}
  };
  root.VaultAuth={ensure,prompt,get required(){return required;},get csrf(){return csrf;}};
})(window);
