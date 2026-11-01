const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function bootSim() {
  const elements = new Map();
  const events = {};
  
  function getEl(sel) {
    if (!elements.has(sel)) {
      elements.set(sel, {
        tagName: sel.toUpperCase(),
        innerHTML: '',
        textContent: '',
        value: '',
        dataset: {},
        style: {},
        classList: {
          add: () => {},
          remove: () => {},
          toggle: () => {}
        },
        setAttribute: () => {},
        getAttribute: () => null,
        addEventListener: (evt, fn) => { events[evt] = fn; },
        showModal() { this.open = true; },
        close() { this.open = false; },
        focus() {},
        reset() { this.value = ''; }
      });
    }
    return elements.get(sel);
  }

  const storageMap = new Map();
  const context = vm.createContext({
    console,
    Intl,
    Date,
    Math,
    Number,
    String,
    Set,
    JSON,
    Error,
    crypto: require('node:crypto').webcrypto,
    FormData: class { constructor(form) { return Object.entries(form.data || {}); } },
    Blob,
    URL,
    setTimeout: (fn) => 1,
    clearTimeout: () => {},
    document: {
      querySelector: getEl,
      querySelectorAll: (sel) => [],
      getElementById: (id) => getEl('#' + id),
      addEventListener: (type, fn) => { events[type] = fn; },
      body: getEl('body')
    },
    localStorage: {
      getItem: (k) => storageMap.get(k) || null,
      setItem: (k, v) => storageMap.set(k, v)
    },
    location: { hash: '', protocol: 'file:' },
    window: null
  });
  context.window = context;
  context.scrollTo = () => {};
  context.addEventListener = () => {};
  context.history = { replaceState() {} };

  for (const f of ['core.js', 'ledger.js', 'storage.js', 'app.js', 'features.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../dist', f), 'utf8'), context);
  }
  await new Promise(r => setImmediate(r));

  return {
    context,
    run: code => vm.runInContext(code, context),
    submit: (kind, data, id = '') => events.submit({ preventDefault() {}, target: { dataset: { kind, id }, data } }),
    click: dataset => events.click({ target: { closest() { return { dataset }; } } }),
    getEl
  };
}

