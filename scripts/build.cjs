// The runtime is buildless. This release builder checks its local references and
// emits one standalone HTML file, including the scalable DaddyVault marks.
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dist=path.join(root,'dist');
const read=name=>fs.readFileSync(path.join(dist,name),'utf8');
for(const script of ['core.js','ledger.js','auth.js','cloud-auth.js','cloud-config.js','storage.js','app.js','features.js'])execFileSync(process.execPath,['--check',path.join(dist,script)]);
const config=require('../supabase-config.cjs');
if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.url)||!config.key.startsWith('sb_publishable_'))throw Error('Invalid Supabase public configuration.');
fs.writeFileSync(path.join(dist,'cloud-config.js'),'window.VaultCloudConfig='+JSON.stringify(config)+';');
let html=read('index.html');
for(const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
  const ref=match[1];
  if(!/^(https?:|data:)/.test(ref)&&!fs.existsSync(path.join(dist,ref)))throw Error('Missing asset: '+ref);
}
const manifest=JSON.parse(read('site.webmanifest'));
for(const icon of manifest.icons)if(!fs.existsSync(path.join(dist,icon.src)))throw Error('Missing app icon: '+icon.src);
html=html.replace('<link rel="stylesheet" href="tokens.css">',()=>'<style>'+read('tokens.css')+'</style>');
html=html.replace('<link rel="stylesheet" href="styles.css">',()=>'<style>'+read('styles.css')+'</style>');
html=html.replace('<link rel="stylesheet" href="reference.css">',()=>'<style>'+read('reference.css')+'</style>');
html=html.replace(/<script src="([^"]+)"><\/script>/g,(match,file)=>file.startsWith('https:')?match:'<script>'+read(file)+'</script>');
html=html.replace('<link rel="stylesheet" href="features.css">',()=>'<style>'+read('features.css')+'</style>');
html=html.replace('<link rel="stylesheet" href="auth.css">',()=>'<style>'+read('auth.css')+'</style>');
html=html.replace(/(?:src|href)="(assets\/brand\/[^"]+\.svg)"/g,(whole,asset)=>whole.replace(asset,'data:image/svg+xml;base64,'+Buffer.from(read(asset)).toString('base64')));
// The standalone export also contains an asset URL inside a JS view template.
html=html.replaceAll('assets/brand/monogram-dark.svg','data:image/svg+xml;base64,'+Buffer.from(read('assets/brand/monogram-dark.svg')).toString('base64'));
html=html.replace(/\s*<link rel="manifest"[^>]+>/,'');
const out=path.join(root,'release');
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'DaddyVault.html'),html,'utf8');
console.log('Build passed: local asset references, manifest icons, JavaScript syntax.');
console.log('Standalone release: release/DaddyVault.html');
