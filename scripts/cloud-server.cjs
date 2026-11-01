'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),api=require('../api/state.js');
const root=path.join(__dirname,'../dist'),port=Number(process.env.PORT||8080);
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const headers=require('../vercel.json').headers[0].headers;
http.createServer((req,res)=>{
 for(const h of headers)res.setHeader(h.key,h.value);
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/state')return api(req,res);
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));
 if(!file.startsWith(root+path.sep)||!mime[path.extname(file)]){res.writeHead(404);return res.end();}
 fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',mime[path.extname(file)]);res.end(req.method==='HEAD'?undefined:data);});
}).listen(port,'127.0.0.1',()=>console.log('DaddyVault + Supabase: http://localhost:'+port));
