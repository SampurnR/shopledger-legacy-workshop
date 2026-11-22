var assert = require('node:assert/strict');
var test = require('node:test');

var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');

test('invoice matches checkout for mixed HSN rates and a capped coupon', function () {
  var items = [
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 500 },
    { id: 2, name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 1, price: 1000 }
  ];
  var order = {
    id: 1,
    items: items,
    coupon: 'SAVE10',
    subtotal: 2000,
    discount: 150,
    tax: 157.25,
    total: 2007.25
  };
  var checkout = pricing.computeTotals(items, order.coupon);
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(
    [checkout.subtotal, checkout.discount, checkout.tax, checkout.total],
    [2000, 150, 157.25, 2007.25]
  );
  assert.deepEqual(figures, {
    subtotal: 2000,
    discount: 150,
    tax: 157.25,
    cgst: 78.63,
    sgst: 78.62,
    total: 2007.25,
    rows: [
      { name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 500, gstPercent: 5, line: 1000, lineTax: 46.25 },
      { name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 1, price: 1000, gstPercent: 12, line: 1000, lineTax: 111 }
    ]
  });
  assert.equal(reports.getGstReconciliation({ orders: [order] }).rows[0].matched, true);
});

test('invoice uses the fallback GST rate for a line without HSN and honours a stored rate', function () {
  var order = {
    items: [
      { name: 'Legacy line', qty: 1, price: 100 },
      { name: 'Rate override', hsn: '1006', gstRate: 12, qty: 1, price: 100 }
    ]
  };
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(figures.rows.map(function (row) {
    return [row.hsn, row.gstPercent, row.lineTax];
  }), [['-', 18, 18], ['1006', 12, 12]]);
  assert.equal(figures.tax, 30);
  assert.equal(figures.total, 230);
});

test('CURRENT BEHAVIOUR: invoice replaces stored billing amounts with a recalculation', function () {
  var order = {
    id: 2,
    items: [{ name: 'Rice', hsn: '1006', qty: 1, price: 1000 }],
    coupon: 'SAVE10',
    subtotal: 1000,
    discount: 20,
    tax: 49,
    total: 1029
  };
  var figures = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);
  var report = reports.getGstReconciliation({ orders: [order] });

  assert.deepEqual([figures.discount, figures.tax, figures.total], [100, 45, 945]);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹945\.00/);
  assert.match(html, /Invoice computed total \(₹945\.00\) differs from Order Ledger recorded total \(₹1029\.00\) by -₹84\.00/);
  assert.equal(report.mismatchCount, 1);
  assert.equal(report.rows[0].delta, -84);
  assert.deepEqual([order.discount, order.tax, order.total], [20, 49, 1029]);
});

test('CURRENT BEHAVIOUR: printable invoice shows combined GST without separate CGST and SGST amounts', function () {
  var order = {
    id: 3,
    items: [{ name: 'Ghee', hsn: '0405', qty: 1, price: 100 }],
    total: 112
  };
  var figures = invoice.computeInvoiceFigures(order);
  var html = invoice.render(order);

  assert.deepEqual([figures.cgst, figures.sgst], [6, 6]);
  assert.match(html, /GST %<\/th><th[^>]*>GST Amt<\/th>/);
  assert.match(html, /12%<\/td><td[^>]*>₹12\.00<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>₹12\.00/);
  assert.doesNotMatch(html, /₹6\.00/);
});

test('CURRENT BEHAVIOUR: GST-only mismatches appear in reconciliation without an invoice warning', function () {
  var order = {
    id: 4,
    items: [{ name: 'Legacy line', qty: 1, price: 100 }],
    subtotal: 100,
    discount: 10,
    tax: 28,
    total: 118
  };
  var report = reports.getGstReconciliation({ orders: [order] });
  var row = report.rows[0];

  assert.deepEqual([row.ledgerTax, row.invoiceTax, row.delta, row.matched], [28, 18, 0, false]);
  assert.equal(report.mismatchCount, 1);
  assert.equal(report.totalDelta, 0);
  assert.doesNotMatch(invoice.render(order), /Accountant Reconciliation Notice/);
});

test('printable invoice shows the checkout GST by HSN and the billed total', function () {
  var order = {
    id: 5,
    items: [
      { name: 'Rice', hsn: '1006', qty: 2, price: 500 },
      { name: 'Ghee', hsn: '0405', qty: 1, price: 1000 }
    ],
    coupon: 'SAVE10',
    subtotal: 2000,
    discount: 150,
    tax: 157.25,
    total: 2007.25
  };
  var html = invoice.render(order);
  var invoiceTotal = Number(/Invoice Total<\/td><td[^>]*>₹([\d.]+)/.exec(html)[1]);

  assert.equal(invoiceTotal, order.total);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td[^>]*>₹157\.25/);
  assert.match(html, /5%<\/td><td[^>]*>₹46\.25<\/td>/);
  assert.match(html, /12%<\/td><td[^>]*>₹111\.00<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
