// Characterization only: these expectations preserve today's calculations,
// including discrepancies. All orders and report data are created in memory.
var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');
var orders = require('../lib/orders');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function billedOrder(items, coupon) {
  var totals = pricing.computeTotals(items, coupon);
  // Match the fields saved by the checkout route, without importing the store.
  return orders.add({ orders: [], nextOrderId: 1001 }, {
    date: '15/11/2026',
    customer: 'Test Customer',
    items: items,
    coupon: coupons.normalizeCode(coupon),
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
}

test('invoice preserves checkout HSN slabs and coupon totals', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 500, qty: 1 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 500, qty: 1 },
    { id: 3, name: 'Tea', hsn: '0902', price: 500, qty: 1 }
  ];
  var totals = pricing.computeTotals(items, 'SAVE10');
  assert.deepEqual(totals.lines.map(function (line) {
    return [line.gstPercent, line.discount, line.taxable, line.tax, line.net];
  }), [[5, 50, 450, 22.5, 472.5], [12, 50, 450, 54, 504], [18, 50, 450, 81, 531]]);
  assert.deepEqual([totals.subtotal, totals.discount, totals.taxable,
    totals.tax, totals.cgst, totals.sgst, totals.total],
  [1500, 150, 1350, 157.5, 78.75, 78.75, 1507.5]);

  var order = billedOrder(items, ' save10 ');
  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(order.coupon, 'SAVE10');
  assert.deepEqual(figures.rows.map(function (row) {
    return [row.hsn, row.gstPercent, row.line, row.lineTax];
  }), [['1006', 5, 500, 22.5], ['0405', 12, 500, 54], ['0902', 18, 500, 81]]);
  assert.deepEqual([figures.subtotal, figures.discount, figures.tax,
    figures.cgst, figures.sgst, figures.total], [1500, 150, 157.5, 78.75, 78.75, 1507.5]);
});

test('invoice line GST matches checkout GST and its summary after discount rounding', function () {
  var items = [
    { id: 1, name: 'Rice', hsn: '1006', price: 1, qty: 1 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 1.1, qty: 1 }
  ];
  var totals = pricing.computeTotals(items, 'WELCOME');
  var order = billedOrder(items, 'WELCOME');
  var figures = invoice.computeInvoiceFigures(order);

  assert.deepEqual(totals.lines.map(function (line) { return line.tax; }), [0.05, 0.12]);
  assert.deepEqual([order.discount, order.tax, order.total], [0.11, 0.17, 2.16]);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [0.05, 0.12]);
  assert.equal(pricing.round2(figures.rows.reduce(function (sum, row) {
    return sum + row.lineTax;
  }, 0)), figures.tax);
  assert.deepEqual([figures.tax, figures.total], [0.17, 2.16]);

  var html = invoice.render(order);
  assert.ok(html.includes('<td class="r">₹0.12</td>'));
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹0.17'));
  assert.ok(html.includes('Invoice Total</td><td class="r">₹2.16'));
});

test('CURRENT BEHAVIOUR: invoice uses billed order totals rather than recalculating coupon figures', function () {
  var order = billedOrder([
    { id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }
  ], 'SAVE10');
  assert.deepEqual([order.subtotal, order.discount, order.tax, order.total],
    [2000, 150, 92.5, 1942.5]);
  var before = JSON.stringify(order);
  var figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual([figures.subtotal, figures.discount, figures.tax,
    figures.cgst, figures.sgst, figures.total], [2000, 150, 92.5, 46.25, 46.25, 1942.5]);
  assert.equal(JSON.stringify(order), before);

  var changedLedger = Object.assign({}, order, {
    subtotal: 1, discount: 2, tax: 3, total: 4
  });
  assert.deepEqual([invoice.computeInvoiceFigures(changedLedger).total,
    invoice.computeInvoiceFigures(changedLedger).tax], [4, 3]);
});

test('CURRENT BEHAVIOUR: flat coupon invoice uses stored checkout GST and total', function () {
  var order = billedOrder([
    { id: 1, name: 'Tea', hsn: '0902', price: 500, qty: 1 }
  ], 'FLAT50');
  assert.deepEqual([order.discount, order.tax, order.total], [50, 81, 531]);
  var figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [50, 81, 531]);
});

test('CURRENT BEHAVIOUR: invoice uses stored zero discount on expired and below-minimum coupons', function () {
  // Checkout validation rejects these; historical/supplied orders still render.
  var items = [{ id: 1, name: 'Tea', hsn: '0902', price: 100, qty: 1 }];
  ['SAVE10', 'FLAT50', 'DIWALI20'].forEach(function (code, index) {
    assert.equal(coupons.validate(code, 100).valid, false);
    var order = billedOrder(items, code);
    assert.deepEqual([order.discount, order.tax, order.total], [0, 18, 118]);
    var figures = invoice.computeInvoiceFigures(order);
    assert.equal(figures.discount, 0);
    assert.equal(figures.total, 118);
  });
  var rawOrder = { items: items, coupon: ' save10 ' };
  assert.equal(invoice.computeInvoiceFigures(rawOrder).discount, 0);
  assert.equal(invoice.computeInvoiceFigures({ items: items, coupon: 'UNKNOWN' }).discount, 0);
});