test('Full Real User Simulation: End-to-end multi-account, transfers, budgets, credit cards, investments, goals and reports', async () => {
  const sim = await bootSim();

  // 1. Initial State
  assert.equal(sim.run('current().cash'), 0);
  assert.equal(sim.run('current().netWorth'), 0);
  assert.equal(sim.run('state.transactions.length'), 0);

  // 2. Add Income (Salary 50,000)
  await sim.submit('entry', {
    type: 'income',
    name: 'Tech Salary',
    amount: '50000',
    category: 'Salary',
    date: '2026-11-01',
    accountId: 'cash',
    paymentMethod: 'UPI',
    notes: 'Monthly salary',
    repeat: 'One time'
  });
  assert.equal(sim.run('current().cash'), 50000);
  assert.equal(sim.run('current().netWorth'), 50000);
  assert.equal(sim.run('current().available'), 50000);
  assert.equal(sim.run('F.summary(state, "2026-11").income'), 50000);

  // 3. Add Bank Account
  await sim.submit('account', {
    name: 'HDFC Bank',
    type: 'Bank Account',
    openingBalance: '20000'
  });
  const bankId = sim.run('state.accounts[1].id');
  assert.equal(sim.run('current().cash'), 70000);
  assert.equal(sim.run('current().accounts.find(a=>a.name==="HDFC Bank").balance'), 20000);

  // 4. Transfer Cash -> HDFC Bank
  await sim.submit('entry', {
    type: 'transfer',
    name: 'Cash to Bank transfer',
    amount: '15000',
    date: '2026-11-01',
    accountId: 'cash',
    toAccountId: bankId,
    paymentMethod: 'Bank transfer',
    notes: ''
  });
  assert.equal(sim.run('current().accounts.find(a=>a.id==="cash").balance'), 35000);
  assert.equal(sim.run(`current().accounts.find(a=>a.id==="${bankId}").balance`), 35000);
  assert.equal(sim.run('current().cash'), 70000);
  assert.equal(sim.run('F.summary(state, "2026-11").income'), 50000);
  assert.equal(sim.run('F.summary(state, "2026-11").expense'), 0);

  // 5. Add Expenses
  await sim.submit('entry', {
    type: 'expense',
    name: 'House Rent',
    amount: '15000',
    category: 'Bills & rent',
    date: '2026-11-02',
    accountId: bankId,
    paymentMethod: 'Bank transfer',
    notes: 'Rent'
  });
  await sim.submit('entry', {
    type: 'expense',
    name: 'Supermarket Groceries',
    amount: '3500',
    category: 'Food & drinks',
    date: '2026-11-02',
    accountId: 'cash',
    paymentMethod: 'UPI',
    notes: 'Weekly food'
  });
  assert.equal(sim.run('F.summary(state, "2026-11").expense'), 18500);
  assert.equal(sim.run('F.summary(state, "2026-11").net'), 31500);
  assert.equal(sim.run('current().cash'), 51500);

  // 6. Budgets
  await sim.submit('budget', { category: 'Food & drinks', month: '2026-11', limit: '5000' });
  await sim.submit('budget', { category: 'Bills & rent', month: '2026-11', limit: '15000' });
  assert.equal(sim.run('F.budget(state, state.budgets[0], "2026-11").status'), 'On track');
  assert.equal(sim.run('F.budget(state, state.budgets[1], "2026-11").status'), '90% reached');

  // 7. Credit Card Purchase & Repayment
  await sim.submit('account', {
    name: 'Axis Credit Card',
    type: 'Credit Card',
    openingBalance: '0'
  });
  const cardId = sim.run('state.accounts[2].id');
  await sim.submit('entry', {
    type: 'expense',
    name: 'Monitor purchase',
    amount: '10000',
    category: 'Shopping',
    date: '2026-11-02',
    accountId: cardId,
    paymentMethod: 'Card',
    notes: ''
  });
  assert.equal(sim.run('current().liabilities'), 10000);
  assert.equal(sim.run('current().cash'), 51500);
  assert.equal(sim.run('current().netWorth'), 41500);
  assert.equal(sim.run('F.summary(state, "2026-11").expense'), 28500);

  // Repay 6000
  await sim.submit('entry', {
    type: 'repayment',
    name: 'Card bill repayment',
    amount: '6000',
    date: '2026-11-02',
    accountId: bankId,
    toAccountId: cardId,
    paymentMethod: 'Bank transfer',
    notes: ''
  });
  assert.equal(sim.run('current().liabilities'), 4000);
  assert.equal(sim.run('current().cash'), 45500);
  assert.equal(sim.run('current().netWorth'), 41500);
  assert.equal(sim.run('F.summary(state, "2026-11").expense'), 28500);

  // 8. Savings Goals
  await sim.submit('goal', {
    name: 'Emergency Fund',
    type: 'savings',
    target: '100000',
    monthlyTarget: '10000',
    startDate: '2026-01-01',
    targetDate: '2026-12-31',
    notes: ''
  });
  const goalId = sim.run('state.goals[0].id');
  await sim.submit('entry', {
    type: 'contribution',
    name: 'Save for emergency',
    amount: '20000',
    goalId,
    date: '2026-11-02',
    accountId: 'cash',
    paymentMethod: 'Allocation',
    notes: ''
  });
  assert.equal(sim.run('current().allocated'), 20000);
  assert.equal(sim.run('current().savings'), 20000);
  assert.equal(sim.run('current().available'), 25500);
  assert.equal(sim.run('current().cash'), 45500);
  assert.equal(sim.run('current().netWorth'), 41500);
  assert.equal(sim.run('F.goal(state, state.goals[0]).pct'), 20);

  // Withdraw 5000
  await sim.submit('entry', {
    type: 'withdrawal',
    name: 'Emergency withdrawal',
    amount: '5000',
    goalId,
    date: '2026-11-02',
    accountId: 'cash',
    paymentMethod: 'Allocation',
    notes: ''
  });
  assert.equal(sim.run('current().allocated'), 15000);
  assert.equal(sim.run('current().available'), 30500);
  assert.equal(sim.run('current().cash'), 45500);

  // 9. Investments
  await sim.submit('holding', {
    name: 'Nifty Index Fund',
    symbol: 'NIFTY',
    asset: 'Mutual funds',
    mode: 'purchase',
    units: '100',
    cost: '100',
    price: '110',
    date: '2026-11-02',
    openingDate: '2026-11-01',
    accountId: 'cash',
    notes: ''
  });
  const holdingId = sim.run('state.holdings[0].id');
  assert.equal(sim.run('current().cash'), 35500);
  assert.equal(sim.run('current().holdings[0].units'), 100);
  assert.equal(sim.run('current().holdings[0].costBasis'), 10000);
  assert.equal(sim.run('current().holdings[0].value'), 11000);
  assert.equal(sim.run('current().gain'), 1000);
  assert.equal(sim.run('current().netWorth'), 42500);

  // Partial sale: 40 units for 5000
  await sim.submit('entry', {
    type: 'sell',
    name: 'Sell Nifty units',
    holdingId,
    units: '40',
    amount: '5000',
    date: '2026-11-02',
    accountId: 'cash',
    paymentMethod: 'Bank transfer',
    notes: ''
  });
  assert.equal(sim.run('current().holdings[0].units'), 60);
  assert.equal(sim.run('current().holdings[0].costBasis'), 6000);
  assert.equal(sim.run('current().cash'), 40500);
  assert.equal(sim.run('current().realized'), 1000);

  // 10. Edit & Delete Lifecycle of Expense
  const groceryTx = sim.run('state.transactions.find(t=>t.name==="Supermarket Groceries")');
  await sim.submit('entry', {
    ...groceryTx,
    amount: '4000'
  }, groceryTx.id);
  assert.equal(sim.run('current().cash'), 40000);
  assert.equal(sim.run('F.spending(state, "2026-11", "Food & drinks")'), 4000);

  // Delete Groceries transaction
  await sim.run(`change(s=>{ s.transactions = s.transactions.filter(t=>t.id!=="${groceryTx.id}"); })`);
  assert.equal(sim.run('current().cash'), 44000);
  assert.equal(sim.run('F.spending(state, "2026-11", "Food & drinks")'), 0);

  // 11. Enforce Accounting Protections
  // A. Overselling units
  let oversellError = false;
  try {
    await sim.submit('entry', {
      type: 'sell',
      name: 'Oversell',
      holdingId,
      units: '100',
      amount: '10000',
      date: '2026-11-02',
      accountId: 'cash',
      paymentMethod: 'Bank transfer',
      notes: ''
    });
  } catch (e) {
    oversellError = true;
  }
  assert.ok(oversellError || sim.getEl('#app-error').innerHTML.includes('Sale exceeds'), 'Overselling should be rejected');

  // B. Over-withdrawal from goal
  let overwithdrawError = false;
  try {
    await sim.submit('entry', {
      type: 'withdrawal',
      name: 'Overwithdraw',
      goalId,
      amount: '20000',
      date: '2026-11-02',
      accountId: 'cash',
      paymentMethod: 'Allocation',
      notes: ''
    });
  } catch (e) {
    overwithdrawError = true;
  }
  assert.ok(overwithdrawError || sim.getEl('#app-error').innerHTML.includes('Withdrawal exceeds'), 'Overwithdrawal should be rejected');

  // C. Transfer to same account
  let sameAccountError = false;
  try {
    await sim.submit('entry', {
      type: 'transfer',
      name: 'Same account transfer',
      amount: '1000',
      date: '2026-11-02',
      accountId: 'cash',
      toAccountId: 'cash',
      paymentMethod: 'Bank transfer',
      notes: ''
    });
  } catch (e) {
    sameAccountError = true;
  }
  assert.ok(sameAccountError || sim.getEl('#app-error').innerHTML.includes('two different'), 'Same account transfer should be rejected');

  // 12. Recurring Schedules
  await sim.submit('recurring', {
    name: 'Broadband Internet',
    type: 'expense',
    category: 'Bills & rent',
    amount: '1200',
    accountId: 'cash',
    paymentMethod: 'UPI',
    notes: 'WiFi',
    frequency: 'monthly',
    startDate: '2026-10-01',
    endDate: '2026-12-31'
  });
  assert.ok(sim.run('F.due(state, "2026-11-02").length >= 2'), 'Should have at least 2 occurrences due (Oct and Nov)');
  const beforePostCount = sim.run('state.transactions.length');
  const cashBeforePost = sim.run('current().cash');
  await sim.run('change(s=>F.postDue(s, "2026-11-02"))');
  assert.ok(sim.run('state.transactions.length') > beforePostCount);
  assert.ok(sim.run('current().cash') < cashBeforePost);

  // 13. Categories Management
  await sim.submit('category', {
    type: 'expense',
    name: 'Fitness',
    symbol: 'health'
  });
  assert.ok(sim.run('state.categories.expense.includes("Fitness")'));
  await sim.submit('entry', {
    type: 'expense',
    name: 'Gym membership',
    amount: '1500',
    category: 'Fitness',
    date: '2026-11-02',
    accountId: 'cash',
    paymentMethod: 'UPI',
    notes: ''
  });
  // Rename category to Wellness
  await sim.submit('category', {
    original: 'Fitness',
    categoryType: 'expense',
    name: 'Wellness',
    symbol: 'health'
  });
  assert.ok(sim.run('state.categories.expense.includes("Wellness")'));
  assert.ok(!sim.run('state.categories.expense.includes("Fitness")'));
  const gymTx = sim.run('state.transactions.find(t=>t.name==="Gym membership")');
  assert.equal(gymTx.category, 'Wellness');

  // 14. CSV Export
  const csvContent = sim.run('csv(state.transactions)');
  assert.ok(csvContent.includes('"Tech Salary"'));
  assert.ok(csvContent.includes('"Gym membership"'));
  assert.ok(csvContent.includes('"Wellness"'));

  // 15. Settings & Profile
  await sim.submit('settings', {
    name: 'Bhuvan K.',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    dateFormat: 'YYYY-MM-DD',
    defaultAccount: 'cash'
  });
  assert.equal(sim.run('state.settings.name'), 'Bhuvan K.');
  assert.equal(sim.run('formatDate("2026-11-02")'), '2026-11-02');

  // 16. JSON Backup & Restore
  const backupJson = sim.run('JSON.stringify(state)');
  assert.ok(backupJson.length > 500);
  const parsedBackup = JSON.parse(backupJson);
  assert.equal(parsedBackup.settings.name, 'Bhuvan K.');

  // 17. Navigation & Rendering All 9 Screens
  for (const screen of ['overview', 'transactions', 'investments', 'budgets', 'settings', 'accounts', 'goals', 'reports', 'recurring']) {
    sim.run(`go("${screen}")`);
    const content = sim.getEl('#content').innerHTML;
    assert.ok(content.length > 50, `Screen ${screen} should render content`);
    assert.ok(!content.includes('NaN'), `Screen ${screen} should not have NaN`);
    assert.ok(!content.includes('undefined'), `Screen ${screen} should not have undefined`);
  }
});
