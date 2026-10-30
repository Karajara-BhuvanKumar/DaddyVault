const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const tokens=fs.readFileSync(path.join(__dirname,'../dist/tokens.css'),'utf8');
const color=name=>{
  const hex=tokens.match(new RegExp('--'+name+':\\s*(#[a-f0-9]{6})'))?.[1];
  assert.ok(hex,'Missing color '+name);
  return hex;
};
const lum=hex=>hex.slice(1).match(/../g).map(h=>parseInt(h,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
test('normal text and financial status colors meet WCAG AA contrast on all main surfaces',()=>{
  for(const fg of ['text','text-secondary','muted','positive','negative']){
    for(const bg of ['bg','surface','surface-high','surface-hover','brand-navy']){
      const ratio=contrast(color(fg),color(bg));
      assert.ok(ratio>=4.5,fg+' on '+bg+': '+ratio.toFixed(2));
    }
  }
});
test('primary action labels and focus rings have adequate contrast',()=>{
  assert.ok(contrast(color('action-text'),color('action'))>=4.5);
  assert.ok(contrast(color('action-text'),color('action-hover'))>=4.5);
  assert.ok(contrast(color('focus'),color('surface'))>=3);
});
