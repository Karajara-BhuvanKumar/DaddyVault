(function(root){
  'use strict';
  const categories=['Food & drinks','Shopping','Transport','Bills & rent','Entertainment','Health','Education','Other'];
  const incomeCategories=['Salary','Freelance','Gift','Other'];
  const assets=['Stocks','Mutual funds','Gold','Crypto','Fixed income','Other'];
  const round=n=>Math.round((n+Number.EPSILON)*100)/100;
  const dateString=(date=new Date())=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&dateString(new Date(s+'T12:00:00'))===s;
  function summary(state,month){
    const rows=state.transactions.filter(t=>t.date.startsWith(month));
    const sum=type=>round(rows.filter(t=>t.type===type).reduce((s,t)=>s+t.amount,0));
    const income=sum('income'),expense=sum('expense');
    const cash=round(state.settings.openingBalance+state.transactions.filter(t=>t.date<=dateString()).reduce((s,t)=>s+(t.type==='income'?t.amount:-t.amount),0));
    const cost=round(state.holdings.reduce((s,h)=>s+h.units*h.cost,0));
    const value=round(state.holdings.reduce((s,h)=>s+h.units*h.price,0));
    return {income,expense,cash,cost,value,gain:round(value-cost),returnPct:cost?(value-cost)/cost*100:0,net:round(income-expense),rows};
  }
  function spending(state,month,category){return round(state.transactions.filter(t=>t.type==='expense'&&t.date.startsWith(month)&&t.category===category).reduce((s,t)=>s+t.amount,0));}
  function emptyState(settings){return {version:1,demo:false,settings:settings||{name:'Bhuvan Kumar',currency:'INR',openingBalance:0},transactions:[],holdings:[],budgets:[]};}
  function sample(){
    const state=emptyState();state.demo=true;state.settings.openingBalance=12500;
    const now=new Date();const month=dateString(now).slice(0,7);const day=now.getDate();
    const data=[['Monthly allowance',18000,'income','Salary',1,'Bank'],['Design project',6500,'income','Freelance',6,'Bank'],['Rent & utilities',5500,'expense','Bills & rent',2,'Bank'],['Grocery run',1260,'expense','Food & drinks',4,'UPI'],['Weekend wardrobe',1890,'expense','Shopping',8,'Card'],['Coffee with friends',280,'expense','Food & drinks',12,'UPI'],['Spotify Premium',119,'expense','Entertainment',15,'Card'],['Uber ride',240,'expense','Transport',18,'UPI'],['Course subscription',799,'expense','Education',20,'Card'],['Lunch at the café',420,'expense','Food & drinks',23,'UPI'],['Amazon order',1299,'expense','Shopping',25,'Card'],['Fresh groceries',780,'expense','Food & drinks',27,'UPI'],['Movie night',450,'expense','Entertainment',28,'UPI'],['Evening coffee',180,'expense','Food & drinks',29,'UPI'],['Auto to campus',120,'expense','Transport',30,'Cash']];
    state.transactions=data.map((t,i)=>({id:'demo-t'+i,name:t[0],amount:t[1],type:t[2],category:t[3],date:month+'-'+String(Math.min(day,t[4])).padStart(2,'0'),account:t[5]}));
    state.holdings=[{id:'demo-h1',name:'Nifty 50 Index Fund',symbol:'N50',asset:'Mutual funds',units:400,cost:98,price:110,date:month+'-01'},{id:'demo-h2',name:'Tata Consultancy Services',symbol:'TCS',asset:'Stocks',units:8,cost:3500,price:3700,date:month+'-01'},{id:'demo-h3',name:'Gold ETF',symbol:'GOLD',asset:'Gold',units:200,cost:60,price:67,date:month+'-01'},{id:'demo-h4',name:'Fixed deposit',symbol:'FD',asset:'Fixed income',units:1,cost:13000,price:13650,date:month+'-01'}];
    state.budgets=[{category:'Food & drinks',limit:4500},{category:'Shopping',limit:4000},{category:'Transport',limit:1500},{category:'Entertainment',limit:1000},{category:'Bills & rent',limit:6500},{category:'Education',limit:1500}];return state;
  }
  function validate(s){
    if(!s||s.version!==1||typeof s.demo!=='boolean'||!s.settings||typeof s.settings.name!=='string'||s.settings.name.length>60||!['INR','USD','EUR','GBP'].includes(s.settings.currency)||!Number.isFinite(s.settings.openingBalance)||Math.abs(s.settings.openingBalance)>1e12)throw Error('Invalid profile in backup.');
    if(!Array.isArray(s.transactions)||!Array.isArray(s.holdings)||!Array.isArray(s.budgets)||s.transactions.length>50000||s.holdings.length>10000||s.budgets.length>categories.length)throw Error('Invalid records in backup.');
    const text=(v,max=100)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
    const num=(v,positive=false)=>typeof v==='number'&&Number.isFinite(v)&&v<1e12&&(positive?v>0:v>=0);
    const ids=new Set();
    for(const t of s.transactions){if(!text(t.id)||ids.has(t.id)||!text(t.name)||!num(t.amount,true)||!['income','expense'].includes(t.type)||!(t.type==='expense'?categories:incomeCategories).includes(t.category)||!validDate(t.date)||!['UPI','Card','Cash','Bank'].includes(t.account))throw Error('Invalid transaction in backup.');ids.add(t.id);}
    for(const h of s.holdings){if(!text(h.id)||ids.has(h.id)||!text(h.name)||typeof h.symbol!=='string'||h.symbol.length>12||!assets.includes(h.asset)||!num(h.units,true)||!num(h.cost)||!num(h.price)||h.units*Math.max(h.cost,h.price)>1e12||!validDate(h.date))throw Error('Invalid holding in backup.');ids.add(h.id);}
    const cats=new Set();for(const b of s.budgets){if(!categories.includes(b.category)||cats.has(b.category)||!num(b.limit,true))throw Error('Invalid budget in backup.');cats.add(b.category);}
    return s;
  }
  const api={categories,incomeCategories,assets,round,dateString,validDate,summary,spending,emptyState,sample,validate};
  if(typeof module!=='undefined')module.exports=api;else root.Folio=api;
})(typeof window!=='undefined'?window:globalThis);
