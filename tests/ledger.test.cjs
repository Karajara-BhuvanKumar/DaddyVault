const {test}=require('node:test');
const assert=require('node:assert/strict');
const F=require('../dist/ledger.js');
const date='2025-01-15';
const tx=(id,type,amount,extra={})=>({id,type,amount,name:'Example',date,accountId:'cash',category:type==='income'?'Salary':'Food & drinks',paymentMethod:'Cash',notes:'',...extra});
function setup(){const s=F.emptyState();s.accounts.push({id:'bank',name:'Bank',type:'Bank Account',openingBalance:0,archived:false});return s;}
function goal(s){s.goals.push({id:'goal1',name:'Emergency fund',type:'savings',target:20000,monthlyTarget:1000,startDate:'2025-01-01',targetDate:'2027-01-01',notes:'',archived:false});}
function holding(s){s.holdings.push({id:'fund',name:'Fund',symbol:'F',asset:'Mutual funds',openingUnits:0,openingCost:0,openingDate:'2025-01-01',price:120,date,notes:''});}
test('spec 1–3: income, expense and transfer update accounts without double-counting',()=>{
 const s=setup();s.transactions.push(tx('a','income',10000));F.validate(s);assert.equal(F.summary(s,'2025-01').cash,10000);
 s.transactions.push(tx('b','expense',2000));assert.equal(F.summary(s,'2025-01').cash,8000);
 s.transactions.push(tx('c','transfer',1000,{toAccountId:'bank'}));F.validate(s);const n=F.summary(s,'2025-01');assert.equal(n.accounts[0].balance,7000);assert.equal(n.accounts[1].balance,1000);assert.equal(n.cash,8000);assert.equal(n.income,10000);assert.equal(n.expense,2000);
});
test('spec 4: savings allocations have 25% progress and do not create cash or net worth',()=>{
 const s=setup();goal(s);s.transactions=[tx('a','income',10000),tx('b','contribution',5000,{goalId:'goal1'})];F.validate(s);const n=F.calculate(s);assert.equal(F.goal(s,s.goals[0]).pct,25);assert.equal(n.cash,10000);assert.equal(n.available,5000);assert.equal(n.netWorth,10000);assert.equal(n.savings,5000);
 s.transactions.push(tx('c','withdrawal',2000,{goalId:'goal1'}));F.validate(s);assert.equal(F.calculate(s).allocated,3000);
 s.transactions.push(tx('d','withdrawal',4000,{goalId:'goal1'}));assert.throws(()=>F.validate(s),/Withdrawal exceeds/);
});
test('spec 5: purchase moves cash into assets; valuation gives 20% unrealized return',()=>{
 const s=setup();holding(s);s.accounts[0].openingBalance=20000;s.transactions=[tx('a','buy',10000,{holdingId:'fund',units:100})];F.validate(s);const n=F.calculate(s);assert.equal(n.cash,10000);assert.equal(n.value,12000);assert.equal(n.gain,2000);assert.equal(n.returnPct,20);assert.equal(n.netWorth,22000);assert.equal(F.summary(s,'2025-01').expense,0);
});
test('spec 6–7: budget utilization and expense edits/deletes recalculate',()=>{
 const s=setup();s.accounts[0].openingBalance=10000;s.budgets=[{id:'b1',category:'Food & drinks',month:'2025-01',limit:5000}];s.transactions=[tx('a','expense',2000)];F.validate(s);let b=F.budget(s,s.budgets[0],'2025-01');assert.equal(b.pct,40);assert.equal(b.remaining,3000);
 s.transactions[0].amount=4000;b=F.budget(s,s.budgets[0],'2025-01');assert.equal(b.status,'75% reached');assert.equal(F.calculate(s).cash,6000);
 s.transactions[0].amount=4500;assert.equal(F.budget(s,s.budgets[0],'2025-01').status,'90% reached');s.transactions[0].amount=5001;assert.equal(F.budget(s,s.budgets[0],'2025-01').status,'Exceeded');
 s.transactions=[];assert.equal(F.calculate(s).cash,10000);assert.equal(F.budget(s,s.budgets[0],'2025-01').spent,0);
});
test('credit-card spending and repayment have one expense and correct debt/net worth',()=>{
 const s=setup();s.accounts[0].openingBalance=10000;s.accounts.push({id:'credit',name:'Credit',type:'Credit Card',openingBalance:0,archived:false});s.transactions=[tx('a','expense',2000,{accountId:'credit'}),tx('b','repayment',1000,{toAccountId:'credit'})];F.validate(s);const n=F.summary(s,'2025-01');assert.equal(n.cash,9000);assert.equal(n.liabilities,1000);assert.equal(n.expense,2000);assert.equal(n.netWorth,8000);
});
test('partial sales use weighted cost, update cash, and reject overselling',()=>{
 const s=setup();holding(s);s.accounts[0].openingBalance=20000;s.transactions=[tx('a','buy',10000,{holdingId:'fund',units:100}),tx('b','buy',5000,{holdingId:'fund',units:50}),tx('c','sell',6000,{holdingId:'fund',units:50})];F.validate(s);let n=F.calculate(s);assert.equal(n.holdings[0].costBasis,10000);assert.equal(n.holdings[0].units,100);assert.equal(n.realized,1000);assert.equal(n.cash,11000);
 s.transactions.push(tx('d','sell',13000,{holdingId:'fund',units:100}));F.validate(s);assert.equal(F.calculate(s).cost,0);assert.equal(F.calculate(s).holdings[0].units,0);s.transactions[3].units=101;assert.throws(()=>F.validate(s),/Sale exceeds/);
});
test('historical edit/deletion cannot leave later oversales or underfunded allocations',()=>{
 const s=setup();holding(s);s.transactions=[tx('a','buy',1000,{units:10,holdingId:'fund',date:'2025-01-01'}),tx('b','sell',600,{units:5,holdingId:'fund',date:'2025-01-02'})];F.validate(s);s.transactions.shift();assert.throws(()=>F.validate(s),/Sale exceeds/);
 const x=setup();goal(x);x.transactions=[tx('a','income',6000),tx('b','contribution',5000,{goalId:'goal1'})];F.validate(x);x.transactions[0].amount=4000;assert.throws(()=>F.validate(x),/unallocated cash/);
});
test('allocations cannot be overdrawn from a different source account',()=>{const s=setup();goal(s);s.accounts[0].openingBalance=10000;s.transactions=[tx('a','contribution',5000,{goalId:'goal1'}),tx('b','withdrawal',1000,{goalId:'goal1',accountId:'bank'})];assert.throws(()=>F.validate(s),/Withdrawal exceeds/);});
test('investment goals also allocate existing cash without counting it twice',()=>{const s=setup();goal(s);s.goals[0].type='investment';s.accounts[0].openingBalance=6000;s.transactions=[tx('a','contribution',5000,{goalId:'goal1'})];F.validate(s);const n=F.calculate(s);assert.equal(n.allocated,5000);assert.equal(n.savings,0);assert.equal(n.netWorth,6000);});
test('monthly and overall budgets do not overlap in calculation',()=>{const s=setup();s.budgets=[{id:'b1',category:'Food & drinks',month:'*',limit:5000},{id:'b2',category:'Food & drinks',month:'2025-01',limit:7000},{id:'b3',category:'All expenses',month:'2025-01',limit:10000}];F.validate(s);assert.equal(F.monthlyBudgets(s,'2025-01').length,2);assert.equal(F.monthlyBudgets(s,'2025-02')[0].limit,5000);});
test('invalid dates, amounts, account links and duplicate IDs are rejected',()=>{for(const extra of [{amount:-1},{amount:0},{amount:.001},{date:'2025-02-30'},{date:'2099-01-01'},{accountId:'missing'}]){const s=setup();s.transactions=[tx('a','expense',1,extra)];assert.throws(()=>F.validate(s));}const s=setup();s.transactions=[tx('a','income',1),tx('a','income',1)];assert.throws(()=>F.validate(s));});
test('transfers cannot target the same account and credit repayments require a card',()=>{const s=setup();s.transactions=[tx('a','transfer',1,{toAccountId:'cash'})];assert.throws(()=>F.validate(s));s.transactions[0]=tx('a','repayment',1,{toAccountId:'bank'});assert.throws(()=>F.validate(s));});
test('archiving nonzero accounts is prevented',()=>{const s=setup();s.accounts[1].openingBalance=1;s.accounts[1].archived=true;assert.throws(()=>F.validate(s),/remaining balance/);});
test('v1 migration preserves cash, holdings and source records without extra debits',()=>{const old=require('../dist/core.js').sample(),before=JSON.stringify(old),n=F.migrate(old);assert.equal(n.version,2);assert.equal(F.calculate(n).cash,require('../dist/core.js').summary(old,F.dateString().slice(0,7)).cash);assert.equal(F.calculate(n).value,require('../dist/core.js').summary(old,F.dateString().slice(0,7)).value);assert.equal(JSON.stringify(old),before);assert.equal(n.accounts.find(a=>a.name==='Card').type,'Other');});
test('recurrence catches up, clamps month ends, and does not duplicate deleted occurrences',()=>{const s=setup();s.recurring=[{id:'r1',name:'Pay',frequency:'monthly',startDate:'2025-01-31',endDate:'2025-03-31',nextIndex:0,active:true,template:tx('template','income',100)}];assert.deepEqual(F.due(s,'2025-03-31').map(t=>t.date),['2025-01-31','2025-02-28','2025-03-31']);F.postDue(s,'2025-03-31');F.validate(s);assert.equal(s.transactions.length,3);F.postDue(s,'2025-03-31');assert.equal(s.transactions.length,3);s.transactions.pop();F.postDue(s,'2025-03-31');assert.equal(s.transactions.length,2);});
test('timezone, leap years and date presets are consistent',()=>{assert.equal(F.dateString(new Date('2025-01-01T20:00:00Z'),'Asia/Kolkata'),'2025-01-02');assert.equal(F.validDate('2024-02-29'),true);assert.equal(F.validDate('2025-02-29'),false);assert.deepEqual(F.range('week','2025-01-05'),{start:'2024-12-30',end:'2025-01-05'});assert.deepEqual(F.range('last-month','2025-01-15'),{start:'2024-12-01',end:'2024-12-31'});assert.equal(F.range('3-months','2025-01-15').start,'2024-11-01');assert.equal(F.range('6-months','2025-01-15').start,'2024-08-01');assert.throws(()=>F.range('custom','2025-01-01',{start:'2025-02-01',end:'2025-01-01'}));});
test('integer paise prevent floating-point money accumulation',()=>{const s=setup();s.transactions=[tx('a','income',.1),tx('b','income',.2)];assert.equal(F.calculate(s).cash,.3);assert.equal(F.summary(s,'2025-01').income,.3);});
