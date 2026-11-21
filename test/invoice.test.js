var assert = require('node:assert/strict');
var test = require('node:test');
var invoice = require('../lib/invoice');
var orders = require('../lib/orders');
var pricing = require('../lib/pricing');
var reports = require('../lib/reports');
var config = require('../config');

function billOrder(items, coupon) {
  var billed = pricing.computeTotals(items, coupon);
  var order = orders.add({ nextOrderId: 1001, orders: [] }, {
    date: '2021-11-01',
    items: items,
    coupon: coupon,
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });
  return { billed: billed, order: order };
}

test('invoice matches the amount and GST billed for a discounted rice order', function () {
  var sale = billOrder([{ name: 'Rice', hsn: '1006', qty: 1, price: 640 }], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.equal(sale.order.total, 604.8);
  assert.equal(sale.order.tax, 28.8);
  assert.equal(figures.total, 604.8);
  assert.equal(figures.tax, 28.8);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[0].lineTax, 28.8);

  var html = invoice.render(sale.order);
  assert.match(html, /Invoice Total<\/td><td class="r">₹604\.80<\/td>/);
  assert.match(html, /Total GST\)<\/td><td class="r">₹28\.80<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});

test('invoice and GST audit retain a billed discount after the coupon is deactivated', function () {
  var sale = billOrder([{ name: 'Rice', hsn: '1006', qty: 1, price: 640 }], 'SAVE10');
  var coupon = config.coupons.SAVE10;
  var wasActive = coupon.active;
  coupon.active = false;

  try {
    var figures = invoice.computeInvoiceFigures(sale.order);
    assert.equal(figures.discount, 64);
    assert.equal(figures.rows[0].lineTax, 28.8);
    assert.equal(figures.total, 604.8);
    assert.doesNotMatch(invoice.render(sale.order), /Accountant Reconciliation Notice/);

    var audit = reports.getGstReconciliation({ orders: [sale.order] });
    assert.equal(audit.rows[0].invoiceTax, 28.8);
    assert.equal(audit.rows[0].invoiceTotal, 604.8);
    assert.equal(audit.rows[0].matched, true);
    assert.equal(audit.mismatchCount, 0);
  } finally {
    coupon.active = wasActive;
  }
});

test('invoice uses billed HSN rates and the capped percentage discount', function () {
  var sale = billOrder([
    { id: 1, name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 500 },
    { id: 2, name: 'Ghee', sku: 'GHEE', hsn: '0405', qty: 1, price: 1000 }
  ], 'SAVE10');

  assert.deepEqual(sale.billed.lines.map(function (line) {
    return [line.gstPercent, line.discount, line.taxable, line.tax];
  }), [[5, 75, 925, 46.25], [12, 75, 925, 111]]);
  assert.equal(sale.order.discount, 150);
  assert.equal(sale.order.tax, 157.25);
  assert.equal(sale.order.total, 2007.25);
  assert.equal(sale.billed.cgst, 78.63);
  assert.equal(sale.billed.sgst, 78.62);

  assert.deepEqual(invoice.computeInvoiceFigures(sale.order), {
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

  var html = invoice.render(sale.order);
  assert.match(html, /<td>1006<\/td>.*<td class="r">5%<\/td><td class="r">₹46\.25<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹157\.25<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">₹2007\.25<\/td>/);
});

test('invoice calculates GST after applying a flat coupon', function () {
  var sale = billOrder([{ name: 'Miscellaneous', qty: 1, price: 300 }], 'FLAT50');
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.equal(sale.order.discount, 50);
  assert.equal(sale.order.tax, 45);
  assert.equal(sale.order.total, 295);
  assert.equal(figures.discount, 50);
  assert.equal(figures.tax, 45);
  assert.equal(figures.total, 295);
});

test('invoice honours decimal, zero, and whole-percent GST rates', function () {
  var sale = billOrder([
    { name: 'Decimal rate', qty: 1, price: 100, gstRate: 0.05 },
    { name: 'Zero rate', qty: 1, price: 100, gstRate: 0 },
    { name: 'Whole percent rate', qty: 1, price: 100, gstRate: 5 }
  ]);
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.deepEqual(sale.billed.lines.map(function (line) {
    return [line.gstPercent, line.tax];
  }), [[5, 5], [0, 0], [5, 5]]);
  assert.equal(sale.order.total, 310);
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.gstPercent, row.lineTax];
  }), [[5, 5], [0, 0], [5, 5]]);
  assert.equal(figures.tax, 10);
  assert.equal(figures.total, 310);
});

test('invoice rounds GST per line before summing and splitting it', function () {
  var sale = billOrder([
    { name: 'First line', qty: 1, price: 0.03 },
    { name: 'Second line', qty: 1, price: 0.03 }
  ]);
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.equal(sale.order.tax, 0.02);
  assert.equal(sale.order.total, 0.08);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.equal(figures.tax, 0.02);
  assert.equal(figures.cgst, 0.01);
  assert.equal(figures.sgst, 0.01);
  assert.equal(figures.total, 0.08);
  assert.doesNotMatch(invoice.render(sale.order), /Accountant Reconciliation Notice/);
});

test('CURRENT BEHAVIOUR: invoice warns when the stored total differs by one paisa', function () {
  var sale = billOrder([{ name: 'Miscellaneous', qty: 1, price: 100 }]);
  sale.order.total = 118.01;

  assert.match(invoice.render(sale.order), /Invoice computed total \(₹118\.00\) differs from Order Ledger recorded total \(₹118\.01\) by -₹0\.01\./);
});

test('CURRENT BEHAVIOUR: invoice omits the reconciliation notice when the billed total matches', function () {
  var sale = billOrder([{ name: 'Miscellaneous', qty: 1, price: 100 }]);
  var html = invoice.render(sale.order);

  assert.equal(sale.order.total, 118);
  assert.match(html, /Invoice Total<\/td><td class="r">₹118\.00<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