test('invoice uses tax module explicit GST rates and stored tax totals', function () {
  [
    { rate: 12, checkoutTax: 12, invoicePercent: 12, invoiceTax: 12 },
    { rate: 0.12, checkoutTax: 12, invoicePercent: 12, invoiceTax: 12 },
    { rate: 0.125, checkoutTax: 12.5, invoicePercent: 12.5, invoiceTax: 12.5 },
    { rate: 0, checkoutTax: 0, invoicePercent: 0, invoiceTax: 0 }
  ].forEach(function (example) {
    var order = billedOrder([
      { id: 1, name: 'Explicit rate', price: 100, qty: 1, gstRate: example.rate }
    ], '');
    var figures = invoice.computeInvoiceFigures(order);
    assert.equal(order.tax, example.checkoutTax);
    assert.equal(figures.rows[0].gstPercent, example.invoicePercent);
    assert.equal(figures.tax, example.invoiceTax);
    assert.equal(figures.total, order.total);
  });
});

test('CURRENT BEHAVIOUR: extended and unknown HSN codes fall back to 18% and can match invoices', function () {
  ['100630', 'UNKNOWN', undefined].forEach(function (hsn) {
    var order = billedOrder([{ id: 1, name: 'Fallback', hsn: hsn, price: 100, qty: 1 }], '');
    assert.equal(order.tax, 18);
    assert.equal(order.total, 118);
    assert.equal(invoice.computeInvoiceFigures(order).total, 118);
    var recon = reports.getGstReconciliation({ orders: [order] });
    assert.equal(recon.mismatchCount, 0);
    assert.equal(recon.rows[0].matched, true);
  });
});

test('invoice shows stored checkout GST while rounding displayed line GST', function () {
  var order = billedOrder([
    { id: 1, name: 'Small A', price: 0.03, qty: 1 },
    { id: 2, name: 'Small B', price: 0.03, qty: 1 }
  ], '');
  assert.deepEqual([order.tax, order.total], [0.02, 0.08]);
  var figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [0.02, 0.01, 0.01, 0.08]);
});

test('CURRENT BEHAVIOUR: HTML shows HSN GST and billed total with reconciliation notice', function () {
  var order = billedOrder([
    { id: 1, name: 'Rice', hsn: '1006', price: 2000, qty: 1 }
  ], 'SAVE10');
  var html = invoice.render(order);
  assert.ok(html.includes('<td class="r">5%</td>'));
  assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹92.50'));
  assert.ok(html.includes('Invoice Total</td><td class="r">₹1942.50'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
  assert.ok(!invoice.render(Object.assign({}, order, { total: 2124 })).includes('Accountant Reconciliation Notice:'));
  assert.ok(!invoice.render(Object.assign({}, order, { total: 2000 })).includes('Accountant Reconciliation Notice:'));
});

test('reconciliation uses stored invoice tax and HTML warns only on total', function () {
  var order = billedOrder([{ id: 1, name: 'Tea', hsn: '0902', price: 100, qty: 1 }], '');
  order.tax = 17;
  var recon = reports.getGstReconciliation({ orders: [order] });
  assert.deepEqual(recon, {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{ orderId: 1001, date: '15/11/2026', customer: 'Test Customer', coupon: '',
      ledgerSubtotal: 100, ledgerDiscount: 0, ledgerTax: 17, ledgerTotal: 118,
      invoiceDiscount: 0, invoiceTax: 17, invoiceTotal: 118, delta: 0, matched: true }]
  });
  assert.ok(!invoice.render(order).includes('Accountant Reconciliation Notice:'));
});

test('reconciliation skips cancellations when invoice matches billed total', function () {
  var order = billedOrder([{ id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }], '');
  var recon = reports.getGstReconciliation({ orders: [
    Object.assign({}, order, { id: 1, status: 'pending' }),
    Object.assign({}, order, { id: 2, total: 131 }),
    Object.assign({}, order, { id: 3, status: 'cancelled' })
  ] });
  assert.deepEqual([recon.totalChecked, recon.mismatchCount, recon.totalDelta], [2, 0, 0]);
  assert.deepEqual(recon.rows.map(function (row) {
    return [row.orderId, row.delta, row.matched];
  }), [[1, 0, true], [2, 0, true]]);
});
