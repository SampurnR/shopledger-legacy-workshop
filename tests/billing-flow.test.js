var test = require('node:test');
var assert = require('node:assert/strict');
var store = require('../lib/store');
var app = require('../server');

// These replace both persistence entry points before any request is made.
// No fixture is loaded from disk, and every write stays in this object.
function fixture() {
  return {
    products: [{ id: 1, sku: 'TEST', name: 'Synthetic rice', hsn: '1006', gstRate: 12, price: 1000, stock: 20, reserved: 0 }],
    customers: [{ id: 1, name: 'Synthetic customer', creditLimit: 10000, openingBalance: 0, totalBilled: 0, totalSettled: 0 }],
    orders: [], settlements: [], auditLog: [], nextOrderId: 1001, nextSettlementId: 501
  };
}

test('in-memory billing HTTP workflows', async function (t) {
  var db = fixture();
  var writes = 0;
  t.mock.method(store, 'read', function () { return db; });
  t.mock.method(store, 'write', function (value) {
    assert.equal(value, db);
    writes++;
  });
  var server = app.listen(0, '127.0.0.1');
  t.after(function () { return new Promise(function (resolve) { server.close(resolve); }); });
  await new Promise(function (resolve, reject) {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  var base = 'http://127.0.0.1:' + server.address().port;

  async function request(path, body) {
    var response = await fetch(base + path, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    var text = await response.text();
    return { status: response.status, body: response.headers.get('content-type').indexOf('application/json') !== -1 ? JSON.parse(text) : text };
  }

  await t.test('preview, khata billing, invoice and reconciliation agree on discounted HSN GST', async function () {
    var body = { items: [{ id: 1, qty: 1 }], coupon: ' save10 ', paymentMode: 'khata', customerId: 1 };
    var preview = await request('/api/pricing/preview', body);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.totals.discount, 100);
    assert.equal(preview.body.totals.tax, 45);
    assert.equal(preview.body.totals.total, 945);
    var created = await request('/api/orders', body);
    assert.equal(created.status, 201);
    assert.equal(created.body.coupon, 'SAVE10');
    assert.equal(created.body.tax, 45);
    assert.equal(created.body.total, 945);
    // Product's explicit rate, calculated lines and split GST are not stored.
    assert.equal(Object.hasOwn(created.body.items[0], 'gstRate'), false);
    assert.equal(Object.hasOwn(created.body, 'lines'), false);
    assert.equal(Object.hasOwn(created.body, 'cgst'), false);
    assert.equal(db.customers[0].totalBilled, 945);
    assert.equal(db.customers[0].balance, 945);
    assert.equal(db.products[0].stock, 19);
    assert.equal(writes, 1);
    var printed = await request('/orders/1001/invoice');
    assert.equal(printed.status, 200);
    assert.match(printed.body, /Invoice Total<\/td><td class="r">₹945\.00/);
    assert.match(printed.body, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹45\.00/);
    assert.doesNotMatch(printed.body, /Accountant Reconciliation Notice/);
    var recon = await request('/api/reports/gst-reconciliation');
    assert.equal(recon.body.mismatchCount, 0);
    assert.equal(recon.body.totalDelta, 0);
    assert.equal(recon.body.rows[0].ledgerTax, 45);
    assert.equal(recon.body.rows[0].invoiceTax, 45);
    var dashboard = await request('/api/reports/dashboard');
    assert.equal(dashboard.body.summary.grossRevenue, 945);
    assert.equal(dashboard.body.summary.totalTaxCollected, 45);
    assert.equal(dashboard.body.summary.totalKhataReceivable, 945);
  });

  await t.test('CURRENT BEHAVIOUR: cancellation reverses billed khata but does not restore deducted stock', async function () {
    var cancelled = await request('/api/orders/1001/cancel', { reason: 'Synthetic cancellation' });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, 'cancelled');
    assert.equal(db.customers[0].totalBilled, 0);
    assert.equal(db.customers[0].balance, 0);
    assert.equal(db.products[0].stock, 19);
    var recon = await request('/api/reports/gst-reconciliation');
    assert.deepEqual(recon.body, { totalChecked: 0, mismatchCount: 0, totalDelta: 0, rows: [] });
    var printed = await request('/orders/1001/invoice');
    assert.equal(printed.status, 200);
    assert.match(printed.body, /CANCELLED/);
    assert.match(printed.body, /Invoice Total<\/td><td class="r">₹945\.00/);
    var repeated = await request('/api/orders/1001/cancel', {});
    assert.equal(repeated.status, 400);
    assert.match(repeated.body.error, /already cancelled/);
    assert.equal(writes, 2);
  });

  await t.test('CURRENT BEHAVIOUR: preview silently omits invalid coupon but order creation rejects it', async function () {
    db = fixture();
    writes = 0;
    var before = JSON.stringify(db);
    var body = { items: [{ id: 1, qty: 1 }], coupon: 'DIWALI20' };
    var preview = await request('/api/pricing/preview', body);
    assert.equal(preview.status, 200);
    assert.equal(preview.body.couponStatus.valid, false);
    assert.equal(preview.body.totals.discount, 0);
    assert.equal(preview.body.totals.total, 1050);
    var created = await request('/api/orders', body);
    assert.equal(created.status, 400);
    assert.equal(created.body.error, 'Coupon DIWALI20 has expired');
    assert.equal(JSON.stringify(db), before);
    assert.equal(writes, 0);
  });

  await t.test('CURRENT BEHAVIOUR: fractional preview quantities are truncated when billed', async function () {
    db = fixture();
    var body = { items: [{ id: 1, qty: 1.5 }] };
    var preview = await request('/api/pricing/preview', body);
    assert.equal(preview.body.totals.total, 1575);
    var created = await request('/api/orders', body);
    assert.equal(created.status, 201);
    assert.equal(created.body.items[0].qty, 1);
    assert.equal(created.body.total, 1050);
  });
});
