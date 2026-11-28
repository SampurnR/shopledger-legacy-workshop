const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const dates = require('../lib/dates');
const invoice = require('../lib/invoice');
const inventory = require('../lib/inventory');
const ledger = require('../lib/ledger');
const orders = require('../lib/orders');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');
const tax = require('../lib/tax');

function customer(overrides) {
  return { id: 1, openingBalance: 300, totalBilled: 100, totalSettled: 25, creditLimit: 500, ...overrides };
}

test('checkout applies the coupon cap before calculating mixed GST', () => {
  const items = [
    { price: 200, qty: 4, hsn: '1006' },
    { price: 400, qty: 4, hsn: '0405' }
  ];
  const { subtotal, discount, tax, total } = pricing.computeTotals(items, 'SAVE10');
  assert.deepEqual({ subtotal, discount, tax, total }, { subtotal: 2400, discount: 150, tax: 217.5, total: 2467.5 });
});

test('inventory keeps wholesale units reserved', () => {
  const products = [{ id: 1, name: 'Rice', stock: 10, reserved: 3 }];
  assert.equal(inventory.getSellableStock(products[0]), 7);
  assert.equal(inventory.check(products, [{ id: 1, qty: 8 }]).ok, false);
  inventory.reserve(products, [{ id: 1, qty: 1 }]);
  assert.deepEqual(products[0], { id: 1, name: 'Rice', stock: 9, reserved: 3 });
});

test('stock checks use the full sellable amount and combine repeated lines', () => {
  const products = [{ id: 1, name: 'Rice', stock: 10, reserved: 3 }];
  assert.equal(inventory.check(products, [{ id: 1, qty: 7 }]).ok, true);
  assert.equal(inventory.check(products, [{ id: 1, qty: 5 }, { id: '1', qty: 3 }]).ok, false);
});

test('cancellation restores physical stock and reverses khata exactly once', () => {
  const account = customer();
  const db = {
    products: [{ id: 1, stock: 6, reserved: 2 }],
    customers: [account],
    orders: [{ id: 10, items: [{ id: 1, qty: 4 }], customerId: 1, paymentMode: 'khata', total: 40 }]
  };
  assert.equal(orders.cancel(db, 10).ok, true);
  assert.equal(orders.cancel(db, 10).ok, false);
  assert.equal(account.totalBilled, 60);
  assert.deepEqual(db.products[0], { id: 1, stock: 10, reserved: 2 });
});

test('settlement amounts from the browser are added numerically', () => {
  const db = { customers: [customer({ totalSettled: '25' })], nextSettlementId: 1 };
  const result = ledger.recordSettlement(db, 1, '50.25', 'cash', 'Counter');
  assert.equal(result.ok, true);
  assert.equal(result.settlement.amount, 50.25);
  assert.equal(result.customer.totalSettled, 75.25);
  assert.equal(result.customer.balance, 324.75);
});

test('invalid settlement amounts leave the account and settlement IDs untouched', () => {
  const db = { customers: [customer()], settlements: [], nextSettlementId: 1 };
  const baseline = structuredClone(db);
  for (const amount of ['not money', 0, -10, true, [50], Infinity, 0.001]) {
    assert.equal(ledger.recordSettlement(db, 1, amount, 'cash', '').ok, false);
    assert.deepEqual(db, baseline);
  }
});

test('khata accepts a balance exactly at its credit limit', () => {
  const db = { customers: [customer()] };
  assert.equal(ledger.chargeOrderToKhata(db, 1, 125).ok, true);
  assert.equal(ledger.chargeOrderToKhata(db, 1, 0.01).ok, false);
});

