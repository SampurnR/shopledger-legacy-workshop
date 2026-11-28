var test = require('node:test');
var assert = require('node:assert/strict');
var h = require('./e2e_harness');

var describe = test.describe;
var it = test.it;
var before = test.before;
var after = test.after;
var beforeEach = test.beforeEach;

describe('Tier 3 — Pairwise Feature Interaction Tests (T3-1 to T3-14)', function () {
  before(function () {
    return h.startServer();
  });

  after(function () {
    return h.stopServer();
  });

  beforeEach(function () {
    h.resetFixture();
  });

  it('T3-1 (F1+F10+F12): preview, Khata checkout, and invoice agree on SAVE10 + explicit gstRate 12', async function () {
    var prev = await h.request('POST', '/api/pricing/preview', {
      items: [{ id: 13, qty: 1 }],
      coupon: 'SAVE10'
    });
    assert.equal(prev.status, 200);
    assert.equal(prev.body.totals.subtotal, 1000);
    assert.equal(prev.body.totals.discount, 100);
    assert.equal(prev.body.totals.tax, 108);
    assert.equal(prev.body.totals.total, 1008);

    var order = await h.request('POST', '/api/orders', {
      customerId: 1,
      paymentMode: 'khata',
      items: [{ id: 13, qty: 1 }],
      coupon: 'SAVE10'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t3-1') });
    assert.equal(order.status, 201);
    assert.equal(order.body.total, 1008);

    var custRes = await h.request('GET', '/api/customers');
    var meera = custRes.body.customers.find(function (c) { return c.id === 1; });
    assert.equal(meera.balance, 2240.01);

    var inv = await h.request('GET', '/orders/' + order.body.id + '/invoice');
    assert.equal(inv.status, 200);
    assert.match(inv.text, /12%/);
    assert.match(inv.text, /₹1008\.00/);
    assert.equal(inv.text.indexOf('Accountant Reconciliation Notice'), -1);
  });

  it('T3-2 (F2+F3+F10): last-unit Khata order depletes stock, cancellation restores both stock and Khata for re-order', async function () {
    var order1 = await h.request('POST', '/api/orders', {
      customerId: 3,
      paymentMode: 'khata',
      items: [{ id: 6, qty: 1 }, { id: 11, qty: 1 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t3-2-a') });
    assert.equal(order1.status, 201);
    assert.equal(order1.body.total, 750.4);

    var midProd = await h.request('GET', '/api/products');
    assert.equal(midProd.body.find(function (p) { return p.id === 6; }).sellable, 0);
    assert.equal(midProd.body.find(function (p) { return p.id === 11; }).sellable, 0);

    var midCust = await h.request('GET', '/api/customers');
    assert.equal(midCust.body.customers.find(function (c) { return c.id === 3; }).balance, 750.4);

    var cancelRes = await h.request('POST', '/api/orders/' + order1.body.id + '/cancel', {});
    assert.equal(cancelRes.status, 200);

    var afterCancelProd = await h.request('GET', '/api/products');
    var p6 = afterCancelProd.body.find(function (p) { return p.id === 6; });
    var p11 = afterCancelProd.body.find(function (p) { return p.id === 11; });
    assert.equal(p6.stock, 1);
    assert.equal(p6.sellable, 1);
    assert.equal(p11.stock, 4);
    assert.equal(p11.sellable, 1);

    var afterCancelCust = await h.request('GET', '/api/customers');
    assert.equal(afterCancelCust.body.customers.find(function (c) { return c.id === 3; }).balance, 0);

    var reorder = await h.request('POST', '/api/orders', {
      customerId: 3,
      paymentMode: 'khata',
      items: [{ id: 6, qty: 1 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t3-2-b') });
    assert.equal(reorder.status, 201);
    assert.equal(reorder.body.total, 504);
  });

  it('T3-3 (F1+F2+F12): last-unit item + explicit gstRate 12 item + FLAT50 reconciles cleanly in GST audit', async function () {
    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 6, qty: 1 }, { id: 13, qty: 1 }],
      coupon: 'FLAT50',
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t3-3') });
    assert.equal(order.status, 201);
    assert.equal(order.body.subtotal, 1450);
    assert.equal(order.body.discount, 50);
    assert.equal(order.body.tax, 168);
    assert.equal(order.body.total, 1568);

    var recon = await h.request('GET', '/api/reports/gst-reconciliation');
    assert.equal(recon.status, 200);
    assert.equal(recon.body.totalChecked, 11);
    assert.equal(recon.body.mismatchCount, 0);
  });

  it('T3-4 (F4+F5+F3): newly placed order, cancelled #1007, date range and status filters preserve sort', async function () {
    var created = await h.request('POST', '/api/orders', {
      items: [{ id: 8, qty: 1 }],
      paymentMode: 'cash',
      status: 'pending'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t3-4') });
    assert.equal(created.status, 201);
    assert.equal(created.body.id, 1012);

    var cancelled = await h.request('POST', '/api/orders/1007/cancel', {});
    assert.equal(cancelled.status, 200);

    var cancelledRange = await h.request('GET', '/api/orders?from=2022-03-01&status=cancelled');
    assert.equal(cancelledRange.status, 200);
    assert.deepEqual(cancelledRange.body.map(function (o) { return o.id; }), [1010, 1007]);

    var fullRange = await h.request('GET', '/api/orders?from=2022-03-01');
    assert.equal(fullRange.status, 200);
    assert.deepEqual(fullRange.body.map(function (o) { return o.id; }), [1012, 1011, 1010, 1009, 1008, 1007]);
  });

  it('T3-5 (F6+F10+F11): credit limit rejection, sub-paisa rejection, rounded settlement, and Khata retry', async function () {
    var overLimit = await h.request('POST', '/api/orders', {
      customerId: 7,
      paymentMode: 'khata',
      items: [{ id: 13, qty: 1 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t3-5-over') });
    assert.equal(overLimit.status, 409);

    var badSettle = await h.request('POST', '/api/customers/7/settle', { amount: '0.004' });
    assert.equal(badSettle.status, 400);

    var goodSettle = await h.request('POST', '/api/customers/7/settle', { amount: '120.006', mode: 'upi' });
    assert.equal(goodSettle.status, 201);
    assert.equal(goodSettle.body.settlement.amount, 120.01);
    assert.equal(goodSettle.body.customer.balance, 8879.99);

    var retry = await h.request('POST', '/api/orders', {
      customerId: 7,
      paymentMode: 'khata',
      items: [{ id: 13, qty: 1 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t3-5-ok') });
    assert.equal(retry.status, 201);
    assert.equal(retry.body.total, 1120);

    var custRes = await h.request('GET', '/api/customers');
    var vikram = custRes.body.customers.find(function (c) { return c.id === 7; });
    assert.equal(vikram.balance, 9999.99);
  });

  it('T3-6 (F1+F12): explicit gstRate 0 with SAVE10 coupon renders 0% invoice and zero recon mismatch', async function () {
    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 14, qty: 2 }],
      coupon: 'SAVE10',
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t3-6') });
    assert.equal(order.status, 201);
    assert.equal(order.body.subtotal, 500);
    assert.equal(order.body.discount, 50);
    assert.equal(order.body.tax, 0);
    assert.equal(order.body.total, 450);

    var inv = await h.request('GET', '/orders/' + order.body.id + '/invoice');
    assert.equal(inv.status, 200);
    assert.match(inv.text, /0%/);
    assert.match(inv.text, /₹450\.00/);
    assert.equal(inv.text.indexOf('Accountant Reconciliation Notice'), -1);

    var recon = await h.request('GET', '/api/reports/gst-reconciliation');
    assert.equal(recon.body.mismatchCount, 0);
  });

  it('T3-7 (F3+F6+F10): Suresh cancels #1007, settles remaining balance, and places fresh Khata order', async function () {
    var cancelled = await h.request('POST', '/api/orders/1007/cancel', {});
    assert.equal(cancelled.status, 200);

    var settled = await h.request('POST', '/api/customers/4/settle', { amount: '200', mode: 'neft' });
    assert.equal(settled.status, 201);
    assert.equal(settled.body.customer.balance, 0);

    var newOrder = await h.request('POST', '/api/orders', {
      customerId: 4,
      paymentMode: 'khata',
      items: [{ id: 1, qty: 1 }, { id: 7, qty: 1 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t3-7') });
    assert.equal(newOrder.status, 201);
    assert.equal(newOrder.body.total, 963.2);

    var custRes = await h.request('GET', '/api/customers');
    var suresh = custRes.body.customers.find(function (c) { return c.id === 4; });
    assert.equal(suresh.balance, 963.2);

    var prodRes = await h.request('GET', '/api/products');
    assert.equal(prodRes.body.find(function (p) { return p.id === 6; }).stock, 3);
    assert.equal(prodRes.body.find(function (p) { return p.id === 4; }).stock, 22);
  });

  it('T3-8 (F7+F2+F10): concurrent duplicate Khata checkout on last sellable unit creates 1 order without negative stock', async function () {
    var key = h.nextIdempotencyKey('t3-8');
    var payload = {
      customerId: 3,
      paymentMode: 'khata',
      items: [{ id: 6, qty: 1 }]
    };
    var results = await Promise.all([
      h.request('POST', '/api/orders', payload, { 'Idempotency-Key': key }),
      h.request('POST', '/api/orders', payload, { 'Idempotency-Key': key })
    ]);
    var created = results.filter(function (r) { return r.status === 201; });
    assert.ok(created.length >= 1, 'Expected one 201 order');
    var orderId = created[0].body.id;
    results.forEach(function (r) {
      assert.ok(r.status === 409 || ((r.status === 200 || r.status === 201) && r.body.id === orderId));
    });

    var prodRes = await h.request('GET', '/api/products');
    var p6 = prodRes.body.find(function (p) { return p.id === 6; });
    assert.equal(p6.stock, 0);

    var custRes = await h.request('GET', '/api/customers');
    var priya = custRes.body.customers.find(function (c) { return c.id === 3; });
    assert.equal(priya.balance, 504);
  });

  it('T3-9 (F9+F2+F10): invalid initial status cancelled rejects 400 before last-unit stock or creditLimit 0 checks', async function () {
    var res = await h.request('POST', '/api/orders', {
      customerId: 6,
      paymentMode: 'khata',
      status: 'cancelled',
      items: [{ id: 6, qty: 1 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t3-9') });
    assert.equal(res.status, 400);

    var prodRes = await h.request('GET', '/api/products');
    assert.equal(prodRes.body.find(function (p) { return p.id === 6; }).stock, 1);

    var custRes = await h.request('GET', '/api/customers');
    assert.equal(custRes.body.customers.find(function (c) { return c.id === 6; }).balance, 0);

    var ordersRes = await h.request('GET', '/api/orders');
    assert.equal(ordersRes.body.length, 11);
  });

  it('T3-10 (F8+F12+F1): qty 0 with explicit gstRate 12 and SAVE10 fails 400 consistently in preview and checkout', async function () {
    var body = {
      items: [{ id: 13, qty: 0 }],
      coupon: 'SAVE10'
    };
    var prev = await h.request('POST', '/api/pricing/preview', body);
    assert.equal(prev.status, 400);

    var order = await h.request('POST', '/api/orders', Object.assign({ paymentMode: 'cash' }, body), {
      'Idempotency-Key': h.nextIdempotencyKey('t3-10')
    });
    assert.equal(order.status, 400);

    var prodRes = await h.request('GET', '/api/products');
    assert.equal(prodRes.body.find(function (p) { return p.id === 13; }).stock, 10);
  });

  it('T3-11 (F3+F1+F12): explicit gstRate 12 Khata order with SAVE10 updates dashboard, then cancel reverts all metrics', async function () {
    var order = await h.request('POST', '/api/orders', {
      customerId: 3,
      paymentMode: 'khata',
      items: [{ id: 13, qty: 4 }],
      coupon: 'SAVE10'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t3-11') });
    assert.equal(order.status, 201);
    assert.equal(order.body.total, 4312);

    var midDash = await h.request('GET', '/api/reports/dashboard');
    assert.equal(midDash.body.summary.grossRevenue, 14128.72);
    assert.equal(midDash.body.summary.reconciliationMismatchCount, 0);

    var cancelRes = await h.request('POST', '/api/orders/' + order.body.id + '/cancel', {});
    assert.equal(cancelRes.status, 200);

    var afterDash = await h.request('GET', '/api/reports/dashboard');
    assert.equal(afterDash.body.summary.grossRevenue, 9816.72);
    assert.equal(afterDash.body.summary.totalTaxCollected, 869.22);
    assert.equal(afterDash.body.summary.cancelledCount, 2);

    var custRes = await h.request('GET', '/api/customers');
    assert.equal(custRes.body.customers.find(function (c) { return c.id === 3; }).balance, 0);

    var prodRes = await h.request('GET', '/api/products');
    assert.equal(prodRes.body.find(function (p) { return p.id === 13; }).stock, 10);
  });

  it('T3-12 (F4+F5+F7): duplicate checkout retry leaves only 1 new order at index 0 in filtered and full history', async function () {
    var key = h.nextIdempotencyKey('t3-12');
    var payload = {
      items: [{ id: 3, qty: 1 }],
      paymentMode: 'cash'
    };
    var r1 = await h.request('POST', '/api/orders', payload, { 'Idempotency-Key': key });
    assert.equal(r1.status, 201);
    var r2 = await h.request('POST', '/api/orders', payload, { 'Idempotency-Key': key });
    assert.ok(r2.status === 409 || ((r2.status === 200 || r2.status === 201) && r2.body.id === r1.body.id));

    var filtered = await h.request('GET', '/api/orders?from=2023-02-26');
    assert.equal(filtered.status, 200);
    assert.equal(filtered.body.length, 1);
    assert.equal(filtered.body[0].id, r1.body.id);

    var all = await h.request('GET', '/api/orders');
    assert.equal(all.body[0].id, r1.body.id);
    assert.equal(all.body[1].id, 1011);
  });

  it('T3-13 (F6+F10): creditLimit 0 advance customer blocked at 0.01 over, unblocked after 0.01 settlement', async function () {
    var blocked = await h.request('POST', '/api/orders', {
      customerId: 8,
      paymentMode: 'khata',
      items: [{ id: 3, qty: 1 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t3-13-a') });
    assert.equal(blocked.status, 409);

    var settle = await h.request('POST', '/api/customers/8/settle', { amount: '0.01', mode: 'cash' });
    assert.equal(settle.status, 201);
    assert.equal(settle.body.customer.balance, -50.4);

    var allowed = await h.request('POST', '/api/orders', {
      customerId: 8,
      paymentMode: 'khata',
      items: [{ id: 3, qty: 1 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t3-13-b') });
    assert.equal(allowed.status, 201);

    var custRes = await h.request('GET', '/api/customers');
    var asha = custRes.body.customers.find(function (c) { return c.id === 8; });
    assert.equal(asha.balance, 0);
    assert.equal(asha.totalSettled, 50.4);
    assert.equal(asha.totalBilled, 50.4);
  });

  it('T3-14 (F8+F7): failed 400 qty 0 validation does not mutate state or block subsequent valid checkout', async function () {
    var bad = await h.request('POST', '/api/orders', {
      items: [{ id: 3, qty: 0 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t3-14-bad') });
    assert.equal(bad.status, 400);

    var goodWithKey = await h.request('POST', '/api/orders', {
      items: [{ id: 3, qty: 1 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t3-14-good') });
    assert.equal(goodWithKey.status, 201);

    var goodNoKey = await h.request('POST', '/api/orders', {
      items: [{ id: 2, qty: 1 }],
      paymentMode: 'cash'
    });
    assert.equal(goodNoKey.status, 201);
  });
});
