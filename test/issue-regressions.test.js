var test = require('node:test');
var assert = require('node:assert/strict');
var childProcess = require('node:child_process');
var fs = require('node:fs');
var os = require('node:os');
var path = require('node:path');
var testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shopledger-tests-'));
process.env.SHOPLEDGER_DB_FILE = path.join(testDir, 'db.json');
var inventory = require('../lib/inventory');
var pricing = require('../lib/pricing');
var orders = require('../lib/orders');
var ledger = require('../lib/ledger');
var invoice = require('../lib/invoice');
var dates = require('../lib/dates');
var store = require('../lib/store');
var app = require('../server');
var config = require('../config');
var server;

test.after(async function () {
  if (server) await new Promise(function (resolve) { server.close(resolve); });
  fs.rmSync(testDir, { recursive: true, force: true });
});

test('stock check permits selling the exact remaining sellable quantity', function () {
  var result = inventory.check([{ id: 6, name: 'Ghee', stock: 1, reserved: 0 }], [{ id: 6, qty: 1 }]);
  assert.deepEqual(result, { ok: true });
});

test('cancelling order items restores physical stock and leaves wholesale reservations alone', function () {
  var products = [{ id: 6, stock: 1, reserved: 0 }];
  inventory.release(products, [{ id: 6, qty: 2 }]);
  assert.equal(products[0].stock, 3);
  assert.equal(products[0].reserved, 0);
});

test('orders sort and filter by calendar date rather than DD/MM string order', function () {
  var db = { orders: [
    { id: 1001, date: '28/12/2021' },
    { id: 1004, date: '30/01/2022' },
    { id: 1007, date: '04/03/2022' },
    { id: 1008, date: '15/03/2022' }
  ] };
  assert.deepEqual(orders.list(db, {}).map(function (o) { return o.id; }), [1008, 1007, 1004, 1001]);
  assert.deepEqual(orders.list(db, { from: '2022-01-01', to: '2022-01-31' }).map(function (o) { return o.id; }), [1004]);
  assert.equal(dates.getFiscalYear('01/04/2022'), 'FY22-23');
  assert.equal(dates.getFiscalYear('31/03/2022'), 'FY21-22');
});

test('a string settlement amount is added numerically and rounded to paisa', function () {
  var db = { nextSettlementId: 505, settlements: [], customers: [{
    id: 1, name: 'Meera', openingBalance: 450, totalBilled: 1982.01, totalSettled: 1200
  }] };
  var result = ledger.recordSettlement(db, 1, '500', 'upi', '');
  assert.equal(result.ok, true);
  assert.equal(result.customer.totalSettled, 1700);
  assert.equal(result.customer.balance, 732.01);
  assert.equal(result.settlement.amount, 500);
});

test('settlements below one paisa are rejected without creating a receipt', function () {
  var db = { nextSettlementId: 1, settlements: [], customers: [{ id: 1, name: 'Meera', totalSettled: 0 }] };
  var result = ledger.recordSettlement(db, 1, 0.004, 'upi', '');
  assert.equal(result.ok, false);
  assert.equal(db.settlements.length, 0);
  assert.equal(db.customers[0].totalSettled, 0);
});

test('a zero khata limit is displayed as zero and blocks credit billing', function () {
  var db = { customers: [{ id: 1, name: 'Meera', creditLimit: 0, openingBalance: 0, totalBilled: 0, totalSettled: 0 }] };
  assert.equal(ledger.listCustomers(db)[0].creditLimit, 0);
  assert.equal(ledger.chargeOrderToKhata(db, 1, 1).ok, false);
});

test('invoice figures preserve the checkout HSN tax and coupon amounts', function () {
  var order = {
    id: 1002, subtotal: 1020, discount: 102, tax: 45.9, total: 963.9, coupon: 'SAVE10',
    items: [
      { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { id: 4, name: 'Oil', hsn: '1512', price: 190, qty: 2 }
    ]
  };
  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.subtotal, 1020);
  assert.equal(figures.discount, 102);
  assert.equal(figures.tax, 45.9);
  assert.equal(figures.total, 963.9);
  assert.deepEqual(figures.rows.map(function (row) { return row.gstPercent; }), [5, 5]);
});

