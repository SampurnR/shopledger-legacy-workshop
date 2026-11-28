var test = require('node:test');
var assert = require('node:assert/strict');
var h = require('./e2e_harness');

var describe = test.describe;
var it = test.it;
var before = test.before;
var after = test.after;
var beforeEach = test.beforeEach;

describe('Tier 2 — Boundary, Corner & Negative Tests (F1-F12)', function () {
  before(function () {
    return h.startServer();
  });

  after(function () {
    return h.stopServer();
  });

  beforeEach(function () {
    h.resetFixture();
  });

  // =========================================================================
  // F1: Invoice, GST & Coupons Boundaries (6 tests)
  // =========================================================================
  it('T2-F1-1: expired coupon DIWALI20 is invalid in preview and rejected 400 at checkout', async function () {
    var prev = await h.request('POST', '/api/pricing/preview', {
      items: [{ id: 13, qty: 1 }],
      coupon: 'DIWALI20'
    });
    assert.equal(prev.status, 200);
    assert.equal(prev.body.couponStatus.valid, false);
    assert.equal(prev.body.totals.discount, 0);
    assert.equal(prev.body.totals.total, 1120);

    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 13, qty: 1 }],
      coupon: 'DIWALI20',
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f1-1') });
    assert.equal(order.status, 400);
    assert.match(order.body.error, /expired/i);
  });

  it('T2-F1-2: unknown coupon BOGUS99 is invalid in preview and rejected 400 at checkout', async function () {
    var prev = await h.request('POST', '/api/pricing/preview', {
      items: [{ id: 8, qty: 1 }],
      coupon: 'BOGUS99'
    });
    assert.equal(prev.status, 200);
    assert.equal(prev.body.couponStatus.valid, false);
    assert.equal(prev.body.totals.discount, 0);

    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 8, qty: 1 }],
      coupon: 'BOGUS99',
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f1-2') });
    assert.equal(order.status, 400);
    assert.ok(order.body.error);
  });

  it('T2-F1-3: SAVE10 rejects below minOrder 500 and succeeds at exact minOrder 500', async function () {
    var below = await h.request('POST', '/api/orders', {
      items: [{ id: 6, qty: 1 }],
      coupon: 'SAVE10',
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f1-3-below') });
    assert.equal(below.status, 400);
    assert.match(below.body.error, /500/);

    var exact = await h.request('POST', '/api/orders', {
      items: [{ id: 8, qty: 1 }, { id: 12, qty: 2 }],
      coupon: 'SAVE10',
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f1-3-exact') });
    assert.equal(exact.status, 201);
    assert.equal(exact.body.discount, 50);
    assert.equal(exact.body.tax, 81);
    assert.equal(exact.body.total, 531);
  });

  it('T2-F1-4: SAVE10 caps discount at maxDiscount 150 on high-value order', async function () {
    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 5, qty: 3 }],
      coupon: 'SAVE10',
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f1-4') });
    assert.equal(order.status, 201);
    assert.equal(order.body.subtotal, 3360);
    assert.equal(order.body.discount, 150);
    assert.equal(order.body.tax, 160.5);
    assert.equal(order.body.total, 3370.5);
  });

  it('T2-F1-5: FLAT50 rejects below minOrder 300 and WHOLESALE15 caps discount at 400', async function () {
    var below = await h.request('POST', '/api/orders', {
      items: [{ id: 8, qty: 1 }],
      coupon: 'FLAT50',
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f1-5-below') });
    assert.equal(below.status, 400);

    var capped = await h.request('POST', '/api/orders', {
      items: [{ id: 5, qty: 3 }],
      coupon: 'WHOLESALE15',
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f1-5-cap') });
    assert.equal(capped.status, 201);
    assert.equal(capped.body.discount, 400);
    assert.equal(capped.body.tax, 148);
    assert.equal(capped.body.total, 3108);
  });

  it('T2-F1-6: unknown invoice ID returns 404', async function () {
    var res = await h.request('GET', '/orders/99999/invoice');
    assert.equal(res.status, 404);
  });

  // =========================================================================
  // F2: Sellable Stock Check Boundaries (5 tests)
  // =========================================================================
  it('T2-F2-1: rejects qty = sellable + 1 when reserved is 0 without mutating stock', async function () {
    var res = await h.request('POST', '/api/orders', {
      items: [{ id: 6, qty: 2 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f2-1') });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /out of stock/i);
    assert.match(res.body.error, /1 sellable available/);

    var prodRes = await h.request('GET', '/api/products');
    var p6 = prodRes.body.find(function (p) { return p.id === 6; });
    assert.equal(p6.stock, 1);
  });

  it('T2-F2-2: rejects qty = sellable + 1 when reserved > 0 without mutating stock', async function () {
    var res = await h.request('POST', '/api/orders', {
      items: [{ id: 11, qty: 2 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f2-2') });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /1 sellable available/);

    var prodRes = await h.request('GET', '/api/products');
    var p11 = prodRes.body.find(function (p) { return p.id === 11; });
    assert.equal(p11.stock, 4);
  });

  it('T2-F2-3: rejects order for product with zero physical stock', async function () {
    var res = await h.request('POST', '/api/orders', {
      items: [{ id: 10, qty: 1 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f2-3') });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /0 sellable available/);
  });

  it('T2-F2-4: clamps reserved > stock to sellable 0 and rejects checkout', async function () {
    var prodRes = await h.request('GET', '/api/products');
    var p16 = prodRes.body.find(function (p) { return p.id === 16; });
    assert.equal(p16.sellable, 0);

    var res = await h.request('POST', '/api/orders', {
      items: [{ id: 16, qty: 1 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f2-4') });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /0 sellable available/);

    var afterProd = await h.request('GET', '/api/products');
    var p16After = afterProd.body.find(function (p) { return p.id === 16; });
    assert.equal(p16After.stock, 3);
  });

  it('T2-F2-5: aggregates duplicate product lines in same cart and rejects when sum exceeds sellable', async function () {
    var res = await h.request('POST', '/api/orders', {
      items: [{ id: 11, qty: 1 }, { id: 11, qty: 1 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f2-5') });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /1 sellable available/);

    var prodRes = await h.request('GET', '/api/products');
    var p11 = prodRes.body.find(function (p) { return p.id === 11; });
    assert.equal(p11.stock, 4);
  });

  // =========================================================================
  // F3: Order Cancel Stock Restoration Boundaries (5 tests)
  // =========================================================================
  it('T2-F3-1: double-cancel same order rejects second call with 400 and restores stock once', async function () {
    var c1 = await h.request('POST', '/api/orders/1007/cancel', {});
    assert.equal(c1.status, 200);

    var c2 = await h.request('POST', '/api/orders/1007/cancel', {});
    assert.equal(c2.status, 400);
    assert.match(c2.body.error, /already cancelled/i);

    var prodRes = await h.request('GET', '/api/products');
    var p6 = prodRes.body.find(function (p) { return p.id === 6; });
    assert.equal(p6.stock, 3);

    var custRes = await h.request('GET', '/api/customers');
    var suresh = custRes.body.customers.find(function (c) { return c.id === 4; });
    assert.equal(suresh.totalBilled, 0);
  });

  it('T2-F3-2: cancelling pre-cancelled order #1010 returns 400 without altering stock', async function () {
    var res = await h.request('POST', '/api/orders/1010/cancel', {});
    assert.equal(res.status, 400);
    assert.match(res.body.error, /already cancelled/i);

    var prodRes = await h.request('GET', '/api/products');
    var p2 = prodRes.body.find(function (p) { return p.id === 2; });
    assert.equal(p2.stock, 28);
  });

  it('T2-F3-3: cancelling unknown order ID returns 400 Order not found', async function () {
    var res = await h.request('POST', '/api/orders/9999/cancel', {});
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Order not found/i);
  });

  it('T2-F3-4: cancelling cash order for registered customer restores stock without touching Khata', async function () {
    var created = await h.request('POST', '/api/orders', {
      customerId: 1,
      paymentMode: 'cash',
      items: [{ id: 1, qty: 2 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f3-4') });
    assert.equal(created.status, 201);

    var cancelled = await h.request('POST', '/api/orders/' + created.body.id + '/cancel', {});
    assert.equal(cancelled.status, 200);

    var custRes = await h.request('GET', '/api/customers');
    var meera = custRes.body.customers.find(function (c) { return c.id === 1; });
    assert.equal(meera.balance, 1232.01);

    var prodRes = await h.request('GET', '/api/products');
    var p1 = prodRes.body.find(function (p) { return p.id === 1; });
    assert.equal(p1.stock, 18);
  });

  it('T2-F3-5: cancelling last-unit order makes last unit sellable again', async function () {
    var created = await h.request('POST', '/api/orders', {
      items: [{ id: 6, qty: 1 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f3-5') });
    assert.equal(created.status, 201);

    var midProd = await h.request('GET', '/api/products');
    var p6Mid = midProd.body.find(function (p) { return p.id === 6; });
    assert.equal(p6Mid.sellable, 0);

    var cancelled = await h.request('POST', '/api/orders/' + created.body.id + '/cancel', {});
    assert.equal(cancelled.status, 200);

    var afterProd = await h.request('GET', '/api/products');
    var p6After = afterProd.body.find(function (p) { return p.id === 6; });
    assert.equal(p6After.sellable, 1);
  });

  // =========================================================================
  // F4: Order History Chronological Sort Boundaries (5 tests)
  // =========================================================================
  it('T2-F4-1: same-day orders tie-break by ID descending', async function () {
    var res = await h.request('GET', '/api/orders?from=2023-02-25&to=2023-02-25');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map(function (o) { return o.id; }), [1011, 1010]);
  });

  it('T2-F4-2: avoids day-number lexicographical sort trap (28/12/2021 vs 05/01/2022 vs 02/01/2023)', async function () {
    var res = await h.request('GET', '/api/orders');
    assert.equal(res.status, 200);
    var ids = res.body.map(function (o) { return o.id; });
    assert.ok(ids.indexOf(1009) < ids.indexOf(1002));
    assert.ok(ids.indexOf(1002) < ids.indexOf(1001));
  });

  it('T2-F4-3: orders group strictly by descending calendar year 2023 > 2022 > 2021', async function () {
    var res = await h.request('GET', '/api/orders');
    assert.equal(res.status, 200);
    var years = res.body.map(function (o) { return Number(o.date.split('/')[2]); });
    for (var i = 1; i < years.length; i++) {
      assert.ok(years[i - 1] >= years[i], 'Expected descending year order');
    }
  });

  it('T2-F4-4: cancelled orders retain chronological position in unfiltered history', async function () {
    var res = await h.request('GET', '/api/orders');
    assert.equal(res.status, 200);
    assert.equal(res.body[1].id, 1010);
    assert.equal(res.body[1].status, 'cancelled');
  });

  it('T2-F4-5: unmatched search query returns empty array cleanly', async function () {
    var res = await h.request('GET', '/api/orders?search=nonexistent-xyz');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  // =========================================================================
  // F5: Order History Date-Range Filter Boundaries (6 tests)
  // =========================================================================
  it('T2-F5-1: exact single-day inclusive filter returns matching order', async function () {
    var res = await h.request('GET', '/api/orders?from=2022-01-14&to=2022-01-14');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map(function (o) { return o.id; }), [1003]);
  });

  it('T2-F5-2: inclusive range includes both from and to boundary orders', async function () {
    var res = await h.request('GET', '/api/orders?from=2022-01-05&to=2022-01-30');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map(function (o) { return o.id; }), [1004, 1003, 1002]);
  });

  it('T2-F5-3: cross-year boundary range filters accurately', async function () {
    var res = await h.request('GET', '/api/orders?from=2021-12-28&to=2022-01-05');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map(function (o) { return o.id; }), [1002, 1001]);
  });

  it('T2-F5-4: inverted date range returns empty array', async function () {
    var res = await h.request('GET', '/api/orders?from=2023-01-01&to=2022-01-01');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it('T2-F5-5: future date range returns empty array', async function () {
    var res = await h.request('GET', '/api/orders?from=2099-01-01&to=2099-12-31');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  it('T2-F5-6: mixed DD/MM/YYYY from and YYYY-MM-DD to formats work together', async function () {
    var res = await h.request('GET', '/api/orders?from=28/12/2021&to=2022-01-05');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map(function (o) { return o.id; }), [1002, 1001]);
  });

  // =========================================================================
  // F6: Khata Settlement Numeric Addition Boundaries (5 tests)
  // =========================================================================
  it('T2-F6-1: rejects zero settlement amount (number 0 and string "0")', async function () {
    var r1 = await h.request('POST', '/api/customers/1/settle', { amount: 0 });
    assert.equal(r1.status, 400);
    var r2 = await h.request('POST', '/api/customers/1/settle', { amount: '0' });
    assert.equal(r2.status, 400);

    var custRes = await h.request('GET', '/api/customers');
    var meera = custRes.body.customers.find(function (c) { return c.id === 1; });
    assert.equal(meera.totalSettled, 1200);
    assert.equal(meera.balance, 1232.01);
  });

  it('T2-F6-2: rejects negative settlement amount (-5 and "-100")', async function () {
    var r1 = await h.request('POST', '/api/customers/1/settle', { amount: -5 });
    assert.equal(r1.status, 400);
    var r2 = await h.request('POST', '/api/customers/1/settle', { amount: '-100' });
    assert.equal(r2.status, 400);

    var custRes = await h.request('GET', '/api/customers');
    var meera = custRes.body.customers.find(function (c) { return c.id === 1; });
    assert.equal(meera.balance, 1232.01);
  });

  it('T2-F6-3: rejects non-numeric, empty string, and null settlement amounts', async function () {
    var r1 = await h.request('POST', '/api/customers/1/settle', { amount: 'abc' });
    assert.equal(r1.status, 400);
    var r2 = await h.request('POST', '/api/customers/1/settle', { amount: '' });
    assert.equal(r2.status, 400);
    var r3 = await h.request('POST', '/api/customers/1/settle', { amount: null });
    assert.equal(r3.status, 400);

    var custRes = await h.request('GET', '/api/customers');
    assert.equal(custRes.body.settlements.length, 4);
  });

  it('T2-F6-4: overpayment creates negative numeric advance balance', async function () {
    var res = await h.request('POST', '/api/customers/2/settle', { amount: '200', mode: 'upi' });
    assert.equal(res.status, 201);
    assert.equal(res.body.customer.totalSettled, 400);
    assert.equal(res.body.customer.balance, -80);
    assert.equal(typeof res.body.customer.balance, 'number');
  });

  it('T2-F6-5: unknown customer ID settlement returns 404 Customer not found', async function () {
    var res = await h.request('POST', '/api/customers/999/settle', { amount: 100 });
    assert.equal(res.status, 404);
    assert.match(res.body.error, /Customer not found/i);
  });

  // =========================================================================
  // F7: Duplicate Checkout Prevention Boundaries (5 tests)
  // =========================================================================
  it('T2-F7-1: repeated Idempotency-Key header after 201 creates only 1 order, 1 stock deduction, 1 Khata charge', async function () {
    var key = h.nextIdempotencyKey('t2-f7-1');
    var payload = {
      items: [{ id: 1, qty: 1 }],
      customerId: 3,
      paymentMode: 'khata'
    };
    var r1 = await h.request('POST', '/api/orders', payload, { 'Idempotency-Key': key });
    assert.equal(r1.status, 201);
    var r2 = await h.request('POST', '/api/orders', payload, { 'Idempotency-Key': key });
    assert.ok(r2.status === 409 || ((r2.status === 200 || r2.status === 201) && r2.body.id === r1.body.id));

    var ordersRes = await h.request('GET', '/api/orders');
    assert.equal(ordersRes.body.length, 12);

    var prodRes = await h.request('GET', '/api/products');
    var p1 = prodRes.body.find(function (p) { return p.id === 1; });
    assert.equal(p1.stock, 17);

    var custRes = await h.request('GET', '/api/customers');
    var priya = custRes.body.customers.find(function (c) { return c.id === 3; });
    assert.equal(priya.balance, 672);
  });

  it('T2-F7-2: repeated body.idempotencyKey prevents duplicate order and stock deduction', async function () {
    var key = h.nextIdempotencyKey('t2-f7-2');
    var payload = {
      items: [{ id: 4, qty: 1 }],
      paymentMode: 'cash',
      idempotencyKey: key
    };
    var r1 = await h.request('POST', '/api/orders', payload);
    assert.equal(r1.status, 201);
    var r2 = await h.request('POST', '/api/orders', payload);
    assert.ok(r2.status === 409 || ((r2.status === 200 || r2.status === 201) && r2.body.id === r1.body.id));

    var ordersRes = await h.request('GET', '/api/orders');
    assert.equal(ordersRes.body.length, 12);

    var prodRes = await h.request('GET', '/api/products');
    var p4 = prodRes.body.find(function (p) { return p.id === 4; });
    assert.equal(p4.stock, 21);
  });

  it('T2-F7-3: repeated body.clientRequestId prevents duplicate order and stock deduction', async function () {
    var reqId = h.nextIdempotencyKey('t2-f7-3');
    var payload = {
      items: [{ id: 7, qty: 1 }],
      paymentMode: 'upi',
      clientRequestId: reqId
    };
    var r1 = await h.request('POST', '/api/orders', payload);
    assert.equal(r1.status, 201);
    var r2 = await h.request('POST', '/api/orders', payload);
    assert.ok(r2.status === 409 || ((r2.status === 200 || r2.status === 201) && r2.body.id === r1.body.id));

    var ordersRes = await h.request('GET', '/api/orders');
    assert.equal(ordersRes.body.length, 12);

    var prodRes = await h.request('GET', '/api/products');
    var p7 = prodRes.body.find(function (p) { return p.id === 7; });
    assert.equal(p7.stock, 23);
  });

  it('T2-F7-4: concurrent 3-way race creates exactly 1 order, 1 stock deduction, and 1 Khata charge', async function () {
    var key = h.nextIdempotencyKey('t2-f7-4');
    var payload = {
      items: [{ id: 12, qty: 1 }],
      customerId: 3,
      paymentMode: 'khata'
    };
    var results = await Promise.all([
      h.request('POST', '/api/orders', payload, { 'Idempotency-Key': key }),
      h.request('POST', '/api/orders', payload, { 'Idempotency-Key': key }),
      h.request('POST', '/api/orders', payload, { 'Idempotency-Key': key })
    ]);
    var created = results.filter(function (r) { return r.status === 201; });
    assert.ok(created.length >= 1, 'Expected at least one 201 response');
    var orderId = created[0].body.id;
    results.forEach(function (r) {
      assert.ok(r.status === 409 || ((r.status === 200 || r.status === 201) && r.body.id === orderId));
    });

    var ordersRes = await h.request('GET', '/api/orders');
    assert.equal(ordersRes.body.length, 12);

    var prodRes = await h.request('GET', '/api/products');
    var p12 = prodRes.body.find(function (p) { return p.id === 12; });
    assert.equal(p12.stock, 13);

    var custRes = await h.request('GET', '/api/customers');
    var priya = custRes.body.customers.find(function (c) { return c.id === 3; });
    assert.equal(priya.balance, 212.4);
  });

  it('T2-F7-5: failed 409 Khata checkout does not block immediate corrected cash retry', async function () {
    var failed = await h.request('POST', '/api/orders', {
      customerId: 6,
      paymentMode: 'khata',
      items: [{ id: 3, qty: 1 }]
    });
    assert.equal(failed.status, 409);

    var retry = await h.request('POST', '/api/orders', {
      customerId: 6,
      paymentMode: 'cash',
      items: [{ id: 3, qty: 1 }]
    });
    assert.equal(retry.status, 201);
  });

  // =========================================================================
  // F8: Quantity Validation Boundaries (6 tests)
  // =========================================================================
  it('T2-F8-1: rejects qty 0 with 400 in both preview and checkout', async function () {
    var prev = await h.request('POST', '/api/pricing/preview', {
      items: [{ id: 1, qty: 0 }]
    });
    assert.equal(prev.status, 400);
    assert.ok(prev.body.error);

    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: 0 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f8-1') });
    assert.equal(order.status, 400);
    assert.ok(order.body.error);
  });

  it('T2-F8-2: rejects negative qty -1 with 400 in both preview and checkout', async function () {
    var prev = await h.request('POST', '/api/pricing/preview', {
      items: [{ id: 1, qty: -1 }]
    });
    assert.equal(prev.status, 400);

    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: -1 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f8-2') });
    assert.equal(order.status, 400);
  });

  it('T2-F8-3: rejects fractional qty 1.5 with 400 in both preview and checkout', async function () {
    var prev = await h.request('POST', '/api/pricing/preview', {
      items: [{ id: 1, qty: 1.5 }]
    });
    assert.equal(prev.status, 400);

    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: 1.5 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f8-3') });
    assert.equal(order.status, 400);
  });

  it('T2-F8-4: rejects non-numeric string quantities "abc" and "2abc" with 400 in both preview and checkout', async function () {
    var p1 = await h.request('POST', '/api/pricing/preview', { items: [{ id: 1, qty: 'abc' }] });
    assert.equal(p1.status, 400);
    var p2 = await h.request('POST', '/api/pricing/preview', { items: [{ id: 1, qty: '2abc' }] });
    assert.equal(p2.status, 400);

    var o1 = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: 'abc' }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f8-4-a') });
    assert.equal(o1.status, 400);

    var o2 = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: '2abc' }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f8-4-b') });
    assert.equal(o2.status, 400);
  });

  it('T2-F8-5: rejects missing qty and null qty with 400 in both preview and checkout', async function () {
    var p1 = await h.request('POST', '/api/pricing/preview', { items: [{ id: 1 }] });
    assert.equal(p1.status, 400);
    var p2 = await h.request('POST', '/api/pricing/preview', { items: [{ id: 1, qty: null }] });
    assert.equal(p2.status, 400);

    var o1 = await h.request('POST', '/api/orders', {
      items: [{ id: 1 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f8-5-a') });
    assert.equal(o1.status, 400);

    var o2 = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: null }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f8-5-b') });
    assert.equal(o2.status, 400);
  });

  it('T2-F8-6: rejects mixed valid and zero-qty line items atomically with no stock deduction', async function () {
    var prev = await h.request('POST', '/api/pricing/preview', {
      items: [{ id: 1, qty: 1 }, { id: 2, qty: 0 }]
    });
    assert.equal(prev.status, 400);

    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: 1 }, { id: 2, qty: 0 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f8-6') });
    assert.equal(order.status, 400);

    var prodRes = await h.request('GET', '/api/products');
    var p1 = prodRes.body.find(function (p) { return p.id === 1; });
    var p2 = prodRes.body.find(function (p) { return p.id === 2; });
    assert.equal(p1.stock, 18);
    assert.equal(p2.stock, 28);
  });

  // =========================================================================
  // F9: Initial Status Check Boundaries (5 tests)
  // =========================================================================
  it('T2-F9-1: rejects initial status "cancelled" with 400 without mutating stock, Khata, or orders', async function () {
    var res = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: 2 }],
      customerId: 1,
      paymentMode: 'khata',
      status: 'cancelled'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f9-1') });
    assert.equal(res.status, 400);

    var prodRes = await h.request('GET', '/api/products');
    var p1 = prodRes.body.find(function (p) { return p.id === 1; });
    assert.equal(p1.stock, 18);

    var custRes = await h.request('GET', '/api/customers');
    var meera = custRes.body.customers.find(function (c) { return c.id === 1; });
    assert.equal(meera.balance, 1232.01);

    var ordersRes = await h.request('GET', '/api/orders');
    assert.equal(ordersRes.body.length, 11);
  });

  it('T2-F9-2: rejects initial status "shipped" with 400 without mutating stock or Khata', async function () {
    var res = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: 2 }],
      customerId: 1,
      paymentMode: 'khata',
      status: 'shipped'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f9-2') });
    assert.equal(res.status, 400);

    var prodRes = await h.request('GET', '/api/products');
    var p1 = prodRes.body.find(function (p) { return p.id === 1; });
    assert.equal(p1.stock, 18);
  });

  it('T2-F9-3: rejects explicit empty string status "" with 400', async function () {
    var res = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: 1 }],
      paymentMode: 'cash',
      status: ''
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f9-3') });
    assert.equal(res.status, 400);

    var prodRes = await h.request('GET', '/api/products');
    var p1 = prodRes.body.find(function (p) { return p.id === 1; });
    assert.equal(p1.stock, 18);
  });

  it('T2-F9-4: rejects uppercase "COMPLETED" and "refunded" initial statuses with 400', async function () {
    var r1 = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: 1 }],
      paymentMode: 'cash',
      status: 'COMPLETED'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f9-4-a') });
    assert.equal(r1.status, 400);

    var r2 = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: 1 }],
      paymentMode: 'cash',
      status: 'refunded'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f9-4-b') });
    assert.equal(r2.status, 400);
  });

  it('T2-F9-5: rejects non-string initial statuses (123 and true) with 400', async function () {
    var r1 = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: 1 }],
      paymentMode: 'cash',
      status: 123
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f9-5-a') });
    assert.equal(r1.status, 400);

    var r2 = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: 1 }],
      paymentMode: 'cash',
      status: true
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f9-5-b') });
    assert.equal(r2.status, 400);
  });

  // =========================================================================
  // F10: Khata Credit Limit 0 Boundaries (5 tests)
  // =========================================================================
  it('T2-F10-1: rejects creditLimit 0 Khata order projecting 0.01 over 0', async function () {
    var res = await h.request('POST', '/api/orders', {
      customerId: 8,
      paymentMode: 'khata',
      items: [{ id: 3, qty: 1 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f10-1') });
    assert.equal(res.status, 409);

    var prodRes = await h.request('GET', '/api/products');
    var p3 = prodRes.body.find(function (p) { return p.id === 3; });
    assert.equal(p3.stock, 35);

    var custRes = await h.request('GET', '/api/customers');
    var asha = custRes.body.customers.find(function (c) { return c.id === 8; });
    assert.equal(asha.balance, -50.39);
  });

  it('T2-F10-2: rejects creditLimit 0 Khata order of 6720 without falling back to 5000', async function () {
    var res = await h.request('POST', '/api/orders', {
      customerId: 6,
      paymentMode: 'khata',
      items: [{ id: 13, qty: 6 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f10-2') });
    assert.equal(res.status, 409);

    var prodRes = await h.request('GET', '/api/products');
    var p13 = prodRes.body.find(function (p) { return p.id === 13; });
    assert.equal(p13.stock, 10);

    var custRes = await h.request('GET', '/api/customers');
    var ramesh = custRes.body.customers.find(function (c) { return c.id === 6; });
    assert.equal(ramesh.balance, 0);
  });

  it('T2-F10-3: allows creditLimit 0 Khata order when advance balance keeps projected balance at exact 0.00', async function () {
    var settleRes = await h.request('POST', '/api/customers/8/settle', { amount: 0.01 });
    assert.equal(settleRes.status, 201);

    var orderRes = await h.request('POST', '/api/orders', {
      customerId: 8,
      paymentMode: 'khata',
      items: [{ id: 3, qty: 1 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f10-3') });
    assert.equal(orderRes.status, 201);

    var custRes = await h.request('GET', '/api/customers');
    var asha = custRes.body.customers.find(function (c) { return c.id === 8; });
    assert.equal(asha.balance, 0);
  });

  it('T2-F10-4: enforces non-zero creditLimit 10000 boundary (9000 + 1120 > 10000)', async function () {
    var res = await h.request('POST', '/api/orders', {
      customerId: 7,
      paymentMode: 'khata',
      items: [{ id: 13, qty: 1 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f10-4') });
    assert.equal(res.status, 409);

    var custRes = await h.request('GET', '/api/customers');
    var vikram = custRes.body.customers.find(function (c) { return c.id === 7; });
    assert.equal(vikram.balance, 9000);

    var prodRes = await h.request('GET', '/api/products');
    var p13 = prodRes.body.find(function (p) { return p.id === 13; });
    assert.equal(p13.stock, 10);
  });

  it('T2-F10-5: customer with omitted creditLimit defaults to 5000 for display and enforcement', async function () {
    var custRes = await h.request('GET', '/api/customers');
    var neha = custRes.body.customers.find(function (c) { return c.id === 9; });
    assert.equal(neha.creditLimit, 5000);

    var over = await h.request('POST', '/api/orders', {
      customerId: 9,
      paymentMode: 'khata',
      items: [{ id: 13, qty: 5 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f10-5-over') });
    assert.equal(over.status, 409);

    var within = await h.request('POST', '/api/orders', {
      customerId: 9,
      paymentMode: 'khata',
      items: [{ id: 13, qty: 4 }],
      coupon: 'SAVE10'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f10-5-ok') });
    assert.equal(within.status, 201);
    assert.equal(within.body.total, 4312);
  });

  // =========================================================================
  // F11: Settlement Paisa Precision Boundaries (5 tests)
  // =========================================================================
  it('T2-F11-1: rejects sub-paisa 0.004 (number and string) with 400 and no mutation', async function () {
    var r1 = await h.request('POST', '/api/customers/1/settle', { amount: 0.004 });
    assert.equal(r1.status, 400);
    var r2 = await h.request('POST', '/api/customers/1/settle', { amount: '0.004' });
    assert.equal(r2.status, 400);

    var custRes = await h.request('GET', '/api/customers');
    var meera = custRes.body.customers.find(function (c) { return c.id === 1; });
    assert.equal(meera.totalSettled, 1200);
    assert.equal(meera.balance, 1232.01);
    assert.equal(custRes.body.settlements.length, 4);
  });

  it('T2-F11-2: rejects sub-paisa 0.001 and 0.0049 with 400 without adding settlements', async function () {
    var r1 = await h.request('POST', '/api/customers/1/settle', { amount: 0.001 });
    assert.equal(r1.status, 400);
    var r2 = await h.request('POST', '/api/customers/1/settle', { amount: 0.0049 });
    assert.equal(r2.status, 400);

    var custRes = await h.request('GET', '/api/customers');
    assert.equal(custRes.body.settlements.length, 4);
  });

  it('T2-F11-3: rejects zero 0 and negative -5 settlement amounts with 400', async function () {
    var r1 = await h.request('POST', '/api/customers/1/settle', { amount: 0 });
    assert.equal(r1.status, 400);
    var r2 = await h.request('POST', '/api/customers/1/settle', { amount: -5 });
    assert.equal(r2.status, 400);
  });

  it('T2-F11-4: receipt amount and Khata credit delta agree exactly after rounding 10.126', async function () {
    var res = await h.request('POST', '/api/customers/1/settle', { amount: 10.126 });
    assert.equal(res.status, 201);
    assert.equal(res.body.settlement.amount, 10.13);
    assert.equal(Number((res.body.customer.totalSettled - 1200).toFixed(2)), 10.13);
    assert.equal(Number((1232.01 - res.body.customer.balance).toFixed(2)), 10.13);
  });

  it('T2-F11-5: string "500.255" rounds to 500.26 on both receipt and ledger', async function () {
    var res = await h.request('POST', '/api/customers/1/settle', { amount: '500.255' });
    assert.equal(res.status, 201);
    assert.equal(res.body.settlement.amount, 500.26);
    assert.equal(res.body.customer.totalSettled, 1700.26);
    assert.equal(res.body.customer.balance, 731.75);
  });

  // =========================================================================
  // F12: Explicit GST Rate Preservation Boundaries (6 tests)
  // =========================================================================
  it('T2-F12-1: explicit gstRate 0 is preserved across catalog, preview, checkout, and invoice', async function () {
    var cat = await h.request('GET', '/api/products');
    var p14 = cat.body.find(function (p) { return p.id === 14; });
    assert.equal(p14.gstPercent, 0);

    var prev = await h.request('POST', '/api/pricing/preview', { items: [{ id: 14, qty: 2 }] });
    assert.equal(prev.status, 200);
    assert.equal(prev.body.totals.tax, 0);
    assert.equal(prev.body.totals.total, 500);

    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 14, qty: 2 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f12-1') });
    assert.equal(order.status, 201);
    assert.equal(order.body.tax, 0);
    assert.equal(order.body.total, 500);

    var inv = await h.request('GET', '/orders/' + order.body.id + '/invoice');
    assert.equal(inv.status, 200);
    assert.match(inv.text, /0%/);
    assert.equal(inv.text.indexOf('Accountant Reconciliation Notice'), -1);
  });

  it('T2-F12-2: explicit gstRate 12 overrides HSN 1006 across catalog, preview, checkout, and invoice', async function () {
    var cat = await h.request('GET', '/api/products');
    var p13 = cat.body.find(function (p) { return p.id === 13; });
    assert.equal(p13.gstPercent, 12);

    var prev = await h.request('POST', '/api/pricing/preview', { items: [{ id: 13, qty: 1 }] });
    assert.equal(prev.status, 200);
    assert.equal(prev.body.totals.tax, 120);
    assert.equal(prev.body.totals.total, 1120);

    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 13, qty: 1 }],
      paymentMode: 'upi'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f12-2') });
    assert.equal(order.status, 201);
    assert.equal(order.body.tax, 120);
    assert.equal(order.body.total, 1120);

    var inv = await h.request('GET', '/orders/' + order.body.id + '/invoice');
    assert.equal(inv.status, 200);
    assert.match(inv.text, /12%/);
    assert.equal(inv.text.indexOf('Accountant Reconciliation Notice'), -1);
  });

  it('T2-F12-3: decimal explicit gstRate 0.12 is preserved as 12% in catalog, preview, and checkout', async function () {
    var cat = await h.request('GET', '/api/products');
    var p16 = cat.body.find(function (p) { return p.id === 16; });
    assert.equal(p16.gstPercent, 12);

    var prev = await h.request('POST', '/api/pricing/preview', { items: [{ id: 16, qty: 1 }] });
    assert.equal(prev.status, 200);
    assert.equal(prev.body.totals.tax, 24);
    assert.equal(prev.body.totals.total, 224);

    var base = h.getDb();
    var p16Mutable = base.products.find(function (p) { return p.id === 16; });
    p16Mutable.stock = 5;
    p16Mutable.reserved = 0;
    h.resetFixture({ products: base.products });

    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 16, qty: 1 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f12-3') });
    assert.equal(order.status, 201);
    assert.equal(order.body.tax, 24);
    assert.equal(order.body.total, 224);
  });

  it('T2-F12-4: product without explicit gstRate uses HSN slab 1006 (5%)', async function () {
    var cat = await h.request('GET', '/api/products');
    var p1 = cat.body.find(function (p) { return p.id === 1; });
    assert.equal(p1.gstPercent, 5);

    var prev = await h.request('POST', '/api/pricing/preview', { items: [{ id: 1, qty: 1 }] });
    assert.equal(prev.status, 200);
    assert.equal(prev.body.totals.tax, 32);
    assert.equal(prev.body.totals.total, 672);

    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: 1 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f12-4') });
    assert.equal(order.status, 201);
    assert.equal(order.body.tax, 32);
    assert.equal(order.body.total, 672);
  });

  it('T2-F12-5: unmapped HSN 0910 without explicit gstRate uses 18% default rate', async function () {
    var cat = await h.request('GET', '/api/products');
    var p15 = cat.body.find(function (p) { return p.id === 15; });
    assert.equal(p15.gstPercent, 18);

    var prev = await h.request('POST', '/api/pricing/preview', { items: [{ id: 15, qty: 1 }] });
    assert.equal(prev.status, 200);
    assert.equal(prev.body.totals.tax, 18);
    assert.equal(prev.body.totals.total, 118);

    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 15, qty: 1 }],
      paymentMode: 'upi'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f12-5') });
    assert.equal(order.status, 201);
    assert.equal(order.body.tax, 18);
    assert.equal(order.body.total, 118);
  });

  it('T2-F12-6: mixed cart combining explicit gstRate 0 and HSN 18% item preserves both rates simultaneously', async function () {
    var prev = await h.request('POST', '/api/pricing/preview', {
      items: [{ id: 14, qty: 1 }, { id: 8, qty: 1 }]
    });
    assert.equal(prev.status, 200);
    assert.equal(prev.body.totals.lines[0].gstPercent, 0);
    assert.equal(prev.body.totals.lines[1].gstPercent, 18);
    assert.equal(prev.body.totals.tax, 25.2);
    assert.equal(prev.body.totals.total, 415.2);

    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 14, qty: 1 }, { id: 8, qty: 1 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t2-f12-6') });
    assert.equal(order.status, 201);
    assert.equal(order.body.tax, 25.2);
    assert.equal(order.body.total, 415.2);
    assert.equal(order.body.items[0].gstRate, 0);

    var inv = await h.request('GET', '/orders/' + order.body.id + '/invoice');
    assert.equal(inv.status, 200);
    assert.match(inv.text, />0%</);
    assert.match(inv.text, />18%</);
    assert.equal(inv.text.indexOf('Accountant Reconciliation Notice'), -1);
  });
});
