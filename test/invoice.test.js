var assert = require('node:assert/strict');
var test = require('node:test');
var coupons = require('../lib/coupons');
var invoice = require('../lib/invoice');
var ledger = require('../lib/ledger');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

function recordOrder(db, items, coupon, bill, status) {
  return orders.add(db, {
    date: '2021-11-15',
    customer: 'Test Customer',
    status: status,
    items: items,
    coupon: coupon,
    subtotal: bill.subtotal,
    discount: bill.discount,
    tax: bill.tax,
    total: bill.total
  });
}

test('mixed HSN slabs and a capped coupon produce matching billed and printed amounts', function () {
  var items = [
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', price: 500, qty: 2 },
    { id: 2, name: 'Ghee', sku: 'GHEE', hsn: '0405', price: 500, qty: 1 },
    { id: 3, name: 'Tea', sku: 'TEA', hsn: '0902', price: 500, qty: 1 }
  ];
  var db = { nextOrderId: 1, orders: [], customers: [{ id: 1, creditLimit: 3000 }] };
  var bill = pricing.computeTotals(items, 'SAVE10');

  assert.deepEqual(bill, {
    subtotal: 2000, discount: 150, taxable: 1850, tax: 185,
    cgst: 92.5, sgst: 92.5, total: 2035,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 1000, discount: 75, taxable: 925, tax: 46.25, net: 971.25 },
      { id: 2, name: 'Ghee', hsn: '0405', gstPercent: 12, gross: 500, discount: 37.5, taxable: 462.5, tax: 55.5, net: 518 },
      { id: 3, name: 'Tea', hsn: '0902', gstPercent: 18, gross: 500, discount: 37.5, taxable: 462.5, tax: 83.25, net: 545.75 }
    ]
  });

  var charge = ledger.chargeOrderToKhata(db, 1, bill.total);
  assert.equal(charge.ok, true);
  assert.equal(charge.customer.totalBilled, 2035);
  var order = recordOrder(db, items, 'SAVE10', bill);
  assert.equal(order.total, 2035);

  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 2000, discount: 150, tax: 185, cgst: 92.5, sgst: 92.5, total: 2035,
    rows: [
      { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 500, gstPercent: 5, line: 1000, lineTax: 46.25 },
      { name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 1, price: 500, gstPercent: 12, line: 500, lineTax: 55.5 },
      { name: 'Tea', sku: 'TEA', hsn: '0902', qty: 1, price: 500, gstPercent: 18, line: 500, lineTax: 83.25 }
    ]
  });

  var html = invoice.render(order);
  assert.match(html, /5%<\/td><td class="r">₹46\.25/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹185\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2035\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  recordOrder(db, items, 'SAVE10', bill, 'cancelled');
  assert.deepEqual(reports.getGstReconciliation(db), {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{
      orderId: 1, date: '2021-11-15', customer: 'Test Customer', coupon: 'SAVE10',
      ledgerSubtotal: 2000, ledgerDiscount: 150, ledgerTax: 185, ledgerTotal: 2035,
      invoiceDiscount: 150, invoiceTax: 185, invoiceTotal: 2035, delta: 0, matched: true
    }]
  });
});

[
  { rate: 0.05, billedTax: 5, printedRate: 5 },
  { rate: 0, billedTax: 0, printedRate: 0 }
].forEach(function (example) {
  test('invoice uses checkout GST for explicit gstRate ' + example.rate + ' on a stored line', function () {
    var items = [{ name: 'Rice', hsn: '1006', price: 100, qty: 1, gstRate: example.rate }];
    var bill = pricing.computeTotals(items, '');
    var figures = invoice.computeInvoiceFigures({ items: items });

    assert.equal(bill.tax, example.billedTax);
    assert.equal(figures.tax, example.billedTax);
    assert.equal(figures.rows[0].gstPercent, example.printedRate);
  });
});

[
  { code: 'FLAT50', price: 100, invoiceTotal: 118 },
  { code: 'DIWALI20', price: 1000, invoiceTotal: 1180 }
].forEach(function (example) {
  test('invoice rejects ' + example.code + ' on a stored order under checkout rules', function () {
    var items = [{ name: 'Tea', hsn: '0902', price: example.price, qty: 1 }];
    var bill = pricing.computeTotals(items, example.code);
    var figures = invoice.computeInvoiceFigures({ items: items, coupon: example.code });

    assert.equal(coupons.validate(example.code, bill.subtotal).valid, false);
    assert.equal(bill.discount, 0);
    assert.equal(figures.discount, bill.discount);
    assert.equal(figures.total, example.invoiceTotal);
  });
});

test('invoice aggregate GST equals the sum of its rounded line GST', function () {
  var items = [
    { name: 'Tea', price: 0.03, qty: 1 },
    { name: 'Coffee', price: 0.03, qty: 1 }
  ];
  var bill = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({ items: items });

  assert.deepEqual(bill.lines.map(function (line) { return line.tax; }), [0.01, 0.01]);
  assert.equal(bill.tax, 0.02);
  assert.equal(bill.total, 0.08);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.equal(figures.tax, 0.02);
  assert.equal(figures.cgst, 0.01);
  assert.equal(figures.sgst, 0.01);
  assert.equal(figures.total, 0.08);
});

test('a tax-only difference is flagged by the report and produces no invoice notice', function () {
  var db = { nextOrderId: 1, orders: [] };
  var items = [{ name: 'Tea', price: 100, qty: 1 }];
  var order = recordOrder(db, items, '', { subtotal: 100, discount: 0, tax: 17.99, total: 118 });
  var report = reports.getGstReconciliation(db);

  assert.equal(report.mismatchCount, 1);
  assert.equal(report.totalDelta, 0);
  assert.equal(report.rows[0].invoiceTax, 18);
  assert.equal(report.rows[0].matched, false);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('billing and invoice both accept a whole-number GST percentage', function () {
  var items = [{ name: 'Rice', hsn: '1006', price: 100, qty: 1, gstRate: 5 }];
  var bill = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({ items: items });

  assert.equal(bill.tax, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.rows[0].gstPercent, 5);
});

test('an undiscounted 18% HSN order matches its invoice and reconciliation report', function () {
  var db = { nextOrderId: 1, orders: [] };
  var items = [{ name: 'Tea', hsn: '0902', price: 100, qty: 2 }];
  var order = recordOrder(db, items, '', pricing.computeTotals(items, ''));
  var report = reports.getGstReconciliation(db);

  assert.equal(order.tax, 36);
  assert.equal(order.total, 236);
  assert.equal(report.rows[0].invoiceTax, 36);
  assert.equal(report.rows[0].invoiceTotal, 236);
  assert.equal(report.rows[0].matched, true);
  assert.equal(report.mismatchCount, 0);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('a capped SAVE10 invoice matches the recorded mixed-GST order', function () {
  var db = { nextOrderId: 1, orders: [] };
  var items = [
    { name: 'Rice', hsn: '1006', price: 640, qty: 2 },
    { name: 'Butter', hsn: '0405', price: 260, qty: 1 },
    { name: 'Tea', hsn: '0902', price: 140, qty: 1 }
  ];
  var order = recordOrder(db, items, 'SAVE10', pricing.computeTotals(items, 'SAVE10'));
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.total, 1639.65);
  assert.equal(figures.total, order.total);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.match(invoice.render(order), /Invoice Total<\/td><td class="r">₹1639\.65/);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
  assert.equal(reports.getGstReconciliation(db).rows[0].matched, true);
});
