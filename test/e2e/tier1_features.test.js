var test = require('node:test');
var assert = require('node:assert/strict');
var h = require('./e2e_harness');

var describe = test.describe;
var it = test.it;
var before = test.before;
var after = test.after;
var beforeEach = test.beforeEach;

describe('Tier 1 — Isolated Feature Happy-Path Tests (F1-F12)', function () {
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
  // F1: Ticket 1 (#1) Invoice GST & Coupon Alignment (5 tests)
  // =========================================================================
  it('T1-F1-1: invoice #1002 renders SAVE10 coupon totals without mismatch banner', async function () {
    var res = await h.request('GET', '/orders/1002/invoice');
    assert.equal(res.status, 200);
    assert.match(res.text, /INV-1002/);
    assert.match(res.text, /SAVE10/);
    assert.match(res.text, /₹963\.90/);
    assert.match(res.text, /₹102\.00/);
    assert.match(res.text, /₹45\.90/);
    assert.equal(res.text.indexOf('Accountant Reconciliation Notice'), -1);
  });

  it('T1-F1-2: invoice #1004 renders capped SAVE10 discount and 5% GST without mismatch banner', async function () {
    var res = await h.request('GET', '/orders/1004/invoice');
    assert.equal(res.status, 200);
    assert.match(res.text, /INV-1004/);
    assert.match(res.text, /₹2240\.00/);
    assert.match(res.text, /-₹150\.00/);
    assert.match(res.text, /₹104\.50/);
    assert.match(res.text, /₹2194\.50/);
    assert.match(res.text, /5%/);
    assert.equal(res.text.indexOf('Accountant Reconciliation Notice'), -1);
  });

  it('T1-F1-3: gst-reconciliation reports zero mismatches across all active baseline orders', async function () {
    var res = await h.request('GET', '/api/reports/gst-reconciliation');
    assert.equal(res.status, 200);
    assert.equal(res.body.totalChecked, 10);
    assert.equal(res.body.mismatchCount, 0);
    assert.equal(res.body.totalDelta, 0);
    assert.equal(res.body.rows.every(function (r) { return r.matched === true; }), true);
  });

  it('T1-F1-4: pricing preview normalizes lowercase wholesale15 coupon and computes exact totals', async function () {
    var res = await h.request('POST', '/api/pricing/preview', {
      items: [{ id: 1, qty: 2 }, { id: 4, qty: 4 }],
      coupon: 'wholesale15'
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.couponStatus.valid, true);
    assert.equal(res.body.couponStatus.code, 'WHOLESALE15');
    assert.equal(res.body.totals.subtotal, 2040);
    assert.equal(res.body.totals.discount, 306);
    assert.equal(res.body.totals.taxable, 1734);
    assert.equal(res.body.totals.tax, 86.7);
    assert.equal(res.body.totals.cgst, 43.35);
    assert.equal(res.body.totals.sgst, 43.35);
    assert.equal(res.body.totals.total, 1820.7);
  });

  it('T1-F1-5: mixed HSN order with FLAT50 matches printable invoice with zero mismatch banner', async function () {
    var orderRes = await h.request('POST', '/api/orders', {
      items: [{ id: 7, qty: 1 }, { id: 3, qty: 1 }],
      coupon: 'FLAT50',
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f1-5') });
    assert.equal(orderRes.status, 201);
    assert.equal(orderRes.body.subtotal, 308);
    assert.equal(orderRes.body.discount, 50);
    assert.equal(orderRes.body.tax, 28.14);
    assert.equal(orderRes.body.total, 286.14);

    var invRes = await h.request('GET', '/orders/' + orderRes.body.id + '/invoice');
    assert.equal(invRes.status, 200);
    assert.match(invRes.text, /₹286\.14/);
    assert.equal(invRes.text.indexOf('Accountant Reconciliation Notice'), -1);
  });

  // =========================================================================
  // F2: Ticket 2 (#2/#435) Sellable Stock Check (5 tests)
  // =========================================================================
  it('T1-F2-1: allows billing the last sellable unit when reserved is 0', async function () {
    var res = await h.request('POST', '/api/orders', {
      items: [{ id: 6, qty: 1 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f2-1') });
    assert.equal(res.status, 201);
    assert.equal(res.body.subtotal, 450);
    assert.equal(res.body.tax, 54);
    assert.equal(res.body.total, 504);

    var prodRes = await h.request('GET', '/api/products');
    var p6 = prodRes.body.find(function (p) { return p.id === 6; });
    assert.equal(p6.stock, 0);
    assert.equal(p6.sellable, 0);
  });

  it('T1-F2-2: allows billing the last sellable unit when reserved > 0', async function () {
    var res = await h.request('POST', '/api/orders', {
      items: [{ id: 11, qty: 1 }],
      paymentMode: 'upi'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f2-2') });
    assert.equal(res.status, 201);
    assert.equal(res.body.subtotal, 220);
    assert.equal(res.body.tax, 26.4);
    assert.equal(res.body.total, 246.4);

    var prodRes = await h.request('GET', '/api/products');
    var p11 = prodRes.body.find(function (p) { return p.id === 11; });
    assert.equal(p11.stock, 3);
    assert.equal(p11.reserved, 3);
    assert.equal(p11.sellable, 0);
  });

  it('T1-F2-3: allows billing exact multi-unit sellable stock (qty === stock - reserved)', async function () {
    var res = await h.request('POST', '/api/orders', {
      items: [{ id: 5, qty: 8 }],
      paymentMode: 'upi'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f2-3') });
    assert.equal(res.status, 201);
    assert.equal(res.body.subtotal, 8960);
    assert.equal(res.body.tax, 448);
    assert.equal(res.body.total, 9408);

    var prodRes = await h.request('GET', '/api/products');
    var p5 = prodRes.body.find(function (p) { return p.id === 5; });
    assert.equal(p5.stock, 1);
    assert.equal(p5.reserved, 1);
    assert.equal(p5.sellable, 0);
  });

  it('T1-F2-4: allows multi-item order draining last sellable unit of two products', async function () {
    var res = await h.request('POST', '/api/orders', {
      items: [{ id: 6, qty: 1 }, { id: 11, qty: 1 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f2-4') });
    assert.equal(res.status, 201);
    assert.equal(res.body.subtotal, 670);
    assert.equal(res.body.tax, 80.4);
    assert.equal(res.body.total, 750.4);

    var prodRes = await h.request('GET', '/api/products');
    var p6 = prodRes.body.find(function (p) { return p.id === 6; });
    var p11 = prodRes.body.find(function (p) { return p.id === 11; });
    assert.equal(p6.sellable, 0);
    assert.equal(p11.sellable, 0);
  });

  it('T1-F2-5: deducts ample stock while keeping reserved count intact', async function () {
    var res = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: 3 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f2-5') });
    assert.equal(res.status, 201);
    assert.equal(res.body.subtotal, 1920);
    assert.equal(res.body.tax, 96);
    assert.equal(res.body.total, 2016);

    var prodRes = await h.request('GET', '/api/products');
    var p1 = prodRes.body.find(function (p) { return p.id === 1; });
    assert.equal(p1.stock, 15);
    assert.equal(p1.reserved, 2);
    assert.equal(p1.sellable, 13);
  });

  // =========================================================================
  // F3: Ticket 2 (#2/#435) Order Cancel Stock Restoration (5 tests)
  // =========================================================================
  it('T1-F3-1: cancelling pending order #1007 restores physical stock for all items', async function () {
    var res = await h.request('POST', '/api/orders/1007/cancel', {
      reason: 'Customer deferred'
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'cancelled');
    assert.equal(res.body.cancelReason, 'Customer deferred');

    var prodRes = await h.request('GET', '/api/products');
    var p6 = prodRes.body.find(function (p) { return p.id === 6; });
    var p4 = prodRes.body.find(function (p) { return p.id === 4; });
    assert.equal(p6.stock, 3);
    assert.equal(p6.sellable, 3);
    assert.equal(p4.stock, 24);
    assert.equal(p4.sellable, 20);
  });

  it('T1-F3-2: cancelling Khata order #1007 reverses Suresh Deshmukh Khata debit', async function () {
    var res = await h.request('POST', '/api/orders/1007/cancel', {});
    assert.equal(res.status, 200);

    var custRes = await h.request('GET', '/api/customers');
    var suresh = custRes.body.customers.find(function (c) { return c.id === 4; });
    assert.equal(suresh.totalBilled, 0);
    assert.equal(suresh.balance, 200);
  });

  it('T1-F3-3: cancelling newly placed single-item order restores exact pre-order stock', async function () {
    var created = await h.request('POST', '/api/orders', {
      items: [{ id: 1, qty: 5 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f3-3') });
    assert.equal(created.status, 201);

    var cancelled = await h.request('POST', '/api/orders/' + created.body.id + '/cancel', {});
    assert.equal(cancelled.status, 200);

    var prodRes = await h.request('GET', '/api/products');
    var p1 = prodRes.body.find(function (p) { return p.id === 1; });
    assert.equal(p1.stock, 18);
    assert.equal(p1.sellable, 16);
  });

  it('T1-F3-4: cancelling newly placed multi-line order restores stock on all lines', async function () {
    var created = await h.request('POST', '/api/orders', {
      items: [{ id: 2, qty: 4 }, { id: 8, qty: 6 }],
      paymentMode: 'upi'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f3-4') });
    assert.equal(created.status, 201);

    var cancelled = await h.request('POST', '/api/orders/' + created.body.id + '/cancel', {});
    assert.equal(cancelled.status, 200);

    var prodRes = await h.request('GET', '/api/products');
    var p2 = prodRes.body.find(function (p) { return p.id === 2; });
    var p8 = prodRes.body.find(function (p) { return p.id === 8; });
    assert.equal(p2.stock, 28);
    assert.equal(p8.stock, 42);
  });

  it('T1-F3-5: cancelling order #1007 updates dashboard pendingCount, cancelledCount, and grossRevenue', async function () {
    var cancelled = await h.request('POST', '/api/orders/1007/cancel', {});
    assert.equal(cancelled.status, 200);

    var dash = await h.request('GET', '/api/reports/dashboard');
    assert.equal(dash.status, 200);
    assert.equal(dash.body.summary.pendingCount, 0);
    assert.equal(dash.body.summary.cancelledCount, 2);
    assert.equal(dash.body.summary.grossRevenue, 8409.72);
  });

  // =========================================================================
  // F4: Ticket 3 (#3) Order History Chronological Sort (5 tests)
  // =========================================================================
  it('T1-F4-1: default order history sorts newest-first across all 11 baseline orders', async function () {
    var res = await h.request('GET', '/api/orders');
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map(function (o) { return o.id; }),
      [1011, 1010, 1009, 1008, 1007, 1006, 1005, 1004, 1003, 1002, 1001]
    );
  });

  it('T1-F4-2: cross-year order history places 2023 before 2022 before 2021', async function () {
    var res = await h.request('GET', '/api/orders');
    assert.equal(res.status, 200);
    assert.equal(res.body[0].date, '25/02/2023');
    assert.equal(res.body[2].date, '02/01/2023');
    assert.equal(res.body[3].date, '15/03/2022');
    assert.equal(res.body[10].date, '28/12/2021');
  });

  it('T1-F4-3: newly created order appears at index 0 of order history', async function () {
    var created = await h.request('POST', '/api/orders', {
      items: [{ id: 8, qty: 1 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f4-3') });
    assert.equal(created.status, 201);

    var listRes = await h.request('GET', '/api/orders');
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body[0].id, 1012);
  });

  it('T1-F4-4: status=completed filter preserves newest-first chronological sort', async function () {
    var res = await h.request('GET', '/api/orders?status=completed');
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map(function (o) { return o.id; }),
      [1011, 1009, 1008, 1006, 1005, 1004, 1003, 1002, 1001]
    );
  });

  it('T1-F4-5: search filter preserves newest-first chronological sort', async function () {
    var res = await h.request('GET', '/api/orders?search=Meera');
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map(function (o) { return o.id; }),
      [1006, 1001]
    );
  });

  // =========================================================================
  // F5: Ticket 3 (#3) Order History Date-Range Filter (5 tests)
  // =========================================================================
  it('T1-F5-1: YYYY-MM-DD month range returns exact January 2022 orders', async function () {
    var res = await h.request('GET', '/api/orders?from=2022-01-01&to=2022-01-31');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map(function (o) { return o.id; }), [1004, 1003, 1002]);
  });

  it('T1-F5-2: DD/MM/YYYY month range returns exact February 2022 orders', async function () {
    var res = await h.request('GET', '/api/orders?from=01/02/2022&to=28/02/2022');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map(function (o) { return o.id; }), [1006, 1005]);
  });

  it('T1-F5-3: from-only query returns all orders on or after 2023-01-01', async function () {
    var res = await h.request('GET', '/api/orders?from=2023-01-01');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map(function (o) { return o.id; }), [1011, 1010, 1009]);
  });

  it('T1-F5-4: to-only query returns all orders on or before 2022-01-05', async function () {
    var res = await h.request('GET', '/api/orders?to=2022-01-05');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map(function (o) { return o.id; }), [1002, 1001]);
  });

  it('T1-F5-5: combined date range and search filter returns matching Walk-in Q1 2022 orders', async function () {
    var res = await h.request('GET', '/api/orders?from=2022-01-01&to=2022-03-31&search=Walk-in');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map(function (o) { return o.id; }), [1008, 1003]);
  });

  // =========================================================================
  // F6: Ticket 3 (#3) Khata Settlement Numeric Addition (5 tests)
  // =========================================================================
  it('T1-F6-1: string settlement "500" adds numerically to Meera totalSettled and reduces balance', async function () {
    var res = await h.request('POST', '/api/customers/1/settle', {
      amount: '500',
      mode: 'upi',
      note: 'GPay'
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.settlement.amount, 500);
    assert.equal(typeof res.body.customer.totalSettled, 'number');
    assert.equal(res.body.customer.totalSettled, 1700);
    assert.equal(res.body.customer.balance, 732.01);
  });

  it('T1-F6-2: numeric settlement 500 adds accurately to Meera Khata ledger', async function () {
    var res = await h.request('POST', '/api/customers/1/settle', {
      amount: 500,
      mode: 'cash'
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.settlement.amount, 500);
    assert.equal(res.body.customer.totalSettled, 1700);
    assert.equal(res.body.customer.balance, 732.01);
  });

  it('T1-F6-3: fractional string settlement "232.01" adds numerically without float drift', async function () {
    var res = await h.request('POST', '/api/customers/1/settle', {
      amount: '232.01',
      mode: 'neft'
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.settlement.amount, 232.01);
    assert.equal(res.body.customer.totalSettled, 1432.01);
    assert.equal(res.body.customer.balance, 1000);
  });

  it('T1-F6-4: sequential mixed string and numeric settlements clear Anil balance to 0', async function () {
    var s1 = await h.request('POST', '/api/customers/2/settle', { amount: '50', mode: 'cash' });
    assert.equal(s1.status, 201);
    var s2 = await h.request('POST', '/api/customers/2/settle', { amount: 70, mode: 'upi' });
    assert.equal(s2.status, 201);

    var custRes = await h.request('GET', '/api/customers');
    var anil = custRes.body.customers.find(function (c) { return c.id === 2; });
    assert.equal(anil.totalSettled, 320);
    assert.equal(anil.balance, 0);
    assert.equal(custRes.body.settlements[0].id, 506);
    assert.equal(custRes.body.settlements[1].id, 505);
  });

  it('T1-F6-5: Khata settlement reduces dashboard totalKhataReceivable accurately', async function () {
    var res = await h.request('POST', '/api/customers/5/settle', {
      amount: '1000',
      mode: 'neft'
    });
    assert.equal(res.status, 201);

    var dash = await h.request('GET', '/api/reports/dashboard');
    assert.equal(dash.status, 200);
    assert.equal(dash.body.summary.totalKhataReceivable, 13103.12);
  });

  // =========================================================================
  // F7: Issue #409 Duplicate Checkout Prevention (5 tests)
  // =========================================================================
  it('T1-F7-1: concurrent duplicate requests with same Idempotency-Key create only 1 order, 1 deduction, 1 Khata charge', async function () {
    var key = h.nextIdempotencyKey('t1-f7-1');
    var payload = {
      items: [{ id: 3, qty: 1 }],
      customerId: 3,
      paymentMode: 'khata'
    };
    var results = await Promise.all([
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
    var p3 = prodRes.body.find(function (p) { return p.id === 3; });
    assert.equal(p3.stock, 34);

    var custRes = await h.request('GET', '/api/customers');
    var priya = custRes.body.customers.find(function (c) { return c.id === 3; });
    assert.equal(priya.balance, 50.4);
  });

  it('T1-F7-2: sequential replay with same body.idempotencyKey creates only 1 order and 1 Khata charge', async function () {
    var key = h.nextIdempotencyKey('t1-f7-2');
    var payload = {
      items: [{ id: 8, qty: 1 }],
      customerId: 3,
      paymentMode: 'khata',
      idempotencyKey: key
    };
    var r1 = await h.request('POST', '/api/orders', payload);
    assert.equal(r1.status, 201);
    var r2 = await h.request('POST', '/api/orders', payload);
    assert.ok(r2.status === 409 || ((r2.status === 200 || r2.status === 201) && r2.body.id === r1.body.id));

    var ordersRes = await h.request('GET', '/api/orders');
    assert.equal(ordersRes.body.length, 12);

    var prodRes = await h.request('GET', '/api/products');
    var p8 = prodRes.body.find(function (p) { return p.id === 8; });
    assert.equal(p8.stock, 41);

    var custRes = await h.request('GET', '/api/customers');
    var priya = custRes.body.customers.find(function (c) { return c.id === 3; });
    assert.equal(priya.balance, 165.2);
  });

  it('T1-F7-3: sequential replay with same body.clientRequestId creates only 1 order and 1 stock deduction', async function () {
    var reqId = h.nextIdempotencyKey('t1-f7-3');
    var payload = {
      items: [{ id: 2, qty: 2 }],
      paymentMode: 'cash',
      clientRequestId: reqId
    };
    var r1 = await h.request('POST', '/api/orders', payload);
    assert.equal(r1.status, 201);
    var r2 = await h.request('POST', '/api/orders', payload);
    assert.ok(r2.status === 409 || ((r2.status === 200 || r2.status === 201) && r2.body.id === r1.body.id));

    var ordersRes = await h.request('GET', '/api/orders');
    assert.equal(ordersRes.body.length, 12);

    var prodRes = await h.request('GET', '/api/products');
    var p2 = prodRes.body.find(function (p) { return p.id === 2; });
    assert.equal(p2.stock, 26);
  });

  it('T1-F7-4: concurrent identical double-click without idempotency key creates only 1 order', async function () {
    var payload = {
      customerId: 3,
      paymentMode: 'khata',
      items: [{ id: 15, qty: 1 }]
    };
    var results = await Promise.all([
      h.request('POST', '/api/orders', payload),
      h.request('POST', '/api/orders', payload)
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
    var p15 = prodRes.body.find(function (p) { return p.id === 15; });
    assert.equal(p15.stock, 11);

    var custRes = await h.request('GET', '/api/customers');
    var priya = custRes.body.customers.find(function (c) { return c.id === 3; });
    assert.equal(priya.balance, 118);
  });

  it('T1-F7-5: distinct Idempotency-Keys allow legitimate repeat purchases of identical items', async function () {
    var payload = {
      items: [{ id: 3, qty: 1 }],
      paymentMode: 'cash'
    };
    var r1 = await h.request('POST', '/api/orders', payload, {
      'Idempotency-Key': h.nextIdempotencyKey('t1-f7-5-a')
    });
    var r2 = await h.request('POST', '/api/orders', payload, {
      'Idempotency-Key': h.nextIdempotencyKey('t1-f7-5-b')
    });
    assert.equal(r1.status, 201);
    assert.equal(r2.status, 201);
    assert.notEqual(r1.body.id, r2.body.id);

    var prodRes = await h.request('GET', '/api/products');
    var p3 = prodRes.body.find(function (p) { return p.id === 3; });
    assert.equal(p3.stock, 33);
  });

  // =========================================================================
  // F8: Issue #409 Quantity Validation (5 tests)
  // =========================================================================
  it('T1-F8-1: preview and checkout agree on valid qty 1', async function () {
    var prev = await h.request('POST', '/api/pricing/preview', {
      items: [{ id: 8, qty: 1 }]
    });
    assert.equal(prev.status, 200);
    assert.equal(prev.body.totals.total, 165.2);

    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 8, qty: 1 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f8-1') });
    assert.equal(order.status, 201);
    assert.equal(order.body.total, 165.2);
  });

  it('T1-F8-2: preview and checkout match on multi-unit items with WELCOME coupon', async function () {
    var body = {
      items: [{ id: 2, qty: 3 }, { id: 8, qty: 2 }],
      coupon: 'WELCOME'
    };
    var prev = await h.request('POST', '/api/pricing/preview', body);
    assert.equal(prev.status, 200);
    assert.equal(prev.body.totals.subtotal, 775);
    assert.equal(prev.body.totals.discount, 38.75);
    assert.equal(prev.body.totals.tax, 71.39);
    assert.equal(prev.body.totals.total, 807.64);

    var order = await h.request('POST', '/api/orders', Object.assign({ paymentMode: 'upi' }, body), {
      'Idempotency-Key': h.nextIdempotencyKey('t1-f8-2')
    });
    assert.equal(order.status, 201);
    assert.equal(order.body.subtotal, prev.body.totals.subtotal);
    assert.equal(order.body.discount, prev.body.totals.discount);
    assert.equal(order.body.tax, prev.body.totals.tax);
    assert.equal(order.body.total, prev.body.totals.total);
  });

  it('T1-F8-3: preview and checkout agree on positive integer qty 5', async function () {
    var prev = await h.request('POST', '/api/pricing/preview', {
      items: [{ id: 15, qty: 5 }]
    });
    assert.equal(prev.status, 200);
    assert.equal(prev.body.totals.subtotal, 500);
    assert.equal(prev.body.totals.tax, 90);
    assert.equal(prev.body.totals.total, 590);

    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 15, qty: 5 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f8-3') });
    assert.equal(order.status, 201);
    assert.equal(order.body.subtotal, 500);
    assert.equal(order.body.tax, 90);
    assert.equal(order.body.total, 590);
  });

  it('T1-F8-4: preview and checkout succeed for large valid qty 42 within stock', async function () {
    var prev = await h.request('POST', '/api/pricing/preview', {
      items: [{ id: 8, qty: 42 }]
    });
    assert.equal(prev.status, 200);
    assert.equal(prev.body.totals.subtotal, 5880);
    assert.equal(prev.body.totals.tax, 1058.4);
    assert.equal(prev.body.totals.total, 6938.4);

    var order = await h.request('POST', '/api/orders', {
      items: [{ id: 8, qty: 42 }],
      paymentMode: 'upi'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f8-4') });
    assert.equal(order.status, 201);
    assert.equal(order.body.total, 6938.4);
  });

  it('T1-F8-5: pricing preview never mutates stock or creates orders', async function () {
    var prev = await h.request('POST', '/api/pricing/preview', {
      items: [{ id: 1, qty: 4 }]
    });
    assert.equal(prev.status, 200);
    assert.equal(prev.body.totals.total, 2688);

    var prodRes = await h.request('GET', '/api/products');
    var p1 = prodRes.body.find(function (p) { return p.id === 1; });
    assert.equal(p1.stock, 18);

    var ordersRes = await h.request('GET', '/api/orders');
    assert.equal(ordersRes.body.length, 11);
  });

  // =========================================================================
  // F9: Issue #409 Initial Order Status (5 tests)
  // =========================================================================
  it('T1-F9-1: omitted status defaults to completed', async function () {
    var res = await h.request('POST', '/api/orders', {
      items: [{ id: 3, qty: 1 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f9-1') });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'completed');
  });

  it('T1-F9-2: explicit status completed succeeds and deducts stock', async function () {
    var res = await h.request('POST', '/api/orders', {
      items: [{ id: 3, qty: 1 }],
      paymentMode: 'upi',
      status: 'completed'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f9-2') });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'completed');

    var prodRes = await h.request('GET', '/api/products');
    var p3 = prodRes.body.find(function (p) { return p.id === 3; });
    assert.equal(p3.stock, 34);
  });

  it('T1-F9-3: explicit status pending succeeds, deducts stock, and charges Khata', async function () {
    var res = await h.request('POST', '/api/orders', {
      items: [{ id: 3, qty: 2 }],
      customerId: 3,
      paymentMode: 'khata',
      status: 'pending'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f9-3') });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'pending');
    assert.equal(res.body.total, 100.8);

    var prodRes = await h.request('GET', '/api/products');
    var p3 = prodRes.body.find(function (p) { return p.id === 3; });
    assert.equal(p3.stock, 33);

    var custRes = await h.request('GET', '/api/customers');
    var priya = custRes.body.customers.find(function (c) { return c.id === 3; });
    assert.equal(priya.balance, 100.8);
  });

  it('T1-F9-4: newly created pending order is reflected in dashboard summary', async function () {
    var created = await h.request('POST', '/api/orders', {
      items: [{ id: 3, qty: 2 }],
      customerId: 3,
      paymentMode: 'khata',
      status: 'pending'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f9-4') });
    assert.equal(created.status, 201);

    var dash = await h.request('GET', '/api/reports/dashboard');
    assert.equal(dash.status, 200);
    assert.equal(dash.body.summary.pendingCount, 2);
    assert.equal(dash.body.summary.activeOrdersCount, 11);
    assert.equal(dash.body.summary.grossRevenue, 9917.52);
  });

  it('T1-F9-5: pending order can be cancelled later to restore stock', async function () {
    var created = await h.request('POST', '/api/orders', {
      items: [{ id: 3, qty: 2 }],
      paymentMode: 'cash',
      status: 'pending'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f9-5') });
    assert.equal(created.status, 201);

    var cancelled = await h.request('POST', '/api/orders/' + created.body.id + '/cancel', {});
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, 'cancelled');

    var prodRes = await h.request('GET', '/api/products');
    var p3 = prodRes.body.find(function (p) { return p.id === 3; });
    assert.equal(p3.stock, 35);
  });

  // =========================================================================
  // F10: Issue #409 Khata Credit Limit 0 (5 tests)
  // =========================================================================
  it('T1-F10-1: customer list displays creditLimit 0 rather than default 5000', async function () {
    var res = await h.request('GET', '/api/customers');
    assert.equal(res.status, 200);
    var ramesh = res.body.customers.find(function (c) { return c.id === 6; });
    var asha = res.body.customers.find(function (c) { return c.id === 8; });
    assert.equal(ramesh.creditLimit, 0);
    assert.equal(asha.creditLimit, 0);
  });

  it('T1-F10-2: customer with creditLimit 0 can still place cash orders without charging Khata', async function () {
    var res = await h.request('POST', '/api/orders', {
      customerId: 6,
      paymentMode: 'cash',
      items: [{ id: 13, qty: 6 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f10-2') });
    assert.equal(res.status, 201);
    assert.equal(res.body.total, 6720);

    var custRes = await h.request('GET', '/api/customers');
    var ramesh = custRes.body.customers.find(function (c) { return c.id === 6; });
    assert.equal(ramesh.totalBilled, 0);
    assert.equal(ramesh.balance, 0);
  });

  it('T1-F10-3: customer with creditLimit 0 can still place UPI orders without charging Khata', async function () {
    var res = await h.request('POST', '/api/orders', {
      customerId: 6,
      paymentMode: 'upi',
      items: [{ id: 5, qty: 5 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f10-3') });
    assert.equal(res.status, 201);
    assert.equal(res.body.total, 5880);

    var custRes = await h.request('GET', '/api/customers');
    var ramesh = custRes.body.customers.find(function (c) { return c.id === 6; });
    assert.equal(ramesh.balance, 0);
  });

  it('T1-F10-4: Khata order within non-zero creditLimit succeeds and updates balance', async function () {
    var res = await h.request('POST', '/api/orders', {
      customerId: 7,
      paymentMode: 'khata',
      items: [{ id: 1, qty: 1 }, { id: 4, qty: 1 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f10-4') });
    assert.equal(res.status, 201);
    assert.equal(res.body.total, 871.5);

    var custRes = await h.request('GET', '/api/customers');
    var vikram = custRes.body.customers.find(function (c) { return c.id === 7; });
    assert.equal(vikram.balance, 9871.5);
  });

  it('T1-F10-5: customer with creditLimit 0 and sufficient advance balance can place Khata order bringing balance to 0', async function () {
    var settleRes = await h.request('POST', '/api/customers/8/settle', {
      amount: 0.01,
      mode: 'cash'
    });
    assert.equal(settleRes.status, 201);

    var orderRes = await h.request('POST', '/api/orders', {
      customerId: 8,
      paymentMode: 'khata',
      items: [{ id: 3, qty: 1 }]
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f10-5') });
    assert.equal(orderRes.status, 201);
    assert.equal(orderRes.body.total, 50.4);

    var custRes = await h.request('GET', '/api/customers');
    var asha = custRes.body.customers.find(function (c) { return c.id === 8; });
    assert.equal(asha.balance, 0);
  });

  // =========================================================================
  // F11: Issue #409 Settlement Paisa Precision (5 tests)
  // =========================================================================
  it('T1-F11-1: exact paisa settlement 10.12 matches receipt and ledger delta', async function () {
    var res = await h.request('POST', '/api/customers/1/settle', {
      amount: 10.12,
      mode: 'upi'
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.settlement.amount, 10.12);
    assert.equal(res.body.customer.totalSettled, 1210.12);
    assert.equal(res.body.customer.balance, 1221.89);
  });

  it('T1-F11-2: minimum valid 1 paisa settlement 0.01 succeeds', async function () {
    var res = await h.request('POST', '/api/customers/2/settle', {
      amount: 0.01,
      mode: 'cash'
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.settlement.amount, 0.01);
    assert.equal(res.body.customer.totalSettled, 200.01);
    assert.equal(res.body.customer.balance, 119.99);
  });

  it('T1-F11-3: sub-paisa 10.126 rounds up consistently on both receipt and ledger', async function () {
    var res = await h.request('POST', '/api/customers/1/settle', {
      amount: 10.126,
      mode: 'upi'
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.settlement.amount, 10.13);
    assert.equal(res.body.customer.totalSettled, 1210.13);
    assert.equal(res.body.customer.balance, 1221.88);
  });

  it('T1-F11-4: sub-paisa 10.124 rounds down consistently on both receipt and ledger', async function () {
    var res = await h.request('POST', '/api/customers/1/settle', {
      amount: 10.124,
      mode: 'upi'
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.settlement.amount, 10.12);
    assert.equal(res.body.customer.totalSettled, 1210.12);
    assert.equal(res.body.customer.balance, 1221.89);
  });

  it('T1-F11-5: half-paisa 0.005 rounds to 0.01 consistently on receipt and ledger', async function () {
    var res = await h.request('POST', '/api/customers/2/settle', {
      amount: 0.005,
      mode: 'upi'
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.settlement.amount, 0.01);
    assert.equal(res.body.customer.totalSettled, 200.01);
    assert.equal(res.body.customer.balance, 119.99);
  });

  // =========================================================================
  // F12: Issue #409 Explicit GST Rate Preservation (5 tests)
  // =========================================================================
  it('T1-F12-1: product catalog preserves explicit gstRate 12 and 0 over HSN 1006 slab', async function () {
    var res = await h.request('GET', '/api/products');
    assert.equal(res.status, 200);
    var p13 = res.body.find(function (p) { return p.id === 13; });
    var p14 = res.body.find(function (p) { return p.id === 14; });
    var p1 = res.body.find(function (p) { return p.id === 1; });
    assert.equal(p13.gstPercent, 12);
    assert.equal(p14.gstPercent, 0);
    assert.equal(p1.gstPercent, 5);
  });

  it('T1-F12-2: pricing preview preserves explicit gstRate 12 on HSN 1006 item', async function () {
    var res = await h.request('POST', '/api/pricing/preview', {
      items: [{ id: 13, qty: 1 }]
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.totals.tax, 120);
    assert.equal(res.body.totals.total, 1120);
    assert.equal(res.body.totals.lines[0].gstPercent, 12);
  });

  it('T1-F12-3: pricing preview preserves explicit gstRate 0 on HSN 1006 item', async function () {
    var res = await h.request('POST', '/api/pricing/preview', {
      items: [{ id: 14, qty: 2 }]
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.totals.subtotal, 500);
    assert.equal(res.body.totals.tax, 0);
    assert.equal(res.body.totals.total, 500);
    assert.equal(res.body.totals.lines[0].gstPercent, 0);
  });

  it('T1-F12-4: checkout and invoice preserve explicit gstRate 12 with zero mismatch', async function () {
    var orderRes = await h.request('POST', '/api/orders', {
      items: [{ id: 13, qty: 1 }],
      paymentMode: 'cash'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f12-4') });
    assert.equal(orderRes.status, 201);
    assert.equal(orderRes.body.tax, 120);
    assert.equal(orderRes.body.total, 1120);
    assert.equal(orderRes.body.items[0].gstRate, 12);

    var invRes = await h.request('GET', '/orders/' + orderRes.body.id + '/invoice');
    assert.equal(invRes.status, 200);
    assert.match(invRes.text, /12%/);
    assert.match(invRes.text, /₹1120\.00/);
    assert.equal(invRes.text.indexOf('Accountant Reconciliation Notice'), -1);
  });

  it('T1-F12-5: checkout and invoice preserve explicit gstRate 0 with zero mismatch', async function () {
    var orderRes = await h.request('POST', '/api/orders', {
      items: [{ id: 14, qty: 2 }],
      paymentMode: 'upi'
    }, { 'Idempotency-Key': h.nextIdempotencyKey('t1-f12-5') });
    assert.equal(orderRes.status, 201);
    assert.equal(orderRes.body.tax, 0);
    assert.equal(orderRes.body.total, 500);
    assert.equal(orderRes.body.items[0].gstRate, 0);

    var invRes = await h.request('GET', '/orders/' + orderRes.body.id + '/invoice');
    assert.equal(invRes.status, 200);
    assert.match(invRes.text, /0%/);
    assert.match(invRes.text, /₹500\.00/);
    assert.equal(invRes.text.indexOf('Accountant Reconciliation Notice'), -1);
  });
});
