var assert = require('node:assert/strict');
var test = require('node:test');
var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function line(id, name, hsn, price) {
  return { id: id, name: name, hsn: hsn, price: price, qty: 1 };
}

function recordOrder(items, coupon) {
  var db = { orders: [], nextOrderId: 1001 };
  var billed = pricing.computeTotals(items, coupon);
  var order = orders.add(db, {
    date: '2021-11-15',
    items: items,
    coupon: coupon,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });
  return { db: db, billed: billed, order: order };
}

function discountedOrder() {
  return recordOrder([
    line(1, 'Rice', '1006', 1000),
    line(2, 'Ghee', '0405', 1000)
  ], 'SAVE10');
}

test('invoice matches the ledger for an undiscounted fallback-rate item', function () {
  var sale = recordOrder([line(1, 'Unclassified item', '', 100)], '');
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.equal(sale.order.total, 118);
  assert.equal(figures.total, 118);
  assert.equal(figures.tax, 18);
  assert.equal(figures.cgst, 9);
  assert.equal(figures.sgst, 9);
  assert.doesNotMatch(invoice.render(sale.order), /Accountant Reconciliation Notice/);
});

test('invoice shows the stored HSN and its billed GST rate', function () {
  var sale = recordOrder([line(1, 'Rice', '1006', 100)], '');
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.equal(figures.rows[0].hsn, '1006');
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 5);
  assert.equal(figures.total, 105);
});

test('invoice and billing agree on decimal, zero, and percentage GST rates', function () {
  var items = [
    { name: 'Decimal rate', price: 100, qty: 1, gstRate: 0.05 },
    { name: 'Zero rate', price: 100, qty: 1, gstRate: 0 },
    { name: 'Percentage rate', price: 100, qty: 1, gstRate: 5 }
  ];
  var sale = recordOrder(items, '');
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.deepEqual(sale.billed.lines.map(function (item) {
    return [item.gstPercent, item.tax];
  }), [[5, 5], [0, 0], [5, 5]]);
  assert.deepEqual(figures.rows.map(function (item) {
    return [item.gstPercent, item.lineTax];
  }), [[5, 5], [0, 0], [5, 5]]);
});

test('invoice GST sums the same rounded line amounts as billing', function () {
  var sale = recordOrder([
    line(1, 'First small line', '', 0.03),
    line(2, 'Second small line', '', 0.03)
  ], '');
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.equal(sale.order.tax, 0.02);
  assert.equal(sale.order.total, 0.08);
  assert.deepEqual(figures.rows.map(function (item) {
    return item.lineTax;
  }), [0.01, 0.01]);
  assert.equal(figures.tax, 0.02);
  assert.equal(figures.total, 0.08);
});

test('invoice HTML displays billed figures and warns if the recorded total differs', function () {
  var sale = discountedOrder();
  var html = invoice.render(sale.order);

  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  sale.order.total = 2007.24;
  assert.match(invoice.render(sale.order), /Accountant Reconciliation Notice:.* by \+₹0\.01\./);
});

test('GST reconciliation reports the stored and recomputed figures and skips cancelled orders', function () {
  var sale = discountedOrder();
  sale.db.orders.push(Object.assign({}, sale.order, { id: 1002, status: 'cancelled' }));

  assert.deepEqual(reports.getGstReconciliation(sale.db), {
    totalChecked: 1,
    mismatchCount: 0,
    totalDelta: 0,
    rows: [{
      orderId: 1001,
      date: '2021-11-15',
      customer: 'Walk-in',
      coupon: 'SAVE10',
      ledgerSubtotal: 2000,
      ledgerDiscount: 150,
      ledgerTax: 157.25,
      ledgerTotal: 2007.25,
      invoiceDiscount: 150,
      invoiceTax: 157.25,
      invoiceTotal: 2007.25,
      delta: 0,
      matched: true
    }]
  });
});

test('CURRENT BEHAVIOUR: a GST-only mismatch is reported but produces no invoice notice', function () {
  var sale = recordOrder([line(1, 'Unclassified item', '', 100)], '');
  sale.order.tax = 17.99;

  var reconciliation = reports.getGstReconciliation(sale.db);
  assert.equal(reconciliation.mismatchCount, 1);
  assert.equal(reconciliation.totalDelta, 0);
  assert.equal(reconciliation.rows[0].matched, false);
  assert.doesNotMatch(invoice.render(sale.order), /Accountant Reconciliation Notice/);
});

test('invoice total, coupon, and GST breakdown match a billed mixed-slab order', function () {
  var sale = discountedOrder();
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.deepEqual({
    total: figures.total,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    lines: figures.rows.map(function (row) { return [row.gstPercent, row.lineTax]; })
  }, {
    total: 2007.25,
    discount: 150,
    tax: 157.25,
    cgst: 78.63,
    sgst: 78.62,
    lines: [[5, 46.25], [12, 111]]
  });
});

test('reprinting an order preserves its recorded discount after the coupon expires', function () {
  var order = {
    items: [line(1, 'Rice', '1006', 1000)],
    coupon: 'DIWALI20',
    discount: 200,
    tax: 40,
    total: 840
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.discount, 200);
  assert.equal(figures.rows[0].lineTax, 40);
  assert.equal(figures.tax, 40);
  assert.equal(figures.total, 840);
});

test('reconciliation flags a recorded discount on an order without a coupon', function () {
  var sale = recordOrder([line(1, 'Rice', '1006', 100)], '');
  sale.order.discount = 10;
  sale.order.tax = 4.5;
  sale.order.total = 94.5;

  var result = reports.getGstReconciliation(sale.db);
  assert.equal(result.rows[0].invoiceDiscount, 0);
  assert.equal(result.rows[0].invoiceTotal, 105);
  assert.equal(result.rows[0].matched, false);
  assert.match(invoice.render(sale.order), /Accountant Reconciliation Notice/);
});

test('invoice pricing rejects recorded discounts outside the order subtotal', function () {
  var order = {
    items: [line(1, 'Rice', '1006', 100)],
    coupon: 'DIWALI20'
  };

  [-10, 120].forEach(function (discount) {
    order.discount = discount;
    var figures = invoice.computeInvoiceFigures(order);
    assert.equal(figures.discount, 0);
    assert.equal(figures.tax, 5);
    assert.equal(figures.total, 105);
  });
});
