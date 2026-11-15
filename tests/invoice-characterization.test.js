var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var orders = require('../lib/orders');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

// Only domain modules are imported. Every order and database is an in-memory
// fixture; neither the server nor the file-backed store is used.
function billedOrder(items, coupon) {
  var totals = pricing.computeTotals(items, coupon);
  return orders.add({ nextOrderId: 1, orders: [] }, {
    date: '15/11/2026',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  });
}

test('invoice uses the same 5%, 12%, and fallback HSN slabs as billing', function () {
  var order = billedOrder([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 },
    { id: 2, name: 'Ghee', hsn: '0405', price: 100, qty: 1 },
    { id: 3, name: 'Tea', hsn: '0902', price: 100, qty: 1 },
    { id: 4, name: 'Other', hsn: 'unknown', price: 100, qty: 1 }
  ]);
  assert.equal(order.subtotal, 500);
  assert.equal(order.tax, 58);
  assert.equal(order.total, 558);
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 500, discount: 0, tax: 58, cgst: 29, sgst: 29, total: 558,
    rows: [
      { name: 'Rice', sku: '-', hsn: '1006', qty: 2, price: 100, gstPercent: 5, line: 200, lineTax: 10 },
      { name: 'Ghee', sku: '-', hsn: '0405', qty: 1, price: 100, gstPercent: 12, line: 100, lineTax: 12 },
      { name: 'Tea', sku: '-', hsn: '0902', qty: 1, price: 100, gstPercent: 18, line: 100, lineTax: 18 },
      { name: 'Other', sku: '-', hsn: 'unknown', qty: 1, price: 100, gstPercent: 18, line: 100, lineTax: 18 }
    ]
  });
});

test('uncapped percentage coupon gives matching totals and GST breakdowns', function () {
  var items = [{ name: 'Tea', hsn: '0902', price: 1000, qty: 1 }];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var figures = invoice.computeInvoiceFigures(billedOrder(items, 'SAVE10'));
  assert.deepEqual(billed.lines[0], {
    id: undefined, name: 'Tea', hsn: '0902', gstPercent: 18,
    gross: 1000, discount: 100, taxable: 900, tax: 162, net: 1062
  });
  assert.deepEqual([billed.discount, billed.tax, billed.cgst, billed.sgst, billed.total],
    [100, 162, 81, 81, 1062]);
  assert.deepEqual([figures.discount, figures.tax, figures.cgst, figures.sgst, figures.total],
    [100, 162, 81, 81, 1062]);
});

test('invoice caps percentage discounts before GST', function () {
  var order = billedOrder([{ name: 'Tea', hsn: '0902', price: 2000, qty: 1 }], 'SAVE10');
  assert.deepEqual([order.discount, order.tax, order.total], [150, 333, 2183]);
  var figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [150, 333, 2183]);
});

test('flat coupon reduces the invoice GST taxable base', function () {
  var order = billedOrder([{ name: 'Tea', hsn: '0902', price: 500, qty: 1 }], 'FLAT50');
  assert.deepEqual([order.discount, order.tax, order.total], [50, 81, 531]);
  var figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual([figures.discount, figures.tax, figures.total], [50, 81, 531]);
});

test('invoice rejects below-minimum and expired coupons without negative totals', function () {
  [
    { coupon: 'SAVE10', price: 100, discount: 0, total: 118 },
    { coupon: 'DIWALI20', price: 1000, discount: 0, total: 1180 },
    { coupon: 'FLAT50', price: 10, discount: 0, total: 11.8 }
  ].forEach(function (example) {
    // Direct domain fixtures represent stored/legacy orders, not API acceptance.
    var order = billedOrder([{ name: 'Tea', hsn: '0902', price: example.price, qty: 1 }], example.coupon);
    assert.equal(order.discount, 0);
    var figures = invoice.computeInvoiceFigures(order);
    assert.equal(figures.discount, example.discount);
    assert.equal(figures.total, example.total);
  });
});

test('invoice normalizes stored coupon codes like billing', function () {
  var order = billedOrder([{ name: 'Tea', price: 1000, qty: 1 }], ' save10 ');
  assert.equal(order.discount, 100);
  assert.equal(order.total, 1062);
  var figures = invoice.computeInvoiceFigures(order);
  assert.equal(figures.discount, 100);
  assert.equal(figures.total, 1062);
});

