var assert = require('node:assert/strict');
var test = require('node:test');
var once = require('node:events').once;
var app = require('../server');
var store = require('../lib/store');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

test('invoice matches the amount billed and GST breakdown for the reproduced order', function () {
  var order = {
    items: [
      { name: 'Rice', hsn: '1006', price: 640, qty: 1 },
      { name: 'Ghee', hsn: '0405', price: 260, qty: 1 },
      { name: 'Tea', hsn: '0902', price: 140, qty: 1 }
    ],
    coupon: 'SAVE10',
    subtotal: 1040,
    discount: 104,
    tax: 79.56,
    total: 1015.56
  };
  var printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual({ total: printed.total, tax: printed.tax }, { total: order.total, tax: order.tax });
  assert.deepEqual([printed.subtotal, printed.discount, printed.cgst, printed.sgst], [1040, 104, 39.78, 39.78]);
  assert.deepEqual(printed.rows.map(function (row) { return [row.gstPercent, row.lineTax]; }),
    [[5, 28.80], [12, 28.08], [18, 22.68]]);
});

test('checkout and invoice agree on a single default-rate item without a coupon', function () {
  var items = [{ id: 1, name: 'Loose goods', price: 0.50, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var order = { items: items, total: billed.total };
  var printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual([billed.subtotal, billed.discount, billed.tax, billed.total], [0.50, 0, 0.09, 0.59]);
  assert.deepEqual([billed.cgst, billed.sgst], [0.05, 0.04]);
  assert.deepEqual(printed, {
    subtotal: 0.50,
    discount: 0,
    tax: 0.09,
    cgst: 0.05,
    sgst: 0.04,
    total: 0.59,
    rows: [{
      name: 'Loose goods', sku: '-', hsn: '-', qty: 1, price: 0.50,
      gstPercent: 18, line: 0.50, lineTax: 0.09
    }]
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('mixed HSN invoice matches the checkout preview and the amount billed to the khata', async function (t) {
  var db = {
    nextOrderId: 1001,
    orders: [],
    customers: [{ id: 1, name: 'Meera', openingBalance: 20, creditLimit: 2000 }],
    products: [
      { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 100, stock: 10 },
      { id: 2, sku: 'GHEE', name: 'Ghee', hsn: '0405', price: 400, stock: 10 },
      { id: 3, sku: 'TEA', name: 'Tea', hsn: '0902', price: 100, stock: 10 }
    ]
  };
  t.mock.method(store, 'read', function () { return db; });
  var write = t.mock.method(store, 'write', function (updatedDb) {
    assert.strictEqual(updatedDb, db);
  });

  var server = app.listen(0, '127.0.0.1');
  t.after(function () {
    return new Promise(function (resolve) { server.close(resolve); });
  });
  await once(server, 'listening');
  var baseUrl = 'http://127.0.0.1:' + server.address().port;
  var checkout = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ id: 1, qty: 2 }, { id: 2, qty: 1 }, { id: 3, qty: 1 }],
      coupon: ' save10 ',
      paymentMode: 'khata',
      customerId: 1
    })
  };

  var previewResponse = await fetch(baseUrl + '/api/pricing/preview', checkout);
  assert.equal(previewResponse.status, 200);
  var preview = await previewResponse.json();
  assert.equal(preview.couponStatus.code, 'SAVE10');
  assert.deepEqual(preview.totals, {
    subtotal: 700, discount: 70, taxable: 630, tax: 68.40, cgst: 34.20, sgst: 34.20, total: 698.40,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 200, discount: 20, taxable: 180, tax: 9, net: 189 },
      { id: 2, name: 'Ghee', hsn: '0405', gstPercent: 12, gross: 400, discount: 40, taxable: 360, tax: 43.20, net: 403.20 },
      { id: 3, name: 'Tea', hsn: '0902', gstPercent: 18, gross: 100, discount: 10, taxable: 90, tax: 16.20, net: 106.20 }
    ]
  });

  var orderResponse = await fetch(baseUrl + '/api/orders', checkout);
  assert.equal(orderResponse.status, 201);
  var order = await orderResponse.json();
  assert.equal(order.coupon, 'SAVE10');
  assert.deepEqual([order.subtotal, order.discount, order.tax, order.total], [700, 70, 68.40, 698.40]);
  assert.deepEqual(order.items[0], { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 100, qty: 2 });
  assert.deepEqual(db.orders, [order]);
  assert.equal(db.customers[0].totalBilled, 698.40);
  assert.equal(db.customers[0].balance, 718.40);
  assert.deepEqual(db.products.map(function (p) { return p.stock; }), [8, 9, 9]);
  assert.equal(write.mock.callCount(), 1);

  var printed = invoice.computeInvoiceFigures(order);
  assert.deepEqual([printed.subtotal, printed.discount, printed.tax, printed.cgst, printed.sgst, printed.total],
    [700, 70, 68.40, 34.20, 34.20, 698.40]);
  assert.deepEqual(printed.rows.map(function (row) { return [row.hsn, row.gstPercent, row.lineTax]; }),
    [['1006', 5, 9], ['0405', 12, 43.20], ['0902', 18, 16.20]]);

  var invoiceResponse = await fetch(baseUrl + '/orders/' + order.id + '/invoice');
  assert.equal(invoiceResponse.status, 200);
  var html = await invoiceResponse.text();
  assert.match(html, /<td class="r">5%<\/td><td class="r">₹9\.00<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹68\.40/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹698\.40/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.equal(reports.getGstReconciliation(db).mismatchCount, 0);
});

