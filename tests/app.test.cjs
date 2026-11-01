const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
function boot(storage=new Map()){
  const elements=new Map(),events={};
  const element=key=>{if(!elements.has(key))elements.set(key,{innerHTML:'',textContent:'',dataset:{},style:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},showModal(){this.open=true;},close(){this.open=false;}});return elements.get(key);};
  const context=vm.createContext({console,Intl,Date,Math,Number,String,Set,JSON,Error,crypto:require('node:crypto').webcrypto,FormData:class{constructor(form){return Object.entries(form.data);}},Blob,URL,setTimeout(){return 1;},clearTimeout(){},document:{querySelector:element,querySelectorAll(){return [];},addEventListener(type,fn){events[type]=fn;},body:element('body')},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{hash:''}});
  context.window=context;context.scrollTo=()=>{};context.addEventListener=()=>{};
  for(const file of ['core.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../dist',file),'utf8'),context);
  return {context,events,elements,storage,run:code=>vm.runInContext(code,context)};
}
test('every view renders; user text is escaped',()=>{
  const app=boot();
  for(const view of ['overview','transactions','investments','budgets','settings']){
    app.run('go('+JSON.stringify(view)+')');
    assert.ok(app.elements.get('#content').innerHTML.length>100);
    assert.ok(!app.elements.get('#content').innerHTML.includes('NaN'));
  }
  app.run('state.settings.name="<img src=x onerror=alert(1)>";go("overview")');
  assert.ok(!app.elements.get('#content').innerHTML.includes('<img src=x'));
});
test('Add income opens an income form with a valid income category',()=>{
  const app=boot();
  app.events.click({target:{closest(){return {dataset:{action:'add-income'}};}}});
  const form=app.elements.get('#modal-body').innerHTML;
  assert.match(form,/<option selected>income<\/option>/);
  assert.match(form,/<option selected>Salary<\/option>/);
  assert.ok(app.elements.get('#modal').open);
});
test('spending chart legend uses the selected period and excludes income',()=>{
  const app=boot();
  app.run(`state=F.emptyState();month='2020-01';state.transactions=[
    {id:'1',name:'Lunch',amount:125,type:'expense',category:'Food & drinks',date:'2020-01-01',account:'Cash'},
    {id:'2',name:'Dinner',amount:75,type:'expense',category:'Food & drinks',date:'2020-01-31',account:'Cash'},
    {id:'3',name:'Salary',amount:900,type:'income',category:'Salary',date:'2020-01-31',account:'Bank'}];chartMode='week'`);
  let chart=app.run('chart()');
  assert.ok(chart.includes('₹75'));
  assert.ok(!chart.includes('₹125'));
  assert.ok(!chart.includes('₹900'));
  app.run("chartMode='month'");
  chart=app.run('chart()');
  assert.ok(chart.includes('₹200'));
  assert.ok(!chart.includes('NaN'));
});
test('empty dashboard has no fabricated balances, charts or holdings',()=>{
  const app=boot();
  app.run('state=F.emptyState();render()');
  const html=app.elements.get('#content').innerHTML;
  assert.ok(html.includes('No expenses recorded'));
  assert.ok(html.includes('Add an investment'));
  assert.ok(!html.includes('NaN'));
  assert.ok(!html.includes('class="bar-segment"'));
});
test('transaction create, edit, persistence and delete update derived totals',()=>{
  const app=boot();
  app.run('persist(F.emptyState());month=F.dateString().slice(0,7);render()');
  const form={id:'transaction-form',dataset:{id:''},data:{type:'expense',name:'Test lunch',amount:'123.45',category:'Food & drinks',date:app.run('F.dateString()'),account:'Cash'}};
  app.events.submit({target:form,preventDefault(){}});
  assert.equal(app.run('F.summary(state,month).expense'),123.45);
  assert.equal(app.run('state.transactions.length'),1);
  form.dataset.id=app.run('state.transactions[0].id');form.data.amount='200';
  app.events.submit({target:form,preventDefault(){}});
  assert.equal(app.run('F.summary(state,month).expense'),200);
  assert.equal(app.run('state.transactions.length'),1);
  const reloaded=boot(app.storage);
  assert.equal(reloaded.run('state.transactions[0].amount'),200);
  const button={dataset:{deleteTransaction:form.dataset.id}};
  reloaded.events.click({target:{closest(){return button;}}});
  reloaded.elements.get('#confirm-go').onclick();
  assert.equal(reloaded.run('state.transactions.length'),0);
});
test('holding and budget forms persist values and portfolio stays separate',()=>{
  const app=boot();app.run('persist(F.emptyState());render()');
  app.events.submit({preventDefault(){},target:{id:'holding-form',dataset:{id:''},data:{name:'Test fund',symbol:'TST',asset:'Mutual funds',units:'5',cost:'100',price:'120',date:app.run('F.dateString()')}}});
  assert.equal(app.run('F.summary(state,month).gain'),100);
  assert.equal(app.run('F.summary(state,month).cash'),0);
  app.events.submit({preventDefault(){},target:{id:'budget-form',dataset:{},data:{category:'Shopping',limit:'2500'}}});
  assert.equal(app.run('state.budgets[0].limit'),2500);
});
test('filters search descriptions and restrict type and category',()=>{
  const app=boot();
  assert.equal(app.run('search="spotify";filteredTransactions().length'),1);
  assert.equal(app.run('typeFilter="income";filteredTransactions().length'),0);
  assert.ok(app.run('search="";typeFilter="expense";categoryFilter="Shopping";filteredTransactions().every(t=>t.category==="Shopping"&&t.type==="expense")'));
});
test('branding keeps existing Folio storage and backup records intact',()=>{
  const F=require('../dist/core.js');
  const saved=F.emptyState({name:'Existing user',currency:'INR',openingBalance:4321.55});
  saved.transactions=[{id:'legacy-transaction',name:'Preserved record',amount:250,type:'expense',category:'Other',date:'2025-01-01',account:'Cash'}];
  const original=JSON.stringify(saved),storage=new Map([['folio-data-v1',original]]);
  const app=boot(storage);
  for(const screen of ['overview','transactions','investments','budgets','settings'])app.run('go('+JSON.stringify(screen)+')');
  assert.equal(app.run('state.settings.openingBalance'),4321.55);
  assert.equal(app.run('state.transactions[0].id'),'legacy-transaction');
  assert.equal(storage.get('folio-data-v1'),original);
  assert.equal(storage.size,1);
});