test('khata enforces the same default and explicit zero limits the API displays', () => {
  const withDefault = { customers: [customer({ creditLimit: undefined })] };
  assert.equal(ledger.listCustomers(withDefault)[0].creditLimit, 5000);
  assert.equal(ledger.chargeOrderToKhata(withDefault, 1, 4625.01).ok, false);

  const withZero = { customers: [customer({ creditLimit: 0, openingBalance: 0, totalBilled: 0, totalSettled: 0 })] };
  assert.equal(ledger.listCustomers(withZero)[0].creditLimit, 0);
  assert.equal(ledger.chargeOrderToKhata(withZero, 1, 0.01).ok, false);
});

test('order dates sort chronologically and match inclusive filters across years', () => {
  const db = {
    orders: [
      { id: 1, date: '30/12/2021' },
      { id: 2, date: '31/12/2021' },
      { id: 3, date: '02/01/2022' },
      { id: 4, date: '02/01/2022' },
      { id: 5, date: '2022-02-01' }
    ]
  };
  assert.deepEqual(orders.list(db).map(order => order.id), [5, 4, 3, 2, 1]);
  assert.deepEqual(orders.list(db, { from: '2021-12-31', to: '02/01/2022' }).map(order => order.id), [4, 3, 2]);
  assert.equal(dates.getFiscalYear('2022-03-31'), 'FY21-22');
  assert.equal(dates.getFiscalYear('01/04/2022'), 'FY22-23');
});

test('GST uses the configured HSN prefix for a full code', () => {
  assert.equal(tax.getRateForItem({ hsn: '04051000' }), 0.12);
  assert.equal(tax.getRateForItem({ hsn: '10063090', gstRate: 0 }), 0);
});

test('allocated discounts and net line amounts add up to checkout totals', () => {
  const items = Array.from({ length: 3 }, () => ({ price: 10.1, qty: 1, hsn: '1006' }));
  const totals = pricing.computeTotals(items, 'WELCOME');
  const sum = key => pricing.round2(totals.lines.reduce((amount, line) => amount + line[key], 0));
  assert.equal(totals.discount, 1.52);
  assert.equal(sum('discount'), totals.discount);
  assert.equal(sum('net'), totals.total);
});

test('mixed GST totals do not depend on cart line order', () => {
  const items = ['1006', '0405', '0902'].map(hsn => ({ hsn, price: 2.06, qty: 1 }));
  const first = pricing.computeTotals(items, 'WELCOME');
  const reordered = pricing.computeTotals([items[0], items[2], items[1]], 'WELCOME');
  assert.equal(reordered.tax, first.tax);
  assert.equal(reordered.total, first.total);
});

test('identical gross amounts and GST rates allocate the same tax to each product after reordering', () => {
  const items = [2, 1].map(id => ({ id, hsn: '1006', price: 11.05, qty: 1 }));
  const taxesByProduct = cart => Object.fromEntries(
    pricing.computeTotals(cart, 'WELCOME').lines.map(line => [line.id, line.tax])
  );
  assert.deepEqual(taxesByProduct(items), taxesByProduct([...items].reverse()));
});

test('invoice matches a charged order and honors a stored discount without a coupon rule', () => {
  const items = [
    { name: 'Rice', price: 200, qty: 4, hsn: '1006' },
    { name: 'Ghee', price: 400, qty: 4, hsn: '0405' }
  ];
  const booked = pricing.computeTotals(items, 'SAVE10');
  const order = { id: 1, items, coupon: 'OLD-COUPON', ...booked };
  const figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, booked.discount);
  assert.equal(figures.tax, booked.tax);
  assert.equal(figures.total, booked.total);
  assert.deepEqual(figures.rows.map(row => row.gstPercent), [5, 12]);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 0);
  assert.equal(reports.getGstReconciliation({ orders: [{ ...order, tax: 0 }] }).mismatchCount, 1);
});

