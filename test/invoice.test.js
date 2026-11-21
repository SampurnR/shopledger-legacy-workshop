var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var orders = require('../lib/orders');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function makeOrder(items, coupon) {
  var totals = pricing.computeTotals(items, coupon);
  var db = { nextOrderId: 1001, orders: [] };
  var order = orders.add(db, {
    date: '2021-11-01',
    customer: 'Test Customer',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
  return { db: db, order: order, totals: totals };
}

test('billed order stores the HSN slab tax and total', function () {
  var sale = makeOrder([
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 100, qty: 2 }
  ]);

  assert.deepEqual(
    [sale.order.subtotal, sale.order.discount, sale.order.tax, sale.order.total],
    [200, 0, 10, 210]
  );
  assert.deepEqual(
    [sale.totals.cgst, sale.totals.sgst, sale.totals.lines[0].gstPercent],
    [5, 5, 5]
  );
});

test('invoice matches the billed total and line GST for a capped coupon on mixed HSN slabs', function () {
  var sale = makeOrder([
    { id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 1000, qty: 1 }
  ], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(sale.order);
  var html = invoice.render(sale.order);

  assert.equal(sale.order.total, 2007.25);
  assert.equal(figures.total, sale.order.total);
  assert.equal(figures.discount, 150);
  assert.equal(figures.tax, 157.25);
  assert.deepEqual([figures.cgst, figures.sgst], [78.63, 78.62]);
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.gstPercent, row.lineTax];
  }), [[5, 46.25], [12, 111]]);
  assert.match(html, /Invoice Total<\/td><td class="r">[^0-9<]*2007\.25<\/td>/);
  assert.match(html, /Total GST\)<\/td><td class="r">[^0-9<]*157\.25<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.equal(reports.getGstReconciliation(sale.db).rows[0].matched, true);
});

test('invoice taxes HSN 1006 rice at its 5% slab', function () {
  var sale = makeOrder([
    { id: 1, sku: 'RICE', name: 'Rice', hsn: '1006', price: 100, qty: 2 }
  ]);
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.deepEqual(
    [figures.subtotal, figures.discount, figures.tax, figures.cgst, figures.sgst, figures.total],
    [200, 0, 10, 5, 5, 210]
  );
  assert.deepEqual(
    [figures.rows[0].hsn, figures.rows[0].gstPercent, figures.rows[0].lineTax],
    ['1006', 5, 10]
  );
  assert.equal(sale.order.total, 210);
  assert.doesNotMatch(invoice.render(sale.order), /Accountant Reconciliation Notice/);
});

test('invoice applies the percentage coupon before calculating GST', function () {
  var sale = makeOrder([
    { id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }
  ], 'WELCOME');
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.deepEqual(
    [sale.order.subtotal, sale.order.discount, sale.order.tax, sale.order.total],
    [1000, 50, 47.5, 997.5]
  );
  assert.deepEqual(
    [figures.subtotal, figures.discount, figures.tax, figures.total],
    [1000, 50, 47.5, 997.5]
  );
  assert.deepEqual(
    [sale.totals.lines[0].taxable, sale.totals.lines[0].tax],
    [950, 47.5]
  );
});

test('invoice respects the percentage coupon discount cap', function () {
  var sale = makeOrder([
    { id: 1, name: 'Tea', hsn: '0902', price: 2000, qty: 1 }
  ], 'SAVE10');
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.deepEqual(
    [sale.order.discount, sale.order.tax, sale.order.total],
    [150, 333, 2183]
  );
  assert.deepEqual(
    [figures.discount, figures.tax, figures.total],
    [150, 333, 2183]
  );
});

test('invoice skips a flat coupon below its minimum order', function () {
  var sale = makeOrder([
    { id: 1, name: 'Rice', hsn: '1006', price: 200, qty: 1 }
  ], 'FLAT50');
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.deepEqual([sale.order.discount, sale.order.tax, sale.order.total], [0, 10, 210]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [0, 10, 210]);
});

test('invoice skips a coupon marked inactive', function () {
  var sale = makeOrder([
    { id: 1, name: 'Rice', hsn: '1006', price: 1000, qty: 1 }
  ], 'DIWALI20');
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.deepEqual([sale.order.discount, sale.order.tax, sale.order.total], [0, 50, 1050]);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [0, 50, 1050]);
});

test('invoice accepts a decimal GST rate on a legacy line', function () {
  var sale = makeOrder([
    { id: 1, name: 'Legacy Rice', gstRate: 0.05, price: 100, qty: 1 }
  ]);
  var figures = invoice.computeInvoiceFigures(sale.order);

  assert.deepEqual([sale.order.tax, sale.order.total], [5, 105]);
  assert.deepEqual([figures.rows[0].gstPercent, figures.tax, figures.total], [5, 5, 105]);
});

test('CURRENT BEHAVIOUR: reconciliation flags tax mismatch even when totals match', function () {
  var sale = makeOrder([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ]);
  sale.order.tax = 18;
  sale.db.orders.push({
    id: 1002, date: '2021-11-01', status: 'cancelled', items: sale.order.items,
    subtotal: 100, discount: 0, tax: 5, total: 105
  });
  var recon = reports.getGstReconciliation(sale.db);

  assert.deepEqual(
    [recon.totalChecked, recon.mismatchCount, recon.totalDelta],
    [1, 1, 0]
  );
  assert.deepEqual(
    [recon.rows[0].ledgerTax, recon.rows[0].invoiceTax, recon.rows[0].delta, recon.rows[0].matched],
    [18, 5, 0, false]
  );
  assert.doesNotMatch(invoice.render(sale.order), /Accountant Reconciliation Notice/);

  sale.order.total = 118;
  assert.match(invoice.render(sale.order), /Invoice computed total \([^)]*105\.00\).*Order Ledger recorded total \([^)]*118\.00\).*by -[^0-9]*13\.00/);
});