test('legacy invoices preserve the sale-era GST slab when current config changes', function () {
  var previousRate = config.tax.hsnSlabs['1006'];
  var order = {
    id: 1001, subtotal: 100, discount: 0, tax: 5, total: 105,
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  };
  try {
    config.tax.hsnSlabs['1006'] = 18;
    var figures = invoice.computeInvoiceFigures(order);
    assert.equal(figures.rows[0].gstPercent, 5);
    assert.equal(figures.rows[0].lineTax, 5);
  } finally {
    config.tax.hsnSlabs['1006'] = previousRate;
  }
});

test('line discounts add up to the rounded order discount', function () {
  var totals = pricing.computeTotals([
    { id: 1, name: 'A', price: 50.05, qty: 1, hsn: '0902' },
    { id: 2, name: 'B', price: 50.05, qty: 1, hsn: '0902' }
  ], 'WELCOME');
  var lineDiscount = totals.lines.reduce(function (sum, line) { return sum + line.discount; }, 0);
  assert.equal(lineDiscount, totals.discount);
});

test('order item resolution rejects zero quantity and preserves explicit product GST', function () {
  var products = [{ id: 1, sku: 'SKU-1', name: 'Rice', hsn: '1006', price: 100, stock: 4, gstRate: 12 }];
  assert.equal(typeof orders.resolveItems, 'function');
  assert.equal(orders.resolveItems(products, [{ id: 1, qty: 0 }]).ok, false);
  var resolved = orders.resolveItems(products, [{ id: 1, qty: 1 }]);
  assert.equal(resolved.ok, true);
  assert.equal(resolved.items[0].gstRate, 12);
});

test('pending orders can be completed after dispatch', function () {
  var db = { orders: [{ id: 1007, status: 'pending' }] };
  assert.equal(typeof orders.complete, 'function');
  var result = orders.complete(db, 1007);
  assert.equal(result.ok, true);
  assert.equal(result.order.status, 'completed');
});

test('orders support request-id lookup and reject unsupported initial statuses', function () {
  var db = { nextOrderId: 1, orders: [] };
  var order = orders.add(db, { requestId: 'checkout-1', status: 'pending' });
  assert.equal(typeof orders.findByRequestId, 'function');
  assert.equal(typeof orders.isValidStatus, 'function');
  assert.equal(orders.findByRequestId(db, 'checkout-1'), order);
  assert.equal(orders.isValidStatus('completed'), true);
  assert.equal(orders.isValidStatus('pending'), true);
  assert.equal(orders.isValidStatus('cancelled'), false);
});

test('repeating a settlement request id does not bill the customer twice', function () {
  var db = { nextSettlementId: 1, settlements: [], customers: [{
    id: 1, name: 'Meera', openingBalance: 0, totalBilled: 0, totalSettled: 0
  }] };
  ledger.recordSettlement(db, 1, '500', 'upi', '', 'settlement-1');
  var duplicate = ledger.recordSettlement(db, 1, '500', 'upi', '', 'settlement-1');
  assert.equal(duplicate.duplicate, true);
  assert.equal(db.settlements.length, 1);
  assert.equal(db.customers[0].totalSettled, 500);
});

test('JSON updates are atomic and serialized across server processes', async function () {
  assert.equal(typeof store.withLock, 'function');
  store.write({ counter: 0 });
  var script = "var s=require(" + JSON.stringify(require.resolve('../lib/store')) + "); for(var i=0;i<20;i++) s.withLock(function(){var d=s.read();d.counter++;s.write(d);});";
  var workers = [];
  for (var i = 0; i < 4; i++) {
    workers.push(new Promise(function (resolve, reject) {
      var child = childProcess.spawn(process.execPath, ['-e', script], { env: process.env, stdio: 'ignore' });
      child.on('error', reject);
      child.on('exit', function (code) { code === 0 ? resolve() : reject(new Error('worker exit ' + code)); });
    }));
  }
  await Promise.all(workers);
  assert.equal(store.read().counter, 80);
});