test('invoice honors the percentage coupon cap and calculates GST after discount', function () {
  var items = [{ name: 'Packaged goods', price: 2000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var order = { items: items, coupon: 'SAVE10', total: billed.total };
  var printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual([billed.discount, billed.taxable, billed.tax, billed.total], [150, 1850, 333, 2183]);
  assert.deepEqual([printed.discount, printed.tax, printed.total], [150, 333, 2183]);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('a flat coupon reduces both checkout and invoice GST', function () {
  var items = [{ name: 'Packaged goods', price: 300, qty: 1 }];
  var billed = pricing.computeTotals(items, 'FLAT50');
  var printed = invoice.computeInvoiceFigures({ items: items, coupon: 'FLAT50' });

  assert.deepEqual([billed.discount, billed.taxable, billed.tax, billed.total], [50, 250, 45, 295]);
  assert.deepEqual([printed.discount, printed.rows[0].lineTax, printed.tax, printed.total], [50, 45, 45, 295]);
});

test('invoice calculation follows checkout rules for expired and below-minimum coupons', function () {
  var items = [{ name: 'Packaged goods', price: 100, qty: 1 }];
  var belowMinimum = invoice.computeInvoiceFigures({ items: items, coupon: 'FLAT50' });
  var expired = invoice.computeInvoiceFigures({ items: items, coupon: 'DIWALI20' });

  assert.equal(pricing.computeTotals(items, 'FLAT50').discount, 0);
  assert.equal(pricing.computeTotals(items, 'DIWALI20').discount, 0);
  assert.deepEqual([belowMinimum.discount, belowMinimum.total], [0, 118]);
  assert.deepEqual([expired.discount, expired.total], [0, 118]);
});

test('invoice honors whole-percent, decimal, and zero GST rates on legacy items', function () {
  var items = [
    { name: 'Whole percent', price: 100, qty: 1, gstRate: 5 },
    { name: 'Decimal rate', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Zero rate', price: 100, qty: 1, gstRate: 0 }
  ];
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items });

  assert.deepEqual(billed.lines.map(function (line) { return [line.gstPercent, line.tax]; }),
    [[5, 5], [5, 5], [0, 0]]);
  assert.deepEqual(printed.rows.map(function (row) { return [row.gstPercent, row.lineTax]; }),
    [[5, 5], [5, 5], [0, 0]]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total], [10, 5, 5, 310]);
});

test('CURRENT BEHAVIOUR: rounded line discounts can add up to more than the billed discount', function () {
  var items = [{ price: 0.10, qty: 1 }, { price: 0.10, qty: 1 }];
  var billed = pricing.computeTotals(items, 'WELCOME');

  assert.deepEqual(billed.lines.map(function (line) { return [line.discount, line.taxable, line.net]; }),
    [[0.01, 0.09, 0.11], [0.01, 0.09, 0.11]]);
  assert.deepEqual([billed.discount, billed.taxable, billed.tax, billed.total], [0.01, 0.19, 0.04, 0.23]);
});

test('invoice GST sums the same rounded line taxes as checkout', function () {
  var items = [{ price: 0.03, qty: 1 }, { price: 0.03, qty: 1 }];
  var billed = pricing.computeTotals(items, '');
  var printed = invoice.computeInvoiceFigures({ items: items });

  assert.deepEqual(billed.lines.map(function (line) { return line.tax; }), [0.01, 0.01]);
  assert.deepEqual([billed.tax, billed.cgst, billed.sgst, billed.total], [0.02, 0.01, 0.01, 0.08]);
  assert.deepEqual(printed.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.deepEqual([printed.tax, printed.cgst, printed.sgst, printed.total], [0.02, 0.01, 0.01, 0.08]);
});

test('CURRENT BEHAVIOUR: a GST-only mismatch counts in reconciliation but has no invoice notice', function () {
  var order = {
    id: 1001,
    items: [{ name: 'Loose goods', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 2,
    tax: 20,
    total: 118
  };
  var cancelled = Object.assign({}, order, { id: 1002, status: 'cancelled' });
  var reconciliation = reports.getGstReconciliation({ orders: [order, cancelled] });

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 1);
  assert.equal(reconciliation.totalDelta, 0);
  assert.deepEqual(reconciliation.rows[0], {
    orderId: 1001, date: undefined, customer: 'Walk-in', coupon: '',
    ledgerSubtotal: 100, ledgerDiscount: 2, ledgerTax: 20, ledgerTotal: 118,
    invoiceDiscount: 0, invoiceTax: 18, invoiceTotal: 118, delta: 0, matched: false
  });
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});
