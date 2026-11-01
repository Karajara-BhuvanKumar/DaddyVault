'use strict';
// Disposable, loopback-only browser QA. Never reads the owner's .data directory.
const http=require('node:http'),crypto=require('node:crypto');
const {openDatabase}=require('../database.cjs'),{createHandler}=require('../server.cjs'),{hashPassword}=require('../auth.cjs');
(async()=>{
  const password=crypto.randomBytes(20).toString('base64url'),db=openDatabase(':memory:');
  const server=http.createServer(createHandler(db,8091,{passwordHash:await hashPassword(password)}));
  server.listen(8091,'127.0.0.1',()=>console.log('Disposable QA: http://127.0.0.1:8091\nTemporary password: '+password));
  process.on('SIGINT',()=>server.close(()=>{db.close();process.exit(0);}));
})();
