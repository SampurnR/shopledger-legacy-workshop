var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

var mixedSlabItems = [
  { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 500, qty: 2 },
  { id: 2, sku: 'SPICE', name: 'Spices', hsn: '0904', price: 1000, qty: 1 }
];

test('printable invoice matches the billed total and GST for a mixed-slab order with a capped coupon', function () {
  var order = {
    id: 1,
    items: [
      { name: 'Rice', hsn: '1006', price: 640, qty: 2 },
      { name: 'Ghee', hsn: '0405', price: 260, qty: 3 }
    ],
    coupon: 'SAVE10',
    subtotal: 2060,
    discount: 150,
    tax: 146.12,
    total: 2056.12
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(figures.total, order.total);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.deepEqual([figures.cgst, figures.sgst], [73.06, 73.06]);
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.gstPercent, row.lineTax];
  }), [[5, 59.34], [12, 86.78]]);

  var html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹146\.12/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2056\.12/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('billing apportions a capped coupon before applying HSN GST per line', function () {
  var bill = pricing.computeTotals(mixedSlabItems, 'SAVE10');

  assert.deepEqual(bill, {
    subtotal: 2000, discount: 150, taxable: 1850, tax: 157.25,
    cgst: 78.63, sgst: 78.62, total: 2007.25,
    lines: [
      { id: 1, name: 'Rice', hsn: '1006', gstPercent: 5, gross: 1000,
        discount: 75, taxable: 925, tax: 46.25, net: 971.25 },
      { id: 2, name: 'Spices', hsn: '0904', gstPercent: 12, gross: 1000,
        discount: 75, taxable: 925, tax: 111, net: 1036 }
    ]
  });
});

test('invoice uses the billed GST slabs on HSN-only lines', function () {
  var bill = pricing.computeTotals(mixedSlabItems, '');
  var order = { id: 1, items: mixedSlabItems, total: bill.total };
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(bill.tax, 170);
  assert.equal(bill.total, 2170);
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.hsn, row.gstPercent, row.lineTax];
  }), [['1006', 5, 50], ['0904', 12, 120]]);
  assert.equal(figures.tax, 170);
  assert.equal(figures.cgst, 85);
  assert.equal(figures.sgst, 85);
  assert.equal(figures.total, 2170);
});

test('invoice applies the percentage coupon cap before calculating GST', function () {
  var items = [{ name: 'Tea', hsn: '0902', price: 2000, qty: 1 }];
  var bill = pricing.computeTotals(items, 'SAVE10');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.deepEqual([bill.discount, bill.tax, bill.total], [150, 333, 2183]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [150, 333, 2183]);
});

test('invoice ignores a stored inactive coupon as billing does', function () {
  var items = [{ name: 'Tea', hsn: '0902', price: 1000, qty: 1 }];
  var bill = pricing.computeTotals(items, 'DIWALI20');
  var figures = invoice.computeInvoiceFigures({ items: items, coupon: 'DIWALI20' });

  assert.deepEqual([bill.discount, bill.tax, bill.total], [0, 180, 1180]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [0, 180, 1180]);
});

test('invoice interprets a fractional GST rate as billing does', function () {
  var items = [{ name: 'Rice', hsn: '1006', gstRate: 0.05, price: 100, qty: 1 }];
  var bill = pricing.computeTotals(items, '');
  var figures = invoice.computeInvoiceFigures({ items: items });

  assert.deepEqual([bill.lines[0].gstPercent, bill.tax, bill.total], [5, 5, 105]);
  assert.deepEqual([figures.rows[0].gstPercent, figures.tax, figures.total], [5, 5, 105]);
});

test('reconciliation matches both GST and total for a discounted order', function () {
  var order = {
    id: 1,
    date: '28/11/2026',
    status: 'completed',
    items: [{ name: 'Tea', hsn: '0902', price: 500, qty: 1 }],
    coupon: 'SAVE10',
    subtotal: 500,
    discount: 50,
    tax: 81,
    total: 531
  };
  var reconciliation = reports.getGstReconciliation({ orders: [order] });

  assert.equal(reconciliation.totalChecked, 1);
  assert.equal(reconciliation.mismatchCount, 0);
  assert.equal(reconciliation.totalDelta, 0);
  assert.deepEqual(reconciliation.rows[0], {
    orderId: 1, date: '28/11/2026', customer: 'Walk-in', coupon: 'SAVE10',
    ledgerSubtotal: 500, ledgerDiscount: 50, ledgerTax: 81, ledgerTotal: 531,
    invoiceDiscount: 50, invoiceTax: 81, invoiceTotal: 531, delta: 0, matched: true
  });

  var html = invoice.render(order);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹81\.00/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹531\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
