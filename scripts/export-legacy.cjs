'use strict';
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite'),F=require('../dist/ledger.js');
const source=process.env.DADDYVAULT_DB||path.join(__dirname,'../.data/daddyvault.sqlite');
const db=new DatabaseSync(source,{readOnly:true});
try{const row=db.prepare('SELECT payload FROM workspace WHERE id=1').get();if(!row)throw Error('No saved local workspace exists.');const state=F.validate(JSON.parse(row.payload));const folder=path.join(__dirname,'../backups');fs.mkdirSync(folder,{recursive:true});const file=path.join(folder,'legacy-'+Date.now()+'.json');fs.writeFileSync(file,JSON.stringify(state,null,2),{flag:'wx'});console.log('Private backup written: '+file);}finally{db.close();}
