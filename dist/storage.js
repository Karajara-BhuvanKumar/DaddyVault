(function(root){
  'use strict';
  const F=typeof module!=='undefined'?require('./ledger.js'):root.Vault;
  function createStorage({storage,fetcher,protocol='http:'}){
    const key='daddyvault-real-v2',demoKey='daddyvault-demo-v2';let revision=0,token='',demo=false,ready=false,lastLocal=null,remoteLabel='Server database';
    const remote=protocol!=='file:';
    async function request(method,body,retry=true){
      let response;try{response=await fetcher('/api/state',{method,cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Vault-Token':root.VaultAuth?.csrf||token,...(root.VaultAuth?.getToken?{Authorization:'Bearer '+await root.VaultAuth.getToken()}: {})},...(body?{body:JSON.stringify(body)}:{}),signal:typeof AbortSignal!=='undefined'?AbortSignal.timeout(12000):undefined});}catch{throw Error('Cannot reach the database server. Check your connection and retry. A save could not be confirmed; reload saved data before submitting again.');}
      if(response.status===401&&retry&&root.VaultAuth){await root.VaultAuth.prompt();return request(method,body,false);}
      let data;try{data=await response.json();}catch{throw Error('The database endpoint returned an invalid response. Check the API deployment.');}if(!response.ok)throw Error(data.error||'Database request failed.');if(data.token)token=data.token;if(data.storage)remoteLabel=data.storage;return data;
    }
    const fromBrowser=()=>{const current=storage.getItem(key);if(current)return F.migrate(JSON.parse(current));const legacy=storage.getItem('folio-data-v1');if(legacy){const parsed=F.migrate(JSON.parse(legacy));if(!parsed.demo)return parsed;}return F.emptyState();};
    async function load(){
      demo=false;
      if(remote){const saved=await request('GET');revision=saved.revision;if(saved.state){ready=true;return F.validate(saved.state);}const initial=saved.allowBrowserImport===false?F.emptyState():fromBrowser();const created=await request('PUT',{state:initial,revision});revision=created.revision;ready=true;return created.state;}
      const initial=fromBrowser();storage.setItem(key,JSON.stringify(initial));lastLocal=storage.getItem(key);ready=true;return initial;
    }
    async function save(state){
      if(!ready)throw Error('Load saved data before making changes.');F.validate(state);
      if(demo){if(!state.demo)throw Error('Leave demo mode before saving real data.');storage.setItem(demoKey,JSON.stringify(state));return state;}
      if(state.demo)throw Error('Demo data belongs in the separate sample workspace.');
      if(remote){const result=await request('PUT',{state,revision});revision=result.revision;return result.state;}
      if(storage.getItem(key)!==lastLocal)throw Error('Another tab changed your records. Reload saved data before retrying.');storage.setItem(key,JSON.stringify(state));lastLocal=JSON.stringify(state);return state;
    }
    function enterDemo(){const raw=storage.getItem(demoKey),state=raw?F.migrate(JSON.parse(raw)):F.sample();demo=true;ready=true;return state;}
    async function refresh(){if(demo)return null;if(remote){const result=await request('GET');if(result.revision===revision)return null;revision=result.revision;return result.state;}const raw=storage.getItem(key);if(raw===lastLocal)return null;const state=F.migrate(JSON.parse(raw));lastLocal=raw;return state;}
    return {load,save,enterDemo,refresh,get mode(){return demo?'Sample workspace':remote?remoteLabel:'This browser only';}};
  }
  if(typeof module!=='undefined')module.exports={createStorage};else root.VaultStorage={createStorage};
})(typeof window!=='undefined'?window:globalThis);
