var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');
var coupons = require('../lib/coupons');
var reports = require('../lib/reports');

// Synthetic fixtures only. Do not import server.js, routes, store.js, or database data.
// Literal expectations cover the invoice fix and explicitly named remaining behaviour.
function item(overrides) {
  return Object.assign({
    id: 1, sku: 'TEST-1', name: 'Test item', hsn: '1006', price: 100, qty: 1
  }, overrides);
}

function order(items, coupon, totals) {
  return Object.assign({
    id: 1, date: '01/01/2026', customer: 'Test customer',
    status: 'completed', paymentMode: 'cash', items: items, coupon: coupon || ''
  }, totals);
}

function figures(result) {
  return {
    subtotal: result.subtotal, discount: result.discount, tax: result.tax,
    cgst: result.cgst, sgst: result.sgst, total: result.total
  };
}

test('REGRESSION: discounted mixed-HSN invoice matches checkout total and GST breakdown', function () {
  var items = [item({ price: 600 }), item({ id: 2, hsn: '0405', price: 400 })];
  var billed = pricing.computeTotals(items, 'SAVE10');
  var saved = order(items, 'SAVE10', billed);
  var expected = { subtotal: 1000, discount: 100, tax: 70.2, cgst: 35.1, sgst: 35.1, total: 970.2 };
  assert.deepEqual(figures(billed), expected);
  var result = invoice.computeInvoiceFigures(saved);
  assert.deepEqual(figures(result), expected);
  assert.deepEqual(result.rows.map(function (row) { return row.lineTax; }), [27, 43.2]);
  var html = invoice.render(saved);
  assert.ok(html.includes('<td>CGST</td><td class="r">\u20b935.10</td>'));
  assert.ok(html.includes('<td>SGST</td><td class="r">\u20b935.10</td>'));
  assert.ok(html.includes('<td>Invoice Total</td><td class="r">\u20b9970.20</td>'));
  assert.equal(html.includes('Accountant Reconciliation Notice:'), false);
});

test('invoice returns zero figures and no rows for an empty order', function () {
  assert.deepEqual(invoice.computeInvoiceFigures({}), {
    subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: []
  });
});

test('explicit percentage GST produces line figures and a CGST/SGST split', function () {
  var result = invoice.computeInvoiceFigures(order([item({ gstRate: 5, qty: 2 })]));
  assert.deepEqual(figures(result), {
    subtotal: 200, discount: 0, tax: 10, cgst: 5, sgst: 5, total: 210
  });
  assert.deepEqual(result.rows, [{
    name: 'Test item', sku: 'TEST-1', hsn: '1006', qty: 2, price: 100,
    gstPercent: 5, line: 200, lineTax: 10
  }]);
});

test('invoice uses the same mixed HSN slabs as checkout', function () {
  var items = [item(), item({ id: 2, hsn: '0405' }), item({ id: 3, hsn: '0902' })];
  var billed = pricing.computeTotals(items, '');
  assert.deepEqual(figures(billed), {
    subtotal: 300, discount: 0, tax: 35, cgst: 17.5, sgst: 17.5, total: 335
  });
  var result = invoice.computeInvoiceFigures(order(items, '', billed));
  assert.deepEqual(figures(result), {
    subtotal: 300, discount: 0, tax: 35, cgst: 17.5, sgst: 17.5, total: 335
  });
  assert.deepEqual(result.rows.map(function (row) { return row.gstPercent; }), [5, 12, 18]);
  assert.deepEqual(result.rows.map(function (row) { return row.lineTax; }), [5, 12, 18]);
});

test('invoice respects zero explicit GST', function () {
  var items = [item({ gstRate: 0 })];
  assert.equal(pricing.computeTotals(items, '').tax, 0);
  var result = invoice.computeInvoiceFigures(order(items));
  assert.equal(result.tax, 0);
  assert.equal(result.total, 100);
  assert.equal(result.rows[0].gstPercent, 0);
});

test('invoice accepts decimal GST in the same units as checkout', function () {
  var items = [item({ gstRate: 0.05 })];
  assert.equal(pricing.computeTotals(items, '').tax, 5);
  var result = invoice.computeInvoiceFigures(order(items));
  assert.deepEqual(figures(result), {
    subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105
  });
  assert.equal(result.rows[0].gstPercent, 5);
});

test('invoice applies percentage coupon before tax and respects its cap', function () {
  var items = [item({ price: 2000 })];
  var billed = pricing.computeTotals(items, 'SAVE10');
  assert.deepEqual(figures(billed), {
    subtotal: 2000, discount: 150, tax: 92.5, cgst: 46.25, sgst: 46.25, total: 1942.5
  });
  assert.deepEqual(figures(invoice.computeInvoiceFigures(order(items, 'SAVE10', billed))), {
    subtotal: 2000, discount: 150, tax: 92.5, cgst: 46.25, sgst: 46.25, total: 1942.5
  });
});

