'use strict';
const fs=require('node:fs'),path=require('node:path');
const {CSP}=require('../server.cjs');
function createConfig(value){
const url=new URL(value);
if(url.protocol!=='https:'||url.origin!==value)throw Error('Supply the exact HTTPS backend origin, with no path or trailing slash.');
return {
  $schema:'https://openapi.vercel.sh/vercel.json',
  framework:null,buildCommand:'npm run build',outputDirectory:'dist',installCommand:'npm ci',
  rewrites:[{source:'/api/:path*',destination:url.origin+'/api/:path*'}],
  headers:[{source:'/(.*)',headers:[
    {key:'Content-Security-Policy',value:CSP},
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Referrer-Policy',value:'no-referrer'},
    {key:'Cache-Control',value:'no-store'},
    {key:'Strict-Transport-Security',value:'max-age=31536000'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}
  ]}]
};
}
if(require.main===module){
const value=process.argv[2];
if(!value){console.error('Usage: npm run configure:vercel -- https://YOUR-SERVICE.onrender.com');process.exit(1);}
const config=createConfig(value);
fs.writeFileSync(path.join(__dirname,'..','vercel.json'),JSON.stringify(config,null,2)+'\n');
console.log('Created vercel.json with /api proxy to '+value+'. Add the Vercel origin to DADDYVAULT_ORIGINS on Render.');
}
module.exports={createConfig};
