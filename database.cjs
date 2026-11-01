'use strict';
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs'),path=require('node:path');
const F=require('./dist/ledger.js');
function openDatabase(filename){
  const db=new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  const version=db.prepare('PRAGMA user_version').get().user_version;
  if(version>2){db.close();throw Error('Database schema is newer than this application.');}
  db.exec('BEGIN IMMEDIATE');
  try{
    if(version<1)db.exec(fs.readFileSync(path.join(__dirname,'migrations','001_local_workspace.sql'),'utf8'));
    if(version<2)db.exec(fs.readFileSync(path.join(__dirname,'migrations','002_auth.sql'),'utf8'));
    db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');db.close();throw e;}
  function read(){const row=db.prepare('SELECT * FROM workspace WHERE id=1').get();return row?{state:F.validate(JSON.parse(row.payload)),revision:row.revision,updatedAt:row.updated_at}:{state:null,revision:0,updatedAt:null};}
  function save(state,expected){
    F.validate(state);if(state.demo)throw Error('Demo records cannot be saved into the real database.');
    if(!Number.isSafeInteger(expected)||expected<0)throw Error('Invalid revision.');
    db.exec('BEGIN IMMEDIATE');
    try{
      const previous=read();if(previous.revision!==expected){const err=Error('Another tab saved newer records. Reload saved data before retrying. Your form has not been discarded.');err.status=409;throw err;}
      const revision=expected+1,payload=JSON.stringify(state),now=new Date().toISOString();
      db.prepare('INSERT INTO workspace VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,updated_at=excluded.updated_at').run(revision,payload,now);
      db.prepare('INSERT INTO revisions VALUES(?,?,?)').run(revision,payload,now);
      db.prepare('DELETE FROM revisions WHERE revision < ?').run(Math.max(1,revision-29));
      db.exec('COMMIT');return {state,revision,updatedAt:now};
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  return {read,save,health:()=>db.prepare('SELECT 1').get(),authenticate:hash=>require('./auth.cjs').createAuth(db,hash),close:()=>db.close()};
}
module.exports={openDatabase};