test('invoice and billing agree for percentage, decimal, and zero GST rates', function () {
  [
    { rate: 5, billedTax: 5, invoiceTax: 5, invoicePercent: 5 },
    { rate: 0.05, billedTax: 5, invoiceTax: 5, invoicePercent: 5 },
    { rate: 0, billedTax: 0, invoiceTax: 0, invoicePercent: 0 }
  ].forEach(function (example) {
    var order = billedOrder([{ name: 'Custom rate', price: 100, qty: 1, gstRate: example.rate }]);
    var figures = invoice.computeInvoiceFigures(order);
    assert.equal(order.tax, example.billedTax);
    assert.equal(figures.tax, example.invoiceTax);
    assert.equal(figures.rows[0].gstPercent, example.invoicePercent);
  });
});

test('invoice rounds GST per line like billing', function () {
  var order = billedOrder([
    { name: 'Small A', price: 0.03, qty: 1 },
    { name: 'Small B', price: 0.03, qty: 1 }
  ]);
  assert.deepEqual([order.tax, order.total], [0.02, 0.08]);
  var figures = invoice.computeInvoiceFigures(order);
  assert.deepEqual(figures.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.deepEqual([figures.tax, figures.cgst, figures.sgst, figures.total], [0.02, 0.01, 0.01, 0.08]);
});

test('CURRENT BEHAVIOUR: invoice recomputes figures rather than using stored billing totals', function () {
  var order = billedOrder([{ name: 'Tea', price: 100, qty: 1 }]);
  var before = invoice.computeInvoiceFigures(order);
  order.subtotal = 999;
  order.discount = 99;
  order.tax = 77;
  order.total = 888;
  assert.deepEqual(invoice.computeInvoiceFigures(order), before);
  assert.equal(order.total, 888);
});

test('HTML displays matching totals and GST without a ledger discrepancy', function () {
  [
    { hsn: '1006', price: 2000, coupon: 'SAVE10', total: '1942.50', tax: '92.50' },
    { hsn: '0902', price: 2000, coupon: 'SAVE10', total: '2183.00', tax: '333.00' }
  ].forEach(function (example) {
    var order = billedOrder([{ name: 'Item', hsn: example.hsn, price: example.price, qty: 1 }], example.coupon);
    var snapshot = JSON.stringify(order);
    var html = invoice.render(order);
    assert.ok(html.includes('<tr class="grand"><td>Invoice Total</td><td class="r">₹' + example.total + '</td></tr>'));
    assert.ok(html.includes('CGST + SGST (Total GST)</td><td class="r">₹' + example.tax));
    assert.ok(!html.includes('Accountant Reconciliation Notice:'));
    assert.equal(JSON.stringify(order), snapshot);
  });
});

test('reconciliation matches both GST and totals for a percentage coupon', function () {
  var order = billedOrder([{ name: 'Tea', price: 1000, qty: 1 }], 'SAVE10');
  var recon = reports.getGstReconciliation({ orders: [order] });
  assert.deepEqual(recon, {
    totalChecked: 1, mismatchCount: 0, totalDelta: 0,
    rows: [{
      orderId: 1, date: '15/11/2026', customer: 'Walk-in', coupon: 'SAVE10',
      ledgerSubtotal: 1000, ledgerDiscount: 100, ledgerTax: 162, ledgerTotal: 1062,
      invoiceDiscount: 100, invoiceTax: 162, invoiceTotal: 1062, delta: 0, matched: true
    }]
  });
  assert.ok(!invoice.render(order).includes('Accountant Reconciliation Notice:'));
});

test('CURRENT BEHAVIOUR: reconciliation adds absolute total deltas, includes pending, and skips cancelled orders', function () {
  var over = billedOrder([{ name: 'Rice', hsn: '1006', price: 2000, qty: 1 }], 'SAVE10');
  var under = billedOrder([{ name: 'Tea', price: 2000, qty: 1 }], 'SAVE10');
  under.id = 2;
  under.status = 'pending';
  // Deliberately inconsistent ledger figures still exercise reconciliation.
  over.total -= 10;
  under.total += 20;
  var cancelled = Object.assign({}, over, { id: 3, status: 'cancelled' });
  var matched = billedOrder([{ name: 'Tea', price: 100, qty: 1 }]);
  matched.id = 4;
  var recon = reports.getGstReconciliation({ orders: [over, under, cancelled, matched] });
  assert.equal(recon.totalChecked, 3);
  assert.equal(recon.mismatchCount, 2);
  assert.equal(recon.totalDelta, 30);
  assert.deepEqual(recon.rows.map(function (row) {
    return [row.orderId, row.delta, row.matched];
  }), [[1, 10, false], [2, -20, false], [4, 0, true]]);
});
