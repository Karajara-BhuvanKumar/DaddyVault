(function(root){
  'use strict';
  const legacy=typeof module!=='undefined'?require('./core.js'):root.Folio;
  const accountTypes=['Cash','Bank Account','Savings Account','UPI','Credit Card','Other'];
  const assets=['Stocks','Mutual funds','ETFs','Fixed Deposits','Gold','Cryptocurrency','Real Estate','Other'];
  const types=['income','expense','transfer','repayment','buy','sell','contribution','withdrawal'];
  const clone=s=>JSON.parse(JSON.stringify(s));
  const round=n=>Math.round((n+Number.EPSILON)*100)/100;
  const cents=n=>Math.round(n*100);
  const check=(condition,message)=>{if(!condition)throw Error(message);};
  const text=(v,max=100)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
  const finite=(v,min=0,max=1e10)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  const moneyOK=(v,positive=false)=>finite(v,positive?.01:0)&&Math.abs(v*100-Math.round(v*100))<.0001;
  const validDate=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)||s<'1900-01-01'||s>'9999-12-31')return false;const d=new Date(s+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;};
  function dateString(date=new Date(),timezone='Asia/Kolkata'){
    const p=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
    return ['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-');
  }
  function emptyState(settings={}){
    return {version:2,demo:false,settings:{name:'Bhuvan Kumar',currency:'INR',timezone:'Asia/Kolkata',dateFormat:'DD MMM YYYY',defaultAccount:'cash',...settings},accounts:[{id:'cash',name:'Cash',type:'Cash',openingBalance:settings.openingBalance||0,archived:false}],transactions:[],holdings:[],goals:[],budgets:[],recurring:[],categories:{income:[...legacy.incomeCategories],expense:[...legacy.categories]},categoryIcons:{},migrationNotes:[]};
  }
  function migrate(input){
    if(input.version===2)return validate(clone(input));
    legacy.validate(input);
    const s=emptyState(input.settings);s.demo=input.demo;
    const names=[...new Set(['Cash',...input.transactions.map(t=>t.account)])];
    s.accounts=names.map((name,i)=>({id:'legacy-account-'+i,name,type:name==='Bank'?'Bank Account':name==='Cash'?'Cash':name==='UPI'?'UPI':'Other',openingBalance:i===0?input.settings.openingBalance:0,archived:false}));
    s.settings.defaultAccount=s.accounts[0].id;
    s.transactions=input.transactions.map(t=>({...t,accountId:s.accounts.find(a=>a.name===t.account).id,paymentMethod:t.account,notes:''}));
    s.holdings=input.holdings.map(h=>({id:h.id,name:h.name,symbol:h.symbol,asset:h.asset==='Crypto'?'Cryptocurrency':h.asset==='Fixed income'?'Fixed Deposits':h.asset,openingUnits:h.units,openingCost:round(h.units*h.cost),openingDate:h.date,price:h.price,date:h.date,notes:'Imported pre-existing holding; cash was not deducted again.'}));
    s.budgets=input.budgets.map((b,i)=>({...b,id:'legacy-budget-'+i,month:'*'}));
    s.migrationNotes=['Legacy holdings are opening positions and do not debit cash again. Legacy Card entries remain an Other account: set its type and opening balance after reviewing history. Legacy budget limits recur monthly until replaced by a specific monthly limit.'];
    return validate(s);
  }
  function sample(){return migrate(legacy.sample());}
  const sorted=s=>s.transactions.map((t,i)=>({...t,_order:i})).sort((a,b)=>a.date.localeCompare(b.date)||a._order-b._order);
  function calculate(s,asOf=dateString(new Date(),s.settings.timezone)){
    const balances=Object.fromEntries(s.accounts.map(a=>[a.id,cents(a.openingBalance)])),accountNames=Object.fromEntries(s.accounts.map(a=>[a.id,a.name]));
    const positions=Object.fromEntries(s.holdings.map(h=>[h.id,{...h,units:h.openingDate<=asOf?h.openingUnits:0,basis:h.openingDate<=asOf?cents(h.openingCost):0,invested:h.openingDate<=asOf?cents(h.openingCost):0,realized:0}]));
    const allocations=Object.create(null),allocatedByAccount=Object.fromEntries(s.accounts.map(a=>[a.id,0])),goalAmounts=Object.fromEntries(s.goals.map(g=>[g.id,0]));
    for(const t of sorted(s)){
      if(t.date>asOf)continue;
      const n=cents(t.amount),a=t.accountId;
      check(Object.hasOwn(balances,a),'Transaction account is missing.');
      if(t.type==='income')balances[a]+=n;
      if(['expense','buy'].includes(t.type))balances[a]-=n;
      if(t.type==='sell')balances[a]+=n;
      if(['transfer','repayment'].includes(t.type)){balances[a]-=n;balances[t.toAccountId]+=n;}
      if(['buy','sell'].includes(t.type)){
        const p=positions[t.holdingId];check(p,'Investment is missing.');check(t.date>=p.openingDate,'Trade cannot precede the investment opening date.');
        if(t.type==='buy'){p.units+=t.units;p.basis+=n;p.invested+=n;}
        else {check(t.units<=p.units+1e-9,'Sale exceeds available investment units on '+t.date+'.');const sold=Math.abs(p.units-t.units)<1e-9?p.basis:Math.round(p.basis*t.units/p.units);p.units=Math.max(0,Number((p.units-t.units).toFixed(10)));p.basis-=sold;p.realized+=n-sold;}
      }
      if(['contribution','withdrawal'].includes(t.type)){
        const key=t.goalId+'|'+a,delta=t.type==='contribution'?n:-n;
        allocations[key]=(allocations[key]||0)+delta;goalAmounts[t.goalId]+=delta;allocatedByAccount[a]+=delta;
        check(allocations[key]>=0,'Withdrawal exceeds this goal’s allocation in the selected account on '+t.date+'.');
      }
      for(const accountId of new Set([a,...(t.toAccountId?[t.toAccountId]:[])])){
        check(Number.isSafeInteger(balances[accountId]),'Account total exceeds the supported monetary range.');
        check(allocatedByAccount[accountId]<=Math.max(0,balances[accountId]),'Not enough unallocated cash in '+accountNames[accountId]+' on '+t.date+'. Withdraw or reassign goal allocations first.');
      }
    }
    const accounts=s.accounts.map(a=>({...a,balance:balances[a.id]/100,allocated:allocatedByAccount[a.id]/100}));
    const holdings=Object.values(positions).map(p=>({...p,cost:p.units?p.basis/100/p.units:0,costBasis:p.basis/100,totalInvested:p.invested/100,realized:p.realized/100,value:round(p.units*p.price),gain:round(p.units*p.price-p.basis/100),returnPct:p.basis?(p.units*p.price*100-p.basis)/p.basis*100:0}));
    check(accounts.reduce((sum,a)=>sum+Math.abs(cents(a.balance)),0)<Number.MAX_SAFE_INTEGER&&holdings.reduce((sum,h)=>sum+Math.abs(cents(h.value))+Math.abs(h.basis),0)<Number.MAX_SAFE_INTEGER,'Portfolio total exceeds the supported monetary range.');
    const cash=round(accounts.filter(a=>a.type!=='Credit Card'&&!a.archived).reduce((sum,a)=>sum+a.balance,0));
    const allocated=round(Object.values(goalAmounts).reduce((sum,n)=>sum+n,0)/100);
    const savings=round(s.goals.filter(g=>g.type==='savings').reduce((sum,g)=>sum+goalAmounts[g.id],0)/100);
    const value=round(holdings.reduce((sum,h)=>sum+h.value,0)),cost=round(holdings.reduce((sum,h)=>sum+h.costBasis,0));
    return {accounts,holdings,allocations,goalAmounts,cash,allocated,savings,available:round(cash-allocated),value,cost,gain:round(value-cost),returnPct:cost?(value-cost)/cost*100:0,realized:round(holdings.reduce((sum,h)=>sum+h.realized,0)),liabilities:round(accounts.filter(a=>a.type==='Credit Card').reduce((sum,a)=>sum+Math.max(0,-a.balance),0)),netWorth:round(accounts.reduce((sum,a)=>sum+a.balance,0)+value)};
  }
  function period(month){return {start:month+'-01',end:month+'-'+new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).getUTCDate()};}
  function summary(s,scope){
    const range=typeof scope==='string'?period(scope):scope||period(dateString().slice(0,7));
    const rows=s.transactions.filter(t=>t.date>=range.start&&t.date<=range.end);
    const income=rows.filter(t=>t.type==='income').reduce((n,t)=>n+cents(t.amount),0)/100,expense=rows.filter(t=>t.type==='expense').reduce((n,t)=>n+cents(t.amount),0)/100;
    return {...calculate(s),rows,income,expense,net:round(income-expense),savingsRate:income?(income-expense)/income*100:0};
  }
  const spending=(s,month,category)=>summary(s,month).rows.filter(t=>t.type==='expense'&&(category==='All expenses'||t.category===category)).reduce((n,t)=>n+cents(t.amount),0)/100;
  function monthlyBudgets(s,month){const specific=s.budgets.filter(b=>b.month===month);return [...specific,...s.budgets.filter(b=>b.month==='*'&&!specific.some(x=>x.category===b.category))];}
  function budget(s,b,month){const spent=spending(s,month,b.category),pct=spent/b.limit*100;return {spent,remaining:round(b.limit-spent),pct,status:pct>100?'Exceeded':pct>=90?'90% reached':pct>=75?'75% reached':'On track'};}
  function goal(s,g){const n=calculate(s),amount=(n.goalAmounts[g.id]||0)/100;return {amount,remaining:Math.max(0,round(g.target-amount)),pct:amount/g.target*100};}
  function range(key,today,custom={}){
    const m=today.slice(0,7),y=Number(today.slice(0,4));let start=m+'-01',end=today;
    const shifted=delta=>new Date(Date.UTC(y,Number(today.slice(5,7))-1+delta,1)).toISOString().slice(0,10);
    if(key==='week'){const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);start=d.toISOString().slice(0,10);}
    if(key==='last-month'){start=shifted(-1);end=period(start.slice(0,7)).end;}
    if(key==='3-months')start=shifted(-2);
    if(key==='6-months')start=shifted(-5);
    if(key==='year')start=y+'-01-01';
    if(key==='custom'){start=custom.start;end=custom.end;}
    check(validDate(start)&&validDate(end)&&start<=end,'Choose a valid date range.');return {start,end};
  }
  function nextOccurrence(start,index,frequency){
    const d=new Date(start+'T12:00:00Z');
    if(frequency==='weekly')d.setUTCDate(d.getUTCDate()+7*index);
    else {const day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+index*(frequency==='yearly'?12:1));d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));}
    return d.toISOString().slice(0,10);
  }
  function due(s,today=dateString(new Date(),s.settings.timezone)){
    const out=[],queue=s.recurring.filter(r=>r.active).map(rule=>({rule,index:rule.nextIndex,date:nextOccurrence(rule.startDate,rule.nextIndex,rule.frequency)}));
    while(queue.length&&out.length<1000){
      queue.sort((a,b)=>a.date.localeCompare(b.date));const next=queue.shift(),{rule,index,date}=next;
      if(date>today||(rule.endDate&&date>rule.endDate))continue;
      out.push({...rule.template,id:'recurring-'+rule.id+'-'+date,date,recurringId:rule.id,occurrence:index});
      queue.push({rule,index:index+1,date:nextOccurrence(rule.startDate,index+1,rule.frequency)});
    }
    return out;
  }
  function postDue(s,today){const items=due(s,today);for(const t of items){if(!s.transactions.some(x=>x.id===t.id))s.transactions.push(t);const r=s.recurring.find(r=>r.id===t.recurringId);r.nextIndex=Math.max(r.nextIndex,t.occurrence+1);}return items.length;}
  function validate(s){
    check(s&&s.version===2&&typeof s.demo==='boolean','Unsupported data format.');
    check(s.settings&&text(s.settings.name,60)&&['INR','USD','EUR','GBP'].includes(s.settings.currency),'Invalid profile.');
    check(text(s.settings.timezone,100),'A timezone is required.');
    try{dateString(new Date(),s.settings.timezone);}catch{throw Error('Invalid timezone.');}
    check(['DD MMM YYYY','DD/MM/YYYY','YYYY-MM-DD'].includes(s.settings.dateFormat),'Invalid date format.');
    for(const key of ['accounts','transactions','holdings','goals','budgets','recurring'])check(Array.isArray(s[key])&&s[key].length<=50000,'Invalid '+key+'.');
    check(s.accounts.length>0&&s.accounts.length<=200,'Keep between 1 and 200 accounts.');
    check(s.categories&&['income','expense'].every(k=>Array.isArray(s.categories[k])&&s.categories[k].length>0&&s.categories[k].length<=100&&s.categories[k].every(c=>text(c,60))&&new Set(s.categories[k]).size===s.categories[k].length),'Invalid categories.');
    check(!s.categories.expense.includes('All expenses'),'All expenses is reserved for overall budgets.');
    check(s.categoryIcons&&typeof s.categoryIcons==='object'&&!Array.isArray(s.categoryIcons)&&Object.values(s.categoryIcons).every(v=>['other','food','shopping','transport','bills','entertainment','health','education','wallet'].includes(v)),'Invalid category icons.');
    check(Array.isArray(s.migrationNotes)&&s.migrationNotes.length<=10&&s.migrationNotes.every(n=>text(n,2000)),'Invalid migration notes.');
    const ids=new Set();for(const key of ['accounts','transactions','holdings','goals','budgets','recurring'])for(const x of s[key]){check(text(x.id,180)&&/^[a-zA-Z0-9_-]+$/.test(x.id)&&!ids.has(x.id),'Invalid or duplicate record ID.');ids.add(x.id);}
    for(const a of s.accounts)check(text(a.name,60)&&accountTypes.includes(a.type)&&finite(a.openingBalance,-1e10)&&Math.abs(a.openingBalance*100-Math.round(a.openingBalance*100))<.0001&&typeof a.archived==='boolean','Invalid account.');
    check(s.accounts.some(a=>a.id===s.settings.defaultAccount&&!a.archived),'Choose an active default account.');
    const today=dateString(new Date(),s.settings.timezone);
    for(const h of s.holdings)check(text(h.name)&&assets.includes(h.asset)&&finite(h.openingUnits)&&moneyOK(h.openingCost)&&finite(h.price)&&validDate(h.openingDate)&&validDate(h.date)&&h.date<=today&&h.openingDate<=today&&h.openingUnits*h.price<1e12&&typeof h.notes==='string'&&h.notes.length<=2000,'Invalid investment.');
    for(const g of s.goals)check(text(g.name)&&['savings','investment'].includes(g.type)&&moneyOK(g.target,true)&&moneyOK(g.monthlyTarget)&&validDate(g.startDate)&&validDate(g.targetDate)&&g.targetDate>=g.startDate&&typeof g.archived==='boolean'&&typeof g.notes==='string'&&g.notes.length<=2000,'Invalid goal or deadline.');
    const validateTransaction=(t,scheduled=false)=>{
      const account=s.accounts.find(a=>a.id===t.accountId);
      check(types.includes(t.type)&&text(t.name)&&moneyOK(t.amount,true)&&account&&validDate(t.date)&&(scheduled||t.date<=today),'Invalid transaction amount, date, title or account.');
      check(typeof t.notes==='string'&&t.notes.length<=2000&&typeof t.paymentMethod==='string'&&t.paymentMethod.length<=60,'Invalid transaction notes or payment method.');
      if(['income','expense'].includes(t.type))check(s.categories[t.type].includes(t.category),'Category is missing.');
      if(['transfer','repayment'].includes(t.type)){
        const dest=s.accounts.find(a=>a.id===t.toAccountId);check(dest&&dest.id!==account.id,'Choose two different accounts.');
        check(account.type!=='Credit Card','Credit-card cash advances are not supported.');
        check(t.type==='repayment'?dest.type==='Credit Card':dest.type!=='Credit Card','Use repayment for a credit-card destination.');
      }
      if(['buy','sell'].includes(t.type))check(account.type!=='Credit Card'&&s.holdings.some(h=>h.id===t.holdingId)&&finite(t.units,1e-8,1e10),'Invalid trade units, investment or funding account.');
      if(['contribution','withdrawal'].includes(t.type)){const g=s.goals.find(g=>g.id===t.goalId);check(account.type!=='Credit Card'&&g&&t.date>=g.startDate,'Invalid goal allocation account or date.');}
    };
    s.transactions.forEach(t=>validateTransaction(t));
    const budgetKeys=new Set();for(const b of s.budgets){const key=b.month+'|'+b.category;check((b.month==='*'||/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month))&&(b.category==='All expenses'||s.categories.expense.includes(b.category))&&moneyOK(b.limit,true)&&!budgetKeys.has(key),'Invalid or duplicate monthly budget.');budgetKeys.add(key);}
    for(const r of s.recurring){check(text(r.name)&&['weekly','monthly','yearly'].includes(r.frequency)&&validDate(r.startDate)&&(!r.endDate||(validDate(r.endDate)&&r.endDate>=r.startDate))&&typeof r.active==='boolean'&&Number.isInteger(r.nextIndex)&&r.nextIndex>=0&&r.nextIndex<=100000&&['income','expense'].includes(r.template?.type),'Invalid recurring schedule.');validateTransaction({...r.template,date:r.startDate},true);}
    const calculated=calculate(s);for(const a of calculated.accounts)check(!a.archived||(a.balance===0&&a.allocated===0),'Transfer the account’s remaining balance before archiving.');
    for(const g of s.goals)check(!g.archived||calculated.goalAmounts[g.id]===0,'Withdraw goal allocations before archiving.');
    return s;
  }
  const api={accountTypes,assets,types,clone,round,cents,validDate,dateString,emptyState,migrate,sample,validate,calculate,summary,spending,monthlyBudgets,budget,goal,period,range,nextOccurrence,due,postDue};
  if(typeof module!=='undefined')module.exports=api;else root.Vault=api;
})(typeof window!=='undefined'?window:globalThis);
