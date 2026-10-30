const {test}=require('node:test');
const assert=require('node:assert/strict');
const F=require('../dist/core.js');
const transaction=(id,amount,type,date='2026-01-15',category='Other')=>({id,name:'Example',amount,type,date,category,account:'Cash'});
test('cash includes opening balance and all past cash flows; monthly totals are scoped',()=>{
  const s=F.emptyState();s.settings.openingBalance=100;
  s.transactions=[transaction('1',1000,'income'),transaction('2',200,'expense'),transaction('3',50,'expense','2025-12-30'),transaction('4',500,'income','2099-01-01')];
  const result=F.summary(s,'2026-01');
  assert.equal(result.income,1000);assert.equal(result.expense,200);assert.equal(result.net,800);assert.equal(result.cash,850);
});
test('investment value and return use units and do not affect cash',()=>{
  const s=F.emptyState();s.holdings=[{units:4,cost:100,price:120},{units:2,cost:100,price:70}];
  const r=F.summary(s,'2026-01');assert.equal(r.cost,600);assert.equal(r.value,620);assert.equal(r.gain,20);assert.equal(r.cash,0);
});
test('empty portfolio has finite zero return',()=>{assert.equal(F.summary(F.emptyState(),'2026-01').returnPct,0);});
test('budgets count only expense category and selected month',()=>{
  const s=F.emptyState();s.transactions=[transaction('1',50,'expense','2026-01-15','Shopping'),transaction('2',60,'expense','2026-02-01','Shopping'),transaction('3',30,'income','2026-01-15','Other'),transaction('4',100,'expense','2026-01-15','Other')];
  assert.equal(F.spending(s,'2026-01','Shopping'),50);
});
test('decimal amounts are rounded for financial totals',()=>{
  const s=F.emptyState();s.transactions=[transaction('1',.1,'expense'),transaction('2',.2,'expense')];assert.equal(F.summary(s,'2026-01').expense,.3);
});
test('sample data and empty account validate',()=>{F.validate(F.sample());F.validate(F.emptyState());});
test('invalid, duplicate and malicious record shapes are rejected',()=>{
  const s=F.sample();s.transactions[0].amount=-1;assert.throws(()=>F.validate(s));
  const a=F.sample();a.transactions[1].id=a.transactions[0].id;assert.throws(()=>F.validate(a));
  const b=F.sample();b.holdings[0].units=Infinity;assert.throws(()=>F.validate(b));
  const c=F.sample();c.budgets.push(c.budgets[0]);assert.throws(()=>F.validate(c));
  const d=F.sample();d.transactions[0].date='2026-02-30';assert.throws(()=>F.validate(d));
});
test('date validation respects leap years',()=>{assert.equal(F.validDate('2024-02-29'),true);assert.equal(F.validDate('2025-02-29'),false);assert.equal(F.validDate('bad'),false);});