test('legacy invoices use the original checkout rounding and HSN lookup', () => {
  const items = ['1006', '0405', '0902'].map(hsn => ({ hsn, price: 2.06, qty: 1 }));
  const order = { items, subtotal: 6.18, discount: 0.31, tax: 0.69, total: 6.56, coupon: 'WELCOME' };
  assert.equal(invoice.computeInvoiceFigures(order).total, 6.56);
  assert.equal(reports.getGstReconciliation({ orders: [order] }).mismatchCount, 0);

  const fullCode = { items: [{ hsn: '04051000', price: 200, qty: 1 }], tax: 36, total: 236 };
  assert.equal(reports.getGstReconciliation({ orders: [fullCode] }).mismatchCount, 0);

  const untrimmedCode = { items: [{ hsn: '1006 ', price: 200, qty: 1 }], tax: 36, total: 236 };
  assert.equal(reports.getGstReconciliation({ orders: [untrimmedCode] }).mismatchCount, 0);
});

test('printed GST retains a fractional catalog rate', () => {
  const order = { id: 1, pricingVersion: 2, items: [{ gstRate: 0.025, price: 200, qty: 1 }], tax: 5, total: 205 };
  assert.equal(tax.getSlabPercent({ gstRate: 2.5 }), 2.5);
  assert.match(invoice.render(order), /2\.5%<\/td><td class="r">₹5\.00/);
});

test('a discounted invoice prints the taxable amount used for GST on each line', () => {
  const items = [{ hsn: '1006', price: 500, qty: 1 }, { hsn: '0405', price: 500, qty: 1 }];
  const order = { id: 1, items, discount: 100, tax: 76.5, total: 976.5 };
  const html = invoice.render(order);
  assert.match(html, /Taxable Amount<\/th>/);
  assert.match(html, /5%<\/td><td class="r">₹22\.50<\/td><td class="r"><strong>₹450\.00/);
  assert.match(html, /12%<\/td><td class="r">₹54\.00<\/td><td class="r"><strong>₹450\.00/);
});

const fixturePath = 'fixture-in-memory.json';

function loadStore(fakeFs) {
  const storePath = require.resolve('../lib/store');
  const store = {};
  const load = vm.compileFunction(fs.readFileSync(storePath, 'utf8'), ['require', 'exports', '__dirname']);
  load(name => {
    if (name === 'fs') return fakeFs;
    if (name === 'path') return { join: () => fixturePath };
    return require(name);
  }, store, __dirname);
  return store;
}

test('a failed database write leaves the previous snapshot intact', () => {
  const original = '{"orders":[]}';
  const files = new Map([[fixturePath, original]]);
  const store = loadStore({
    realpathSync: file => file,
    statSync: () => ({ mode: 0o100640 }),
    writeFileSync(file, content) {
      files.set(file, content.slice(0, 10));
      throw new Error('simulated partial write');
    },
    unlinkSync(file) {
      files.delete(file);
    }
  });

  assert.throws(() => store.write({ orders: [{ id: 1 }] }), /simulated partial write/);
  assert.deepEqual([...files], [[fixturePath, original]]);
});

for (const linked of [false, true]) {
  test('atomic writes preserve the ' + (linked ? 'database symlink and its target mode' : 'database file mode'), () => {
    const target = linked ? 'persistence/fixture.json' : fixturePath;
    const files = new Map([[target, { content: '{"orders":[]}', mode: 0o100640 }]]);
    if (linked) files.set(fixturePath, { target });
    const store = loadStore({
      realpathSync: file => files.get(file).target || file,
      statSync: file => ({ mode: files.get(file).mode }),
      writeFileSync(file, content, options) {
        files.set(file, { content, mode: options.mode });
      },
      chmodSync(file, mode) {
        files.get(file).mode = mode;
      },
      renameSync(from, to) {
        assert.ok(from.startsWith(target + '.'));
        files.set(to, files.get(from));
        files.delete(from);
      },
      unlinkSync: file => files.delete(file)
    });

    store.write({ orders: [{ id: 1 }] });
    if (linked) assert.deepEqual(files.get(fixturePath), { target });
    assert.deepEqual(JSON.parse(files.get(target).content).orders, [{ id: 1 }]);
    assert.equal(files.get(target).mode, 0o640);
  });
}