test('flat coupon reduces invoice taxable value', function () {
  var items = [item({ price: 400, gstRate: 5 })];
  var billed = pricing.computeTotals(items, 'FLAT50');
  assert.deepEqual(figures(billed), {
    subtotal: 400, discount: 50, tax: 17.5, cgst: 8.75, sgst: 8.75, total: 367.5
  });
  var result = invoice.computeInvoiceFigures(order(items, 'FLAT50', billed));
  assert.deepEqual(figures(result), {
    subtotal: 400, discount: 50, tax: 17.5, cgst: 8.75, sgst: 8.75, total: 367.5
  });
  assert.equal(result.rows[0].lineTax, 17.5);
});

test('invoice pricing ignores an inactive coupon', function () {
  var items = [item({ price: 1000 })];
  assert.equal(coupons.validate('DIWALI20', 1000).valid, false);
  assert.deepEqual(figures(invoice.computeInvoiceFigures(order(items, 'DIWALI20'))), {
    subtotal: 1000, discount: 0, tax: 50, cgst: 25, sgst: 25, total: 1050
  });
});

test('invoice ignores a below-minimum coupon instead of producing a negative total', function () {
  assert.equal(coupons.validate('FLAT50', 10).valid, false);
  assert.deepEqual(figures(invoice.computeInvoiceFigures(order([item({ price: 10 })], 'FLAT50'))), {
    subtotal: 10, discount: 0, tax: 0.5, cgst: 0.25, sgst: 0.25, total: 10.5
  });
});

test('invoice pricing normalizes coupon codes', function () {
  var items = [item({ price: 500 })];
  assert.equal(coupons.validate(' save10 ', 500).valid, true);
  assert.equal(pricing.computeTotals(items, ' save10 ').discount, 50);
  assert.deepEqual(figures(invoice.computeInvoiceFigures(order(items, ' save10 '))), {
    subtotal: 500, discount: 50, tax: 22.5, cgst: 11.25, sgst: 11.25, total: 472.5
  });
});

test('unknown coupon leaves invoice figures undiscounted', function () {
  assert.equal(invoice.computeInvoiceFigures(order([item()], 'NOT-A-COUPON')).discount, 0);
});

test('CURRENT BEHAVIOUR: stored billed figures are ignored and the input order is preserved', function () {
  var saved = order([item()], '', { subtotal: 80, discount: 10, tax: 4, total: 74 });
  var before = JSON.parse(JSON.stringify(saved));
  assert.deepEqual(figures(invoice.computeInvoiceFigures(saved)), {
    subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105
  });
  assert.deepEqual(saved, before);
});

test('invoice sums rounded line taxes consistently with checkout', function () {
  var items = [item({ price: 0.03 }), item({ price: 0.03 }), item({ price: 0.03 })];
  assert.equal(pricing.computeTotals(items, '').tax, 0);
  var result = invoice.computeInvoiceFigures(order(items));
  assert.deepEqual(result.rows.map(function (row) { return row.lineTax; }), [0, 0, 0]);
  assert.deepEqual(figures(result), {
    subtotal: 0.09, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0.09
  });
});

test('HTML shows the billed total and separate CGST and SGST without a mismatch notice', function () {
  var saved = order([item()], '', { subtotal: 100, discount: 0, tax: 5, total: 105 });
  var html = invoice.render(saved);
  assert.ok(html.includes('<td>Invoice Total</td><td class="r">\u20b9105.00</td>'));
  assert.ok(html.includes('<td>CGST + SGST (Total GST)</td><td class="r">\u20b95.00</td>'));
  assert.equal(html.includes('Accountant Reconciliation Notice:'), false);
  assert.ok(html.includes('<td>CGST</td><td class="r">\u20b92.50</td>'));
  assert.ok(html.includes('<td>SGST</td><td class="r">\u20b92.50</td>'));
});

test('CURRENT BEHAVIOUR: HTML suppresses a tax-only mismatch that reconciliation detects', function () {
  var saved = order([item({ gstRate: 18 })], '', {
    subtotal: 100, discount: 0, tax: 17, total: 118
  });
  assert.equal(invoice.render(saved).includes('Accountant Reconciliation Notice:'), false);
  var result = reports.getGstReconciliation({ orders: [saved] });
  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 1);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].matched, false);
  assert.equal(result.rows[0].ledgerTax, 17);
  assert.equal(result.rows[0].invoiceTax, 18);
});

test('matching billed figures produce no reconciliation notice', function () {
  var saved = order([item({ gstRate: 18 })], '', {
    subtotal: 100, discount: 0, tax: 18, total: 118
  });
  assert.equal(invoice.render(saved).includes('Accountant Reconciliation Notice:'), false);
  assert.equal(reports.getGstReconciliation({ orders: [saved] }).mismatchCount, 0);
});