test('order and settlement APIs validate input and make retried requests idempotent', async function () {
  store.write({
    nextOrderId: 1,
    nextSettlementId: 1,
    products: [
      { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, stock: 2, reserved: 0, gstRate: 12 },
      { id: 2, sku: 'GHEE-1', name: 'Ghee', hsn: '0405', price: 50, stock: 1, reserved: 0 },
      { id: 3, sku: 'OIL-1', name: 'Oil', hsn: '1512', price: 100, stock: 1, reserved: 0 }
    ],
    customers: [{ id: 1, name: 'Meera', creditLimit: 0, openingBalance: 0, totalBilled: 0, totalSettled: 0 }],
    orders: [], settlements: [], auditLog: []
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise(function (resolve) { server.once('listening', resolve); });
  var base = 'http://127.0.0.1:' + server.address().port;
  async function postJson(pathname, body) {
    return fetch(base + pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  var orderPayload = { items: [{ id: 1, qty: 2 }], status: 'pending', paymentMode: 'cash', requestId: 'checkout-1' };
  var orderResponse = await postJson('/api/orders', orderPayload);
  assert.equal(orderResponse.status, 201);
  var order = await orderResponse.json();
  assert.equal(order.items[0].gstRate, 12);
  assert.equal(order.items[0].lineTax, 24);
  var duplicateResponse = await postJson('/api/orders', orderPayload);
  assert.equal(duplicateResponse.status, 200);
  assert.equal((await duplicateResponse.json()).id, order.id);
  assert.equal((await postJson('/api/orders', {
    items: [{ id: 1, qty: 1 }], status: 'pending', paymentMode: 'cash', requestId: 'checkout-1'
  })).status, 409);
  assert.equal(store.read().products[0].stock, 0);
  assert.equal(store.read().orders.length, 1);

  var completeResponse = await postJson('/api/orders/' + order.id + '/complete', {});
  assert.equal(completeResponse.status, 200);
  assert.equal((await completeResponse.json()).status, 'completed');

  var badQuantity = await postJson('/api/orders', { items: [{ id: 2, qty: 0 }] });
  assert.equal(badQuantity.status, 400);
  var badStatus = await postJson('/api/orders', { items: [{ id: 2, qty: 1 }], status: 'cancelled' });
  assert.equal(badStatus.status, 400);

  var cancelPayload = { items: [{ id: 2, qty: 1 }], status: 'pending', requestId: 'checkout-2' };
  var cancelOrderResponse = await postJson('/api/orders', cancelPayload);
  assert.equal(cancelOrderResponse.status, 201);
  var cancelOrder = await cancelOrderResponse.json();
  assert.equal(store.read().products[1].stock, 0);
  assert.equal((await postJson('/api/orders/' + cancelOrder.id + '/cancel', {})).status, 200);
  assert.equal(store.read().products[1].stock, 1);

  var preview = await postJson('/api/pricing/preview', { items: [{ id: 1, qty: 1 }] });
  assert.equal((await preview.json()).totals.tax, 12);
  var zeroLimit = await postJson('/api/orders', { items: [{ id: 3, qty: 1 }], paymentMode: 'khata', customerId: 1 });
  assert.equal(zeroLimit.status, 409);
  assert.equal(store.read().products[2].stock, 1);

  var settlePayload = { amount: '0.50', mode: 'upi', requestId: 'settlement-1' };
  assert.equal((await postJson('/api/customers/1/settle', settlePayload)).status, 201);
  assert.equal((await postJson('/api/customers/1/settle', settlePayload)).status, 200);
  assert.equal((await postJson('/api/customers/1/settle', {
    amount: '0.75', mode: 'upi', requestId: 'settlement-1'
  })).status, 400);
  assert.equal(store.read().customers[0].totalSettled, 0.5);
  assert.equal(store.read().settlements.length, 1);
  assert.equal((await postJson('/api/customers/1/settle', { amount: 0.004, mode: 'upi' })).status, 400);
});
