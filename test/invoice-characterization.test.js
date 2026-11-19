var assert = require('node:assert/strict');
var test = require('node:test');
var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

var mixedSlabItems = [
  { id: 1, name: 'Rice', hsn: '1006', price: 500, qty: 2 },
  { id: 2, name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
];

function recordOrder(db, items, coupon) {
  var totals = pricing.computeTotals(items, coupon);
  return orders.add(db, {
    date: '15/11/2026',
    items: items,
    coupon: coupon,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
}

test('checkout caps SAVE10 and applies each HSN rate after allocating the discount', function () {
  var totals = pricing.computeTotals(mixedSlabItems, 'SAVE10');
  var lines = totals.lines;
  delete totals.lines;

  assert.deepEqual(totals, {
    subtotal: 2000,
    discount: 150,
    taxable: 1850,
    tax: 157.25,
    cgst: 78.63,
    sgst: 78.62,
    total: 2007.25
  });
  assert.deepEqual(lines.map(function (line) {
    return [line.gstPercent, line.discount, line.taxable, line.tax];
  }), [
    [5, 75, 925, 46.25],
    [12, 75, 925, 111]
  ]);
});

test('invoice uses the capped coupon and splits checkout GST including the odd cent', function () {
  var order = recordOrder({ nextOrderId: 1, orders: [] }, mixedSlabItems, 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.subtotal, order.subtotal);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 157.25);
  assert.equal(figures.cgst, 78.63);
  assert.equal(figures.sgst, 78.62);
  assert.equal(figures.total, order.total);
});

test('invoice and checkout both round GST per line before summing', function () {
  var items = [
    { id: 1, price: 0.03, qty: 1 },
    { id: 2, price: 0.03, qty: 1 }
  ];
  var order = recordOrder({ nextOrderId: 1, orders: [] }, items);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 0.02);
  assert.equal(order.total, 0.08);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
});

test('CURRENT BEHAVIOUR: reconciliation flags a tax-only mismatch while the invoice shows no warning', function () {
  var db = { nextOrderId: 1, orders: [] };
  var matching = recordOrder(db, [{ price: 100, qty: 1 }]);
  var taxOnly = recordOrder(db, [{ price: 100, qty: 1 }]);
  taxOnly.tax = 17;
  var mismatch = recordOrder(db, mixedSlabItems, 'SAVE10');
  mismatch.total -= 1;
  var cancelled = recordOrder(db, mixedSlabItems, 'SAVE10');
  cancelled.status = 'cancelled';

  assert.doesNotMatch(invoice.render(taxOnly), /Accountant Reconciliation Notice/);
  assert.ok(invoice.render(mismatch).includes(
    'Invoice computed total (₹2007.25) differs from Order Ledger recorded total (₹2006.25) by +₹1.00.'
  ));

  var result = reports.getGstReconciliation(db);
  assert.equal(result.totalChecked, 3);
  assert.equal(result.mismatchCount, 2);
  assert.equal(result.totalDelta, 1);
  assert.deepEqual(result.rows.map(function (row) {
    return [row.orderId, row.ledgerTax, row.invoiceTax, row.delta, row.matched];
  }), [
    [matching.id, 18, 18, 0, true],
    [taxOnly.id, 17, 18, 0, false],
    [mismatch.id, 157.25, 157.25, 1, false]
  ]);
});

test('printed invoice matches billed total and GST for a mixed-slab order with SAVE10', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 640, qty: 3 },
    { id: 7, name: 'Butter', hsn: '0405', price: 260, qty: 1 }
  ];
  var order = recordOrder({ nextOrderId: 1, orders: [] }, items, 'SAVE10');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.total, 2148.44);
  assert.equal(figures.tax, 118.44);
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.gstPercent, row.lineTax];
  }), [[5, 89.39], [12, 29.05]]);

  var html = invoice.render(order);
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹118.44'));
  assert.ok(html.includes('Invoice Total</td><td class="r">₹2148.44'));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('reprinted invoice preserves a historical flat-rate bill with an HSN code', function () {
  var order = {
    items: [{ name: 'Rice', hsn: '1006', price: 500, qty: 1 }],
    subtotal: 500,
    discount: 0,
    tax: 90,
    total: 590
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.total, 590);
  assert.equal(figures.tax, 90);
  assert.equal(figures.rows[0].gstPercent, 18);
  assert.equal(figures.rows[0].lineTax, 90);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('historical percentage discounts retain the original aggregate GST rounding', function () {
  var order = {
    items: [
      { name: 'Rice', hsn: '1006', price: 500, qty: 1 },
      { name: 'Rice sample', hsn: '1006', price: 0.03, qty: 1 }
    ],
    coupon: 'SAVE10',
    subtotal: 500.03,
    discount: 50,
    tax: 81,
    total: 531.03
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.total, 531.03);
  assert.equal(figures.tax, 81);
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.gstPercent, row.lineTax];
  }), [[18, 81], [18, 0]]);
});

test('historical subtotal rounding preserves the originally saved half-cent discount', function () {
  var order = {
    items: [
      { name: 'Rice sample', hsn: '1006', price: 0.15, qty: 1 },
      { name: 'Rice sample', hsn: '1006', price: 0.95, qty: 1 }
    ],
    coupon: 'WELCOME',
    subtotal: 1.10,
    discount: 0.05,
    tax: 0.19,
    total: 1.23
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.discount, 0.05);
  assert.equal(figures.tax, 0.19);
  assert.equal(figures.total, 1.23);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('a flat-rate total with an unexplained discount still triggers reconciliation', function () {
  var order = {
    items: [{ name: 'Rice', hsn: '1006', price: 100, qty: 1 }],
    subtotal: 100,
    discount: 10,
    tax: 16.20,
    total: 106.20
  };

  assert.equal(invoice.computeInvoiceFigures(order).total, 105);
  assert.match(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('historical GST allocation keeps fractional-cent line taxes nonnegative', function () {
  var items = [{ name: 'Rice', hsn: '1006', price: 1, qty: 1 }];
  for (var i = 0; i < 12; i++) {
    items.push({ name: 'Rice sample', hsn: '1006', price: 0.005, qty: 1 });
  }
  items.push({ name: 'Rice sample', hsn: '1006', price: 0.01, qty: 1 });
  var figures = invoice.computeInvoiceFigures({
    items: items,
    subtotal: 1.07,
    discount: 0,
    tax: 0.19,
    total: 1.26
  });

  assert.equal(figures.tax, 0.19);
  assert.equal(figures.total, 1.26);
  assert.ok(figures.rows.every(function (row) { return row.lineTax >= 0; }));
  assert.equal(figures.rows.reduce(function (cents, row) {
    return cents + Math.round(row.lineTax * 100);
  }, 0), 19);
});

test('CURRENT BEHAVIOUR: equally rounded totals use checkout slabs when the order has no pricing version', function () {
  var order = {
    items: [
      { name: 'Tea', hsn: '0902', price: 100, qty: 1 },
      { name: 'Rice sample', hsn: '1006', price: 0.01, qty: 1 }
    ],
    subtotal: 100.01,
    discount: 0,
    tax: 18,
    total: 118.01
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.total, order.total);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.rows[1].gstPercent, 5);
});
