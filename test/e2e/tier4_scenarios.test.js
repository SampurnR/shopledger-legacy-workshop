var test = require('node:test');
var assert = require('node:assert/strict');
var h = require('./e2e_harness');

var describe = test.describe;
var it = test.it;
var before = test.before;
var after = test.after;
var beforeEach = test.beforeEach;

describe('Tier 4 — Realistic End-User Shop Workflows (T4-S1 to T4-S6)', function () {
  before(function () {
    return h.startServer();
  });

  after(function () {
    return h.stopServer();
  });

  beforeEach(function () {
    h.resetFixture();
  });

  it('T4-S1: Morning Retail Walk-In Counter Sale & GST Invoice Audit', async function () {
    var cat = await h.request('GET', '/api/products');
    assert.equal(cat.status, 200);
    assert.equal(cat.body.find(function (p) { return p.id === 1; }).gstPercent, 5);
    assert.equal(cat.body.find(function (p) { return p.id === 8; }).gstPercent, 18);

    var prev = await h.request('POST', '/api/pricing/preview', {
      items: [{ id: 1, qty: 2 }, { id: 8, qty: 2 }],
      coupon: 'SAVE10'
    });
    assert.equal(prev.status, 200);
    assert.equal(prev.body.totals.subtotal, 1560);
    assert.equal(prev.body.totals.discount, 150);
    assert.equal(prev.body.totals.tax, 103.4);
    assert.equal(prev.body.totals.total, 1513.4);

    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: 2 }, { id: 8, qty: 2 }],
      coupon: 'SAVE10',
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t4-s1') });
    assert.equal(order.status, 201);
    assert.equal(order.body.subtotal, prev.body.totals.subtotal);
    assert.equal(order.body.discount, prev.body.totals.discount);
    assert.equal(order.body.tax, prev.body.totals.tax);
    assert.equal(order.body.total, prev.body.totals.total);

    var inv = await h.request('GET', '/orders/' + order.body.id + '/invoice');
    assert.equal(inv.status, 200);
    assert.match(inv.text, new RegExp('INV-' + order.body.id));
    assert.match(inv.text, /₹1513\.40/);
    assert.equal(inv.text.indexOf('Accountant Reconciliation Notice'), -1);

    var recon = await h.request('GET', '/api/reports/gst-reconciliation');
    assert.equal(recon.status, 200);
    assert.equal(recon.body.mismatchCount, 0);

    var dash = await h.request('GET', '/api/reports/dashboard');
    assert.equal(dash.status, 200);
    assert.equal(dash.body.summary.grossRevenue, 11330.12);
  });

  it('T4-S2: Wholesale Khata Credit Limit, Sub-Paisa Guard, Settlement & Checkout', async function () {
    var custRes = await h.request('GET', '/api/customers');
    assert.equal(custRes.status, 200);
    var vikram = custRes.body.customers.find(function (c) { return c.id === 7; });
    var ramesh = custRes.body.customers.find(function (c) { return c.id === 6; });
    assert.equal(vikram.creditLimit, 10000);
    assert.equal(vikram.balance, 9000);
    assert.equal(ramesh.creditLimit, 0);

    var vikramOver = await h.request('POST', '/api/orders', {
      customerId: 7,
      paymentMode: 'khata',
      items: [{ id: 5, qty: 2 }, { id: 13, qty: 1 }],
      coupon: 'WHOLESALE15'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t4-s2-v1') });
    assert.equal(vikramOver.status, 409);

    var rameshOver = await h.request('POST', '/api/orders', {
      customerId: 6,
      paymentMode: 'khata',
      items: [{ id: 13, qty: 1 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t4-s2-r1') });
    assert.equal(rameshOver.status, 409);

    var badSettle = await h.request('POST', '/api/customers/7/settle', { amount: 0.004 });
    assert.equal(badSettle.status, 400);

    var goodSettle = await h.request('POST', '/api/customers/7/settle', {
      amount: '2500.555',
      mode: 'neft'
    });
    assert.equal(goodSettle.status, 201);
    assert.equal(goodSettle.body.settlement.amount, 2500.56);
    assert.equal(goodSettle.body.customer.balance, 6499.44);

    var vikramRetry = await h.request('POST', '/api/orders', {
      customerId: 7,
      paymentMode: 'khata',
      items: [{ id: 5, qty: 2 }, { id: 13, qty: 1 }],
      coupon: 'WHOLESALE15'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t4-s2-v2') });
    assert.equal(vikramRetry.status, 201);
    assert.equal(vikramRetry.body.total, 3043.35);

    var afterCust = await h.request('GET', '/api/customers');
    assert.equal(afterCust.body.customers.find(function (c) { return c.id === 7; }).balance, 9542.79);

    var afterProd = await h.request('GET', '/api/products');
    assert.equal(afterProd.body.find(function (p) { return p.id === 5; }).stock, 7);
    assert.equal(afterProd.body.find(function (p) { return p.id === 13; }).stock, 9);
  });

  it('T4-S3: Last-Unit Stockout, Customer Cancellation, Stock Restoration & Re-Order', async function () {
    var cat = await h.request('GET', '/api/products');
    var p11 = cat.body.find(function (p) { return p.id === 11; });
    var p14 = cat.body.find(function (p) { return p.id === 14; });
    assert.equal(p11.stock, 4);
    assert.equal(p11.reserved, 3);
    assert.equal(p11.sellable, 1);
    assert.equal(p14.gstPercent, 0);
    assert.equal(p14.sellable, 18);

    var pendingOrder = await h.request('POST', '/api/orders', {
      status: 'pending',
      paymentMode: 'cash',
      items: [{ id: 11, qty: 1 }, { id: 14, qty: 2 }],
      coupon: 'FLAT50'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t4-s3-1') });
    assert.equal(pendingOrder.status, 201);
    assert.equal(pendingOrder.body.subtotal, 720);
    assert.equal(pendingOrder.body.discount, 50);
    assert.equal(pendingOrder.body.tax, 24.57);
    assert.equal(pendingOrder.body.total, 694.57);

    var stockout = await h.request('POST', '/api/orders', {
      paymentMode: 'cash',
      items: [{ id: 11, qty: 1 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t4-s3-2') });
    assert.equal(stockout.status, 409);
    assert.match(stockout.body.error, /0 sellable available/);

    var cancel1 = await h.request('POST', '/api/orders/' + pendingOrder.body.id + '/cancel', {});
    assert.equal(cancel1.status, 200);

    var afterCancelProd = await h.request('GET', '/api/products');
    var p11After = afterCancelProd.body.find(function (p) { return p.id === 11; });
    var p14After = afterCancelProd.body.find(function (p) { return p.id === 14; });
    assert.equal(p11After.stock, 4);
    assert.equal(p11After.sellable, 1);
    assert.equal(p14After.stock, 20);
    assert.equal(p14After.sellable, 18);

    var cancel2 = await h.request('POST', '/api/orders/' + pendingOrder.body.id + '/cancel', {});
    assert.equal(cancel2.status, 400);

    var reorder = await h.request('POST', '/api/orders', {
      paymentMode: 'cash',
      items: [{ id: 11, qty: 1 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t4-s3-3') });
    assert.equal(reorder.status, 201);
    assert.equal(reorder.body.total, 246.4);
  });

  it('T4-S4: Double-Click Resilience & Validation Guardrail Journey', async function () {
    var badPrev = await h.request('POST', '/api/pricing/preview', {
      items: [{ id: 1, qty: 0 }]
    });
    assert.equal(badPrev.status, 400);

    var badOrderQty = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: 0 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t4-s4-badqty') });
    assert.equal(badOrderQty.status, 400);

    var badStatus = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: 1 }],
      customerId: 3,
      paymentMode: 'khata',
      status: 'cancelled'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t4-s4-badstatus') });
    assert.equal(badStatus.status, 400);

    var midProd = await h.request('GET', '/api/products');
    assert.equal(midProd.body.find(function (p) { return p.id === 1; }).stock, 18);
    var midCust = await h.request('GET', '/api/customers');
    assert.equal(midCust.body.customers.find(function (c) { return c.id === 3; }).balance, 0);

    var key = h.nextIdempotencyKey('t4-s4-place');
    var payload = {
      customerId: 3,
      paymentMode: 'khata',
      items: [{ id: 1, qty: 1 }]
    };
    var race = await Promise.all([
      h.request('POST', '/api/orders', payload, { 'Idempotency-Key': key }),
      h.request('POST', '/api/orders', payload, { 'Idempotency-Key': key })
    ]);
    var created = race.filter(function (r) { return r.status === 201; });
    assert.ok(created.length >= 1);
    var orderId = created[0].body.id;
    race.forEach(function (r) {
      assert.ok(r.status === 409 || ((r.status === 200 || r.status === 201) && r.body.id === orderId));
    });

    var afterOrders = await h.request('GET', '/api/orders');
    assert.equal(afterOrders.body.length, 12);
    var afterProd = await h.request('GET', '/api/products');
    assert.equal(afterProd.body.find(function (p) { return p.id === 1; }).stock, 17);
    var afterCust = await h.request('GET', '/api/customers');
    assert.equal(afterCust.body.customers.find(function (c) { return c.id === 3; }).balance, 672);
  });

  it('T4-S5: Accountant Month-End & Multi-Year Reconciliation Audit', async function () {
    var all = await h.request('GET', '/api/orders');
    assert.equal(all.status, 200);
    assert.deepEqual(
      all.body.map(function (o) { return o.id; }),
      [1011, 1010, 1009, 1008, 1007, 1006, 1005, 1004, 1003, 1002, 1001]
    );

    var jan2022 = await h.request('GET', '/api/orders?from=2022-01-01&to=2022-01-31');
    assert.equal(jan2022.status, 200);
    assert.deepEqual(jan2022.body.map(function (o) { return o.id; }), [1004, 1003, 1002]);

    var cancel1007 = await h.request('POST', '/api/orders/1007/cancel', {});
    assert.equal(cancel1007.status, 200);

    var cancelledOnly = await h.request('GET', '/api/orders?status=cancelled');
    assert.equal(cancelledOnly.status, 200);
    assert.deepEqual(cancelledOnly.body.map(function (o) { return o.id; }), [1010, 1007]);

    var recon = await h.request('GET', '/api/reports/gst-reconciliation');
    assert.equal(recon.status, 200);
    assert.equal(recon.body.totalChecked, 9);
    assert.equal(recon.body.mismatchCount, 0);

    var dash = await h.request('GET', '/api/reports/dashboard');
    assert.equal(dash.status, 200);
    assert.equal(dash.body.summary.cancelledCount, 2);
    assert.equal(dash.body.summary.pendingCount, 0);
    assert.equal(dash.body.summary.totalKhataReceivable, 12696.12);
  });

  it('T4-S6: Full Explicit-GST Zero/Twelve Catalog-to-Invoice Lifecycle', async function () {
    var cat = await h.request('GET', '/api/products?search=1006');
    assert.equal(cat.status, 200);
    assert.equal(cat.body.find(function (p) { return p.id === 1; }).gstPercent, 5);
    assert.equal(cat.body.find(function (p) { return p.id === 13; }).gstPercent, 12);
    assert.equal(cat.body.find(function (p) { return p.id === 14; }).gstPercent, 0);

    var prev = await h.request('POST', '/api/pricing/preview', {
      items: [{ id: 14, qty: 1 }, { id: 13, qty: 1 }],
      coupon: 'FLAT50'
    });
    assert.equal(prev.status, 200);
    assert.equal(prev.body.totals.subtotal, 1250);
    assert.equal(prev.body.totals.discount, 50);
    assert.equal(prev.body.totals.tax, 115.2);
    assert.equal(prev.body.totals.total, 1315.2);
    assert.equal(prev.body.totals.lines[0].gstPercent, 0);
    assert.equal(prev.body.totals.lines[1].gstPercent, 12);

    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 14, qty: 1 }, { id: 13, qty: 1 }],
      coupon: 'FLAT50',
      paymentMode: 'upi'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t4-s6') });
    assert.equal(order.status, 201);
    assert.equal(order.body.subtotal, 1250);
    assert.equal(order.body.discount, 50);
    assert.equal(order.body.tax, 115.2);
    assert.equal(order.body.total, 1315.2);
    assert.equal(order.body.items[0].gstRate, 0);
    assert.equal(order.body.items[1].gstRate, 12);

    var inv = await h.request('GET', '/orders/' + order.body.id + '/invoice');
    assert.equal(inv.status, 200);
    assert.match(inv.text, />0%</);
    assert.match(inv.text, />12%</);
    assert.match(inv.text, /₹1315\.20/);
    assert.equal(inv.text.indexOf('Accountant Reconciliation Notice'), -1);

    var recon = await h.request('GET', '/api/reports/gst-reconciliation');
    assert.equal(recon.status, 200);
    assert.equal(recon.body.totalChecked, 11);
    assert.equal(recon.body.mismatchCount, 0);
    assert.equal(recon.body.totalDelta, 0);
  });
});
