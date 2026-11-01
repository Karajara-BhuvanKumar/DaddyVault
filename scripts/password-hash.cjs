'use strict';
// Read a password without echo or command-line arguments (shell history).
const {hashPassword}=require('../auth.cjs');
if(!process.stdin.isTTY){console.error('Run this command in an interactive terminal.');process.exit(1);}
let password='';
process.stdout.write('New owner password (16–256 characters, hidden): ');
process.stdin.setRawMode(true);process.stdin.setEncoding('utf8');process.stdin.resume();
process.stdin.on('data',async chunk=>{
  for(const c of chunk){
    if(c==='\u0003'){process.stdin.setRawMode(false);process.exit(130);}
    if(c==='\r'||c==='\n'){
      process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');
      try{console.log(await hashPassword(password));}catch(e){console.error(e.message);process.exitCode=1;}
      password='';return;
    }
    if(c==='\u007f'||c==='\b')password=password.slice(0,-1);
    else if(c>=' '&&password.length<257)password+=c;
  }
});
