var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

// Synthetic fixtures only. Do not import the store or read the application database.
function order(items, coupon, saved) {
  return Object.assign({
    id: 42,
    date: '2022-01-05',
    customer: 'Test Customer',
    paymentMode: 'cash',
    items: items,
    coupon: coupon || ''
  }, saved || {});
}

function item(price, hsn, extra) {
  return Object.assign({ id: 1, name: 'Test item', price: price, qty: 1, hsn: hsn }, extra || {});
}

function amounts(figures) {
  return {
    subtotal: figures.subtotal,
    discount: figures.discount,
    tax: figures.tax,
    cgst: figures.cgst,
    sgst: figures.sgst,
    total: figures.total
  };
}

test('Invoice uses HSN-specific 5%, 12%, and 18% rates like checkout', function () {
  var items = [item(100, '1006'), item(100, '0405'), item(100, '0902')];
  assert.deepEqual(amounts(pricing.computeTotals(items, '')), {
    subtotal: 300, discount: 0, tax: 35, cgst: 17.5, sgst: 17.5, total: 335
  });
  var actual = invoice.computeInvoiceFigures(order(items));
  assert.deepEqual(amounts(actual), {
    subtotal: 300, discount: 0, tax: 35, cgst: 17.5, sgst: 17.5, total: 335
  });
  assert.deepEqual(actual.rows.map(function (row) { return row.gstPercent; }), [5, 12, 18]);
});

test('Invoice applies SAVE10 before calculating GST like checkout', function () {
  // Synthetic equivalent of the amounts in ticket #1, not a database record.
  var items = [item(1020, '1006')];
  assert.deepEqual(amounts(pricing.computeTotals(items, 'SAVE10')), {
    subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9
  });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order(items, 'SAVE10'))), {
    subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9
  });
});

test('Invoice respects SAVE10 maximum discount on groundnut oil', function () {
  var items = [item(2240, '1508')];
  assert.deepEqual(amounts(pricing.computeTotals(items, 'SAVE10')), {
    subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5
  });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order(items, 'SAVE10'))), {
    subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5
  });
});

[
  { label: 'below-minimum SAVE10', price: 100, code: 'SAVE10', discount: 0, total: 118 },
  { label: 'inactive DIWALI20', price: 1000, code: 'DIWALI20', discount: 0, total: 1180 },
  { label: 'flat coupon below minimum and larger than subtotal', price: 20, code: 'FLAT50', discount: 0, total: 23.6 },
  { label: 'unrecognised coupon', price: 100, code: 'UNKNOWN', discount: 0, total: 118 },
  { label: 'unnormalised coupon', price: 1000, code: ' save10 ', discount: 100, total: 1062 }
].forEach(function (example) {
  test('Invoice follows checkout coupon handling for ' + example.label, function () {
    var actual = invoice.computeInvoiceFigures(order([item(example.price, '0902')], example.code));
    assert.equal(actual.discount, example.discount);
    assert.equal(actual.total, example.total);
  });
});

test('Invoice calculates GST after a flat discount like checkout', function () {
  var items = [item(500, '0902')];
  assert.deepEqual(amounts(pricing.computeTotals(items, 'FLAT50')), {
    subtotal: 500, discount: 50, tax: 81, cgst: 40.5, sgst: 40.5, total: 531
  });
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order(items, 'FLAT50'))), {
    subtotal: 500, discount: 50, tax: 81, cgst: 40.5, sgst: 40.5, total: 531
  });
});

test('Invoice resolves percent, decimal, and zero gstRate like checkout', function () {
  [
    { rate: 5, invoiceTax: 5, percent: 5, checkoutTax: 5 },
    { rate: 0.05, invoiceTax: 5, percent: 5, checkoutTax: 5 },
    { rate: 0, invoiceTax: 0, percent: 0, checkoutTax: 0 }
  ].forEach(function (example) {
    var items = [item(100, '1006', { gstRate: example.rate })];
    var actual = invoice.computeInvoiceFigures(order(items));
    assert.equal(actual.tax, example.invoiceTax);
    assert.equal(actual.rows[0].gstPercent, example.percent);
    assert.equal(pricing.computeTotals(items, '').tax, example.checkoutTax);
  });
});

test('Invoice sums rounded row taxes like checkout', function () {
  var items = [item(0.03, '0902'), item(0.03, '0902')];
  var actual = invoice.computeInvoiceFigures(order(items));
  assert.deepEqual(actual.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
  assert.deepEqual(amounts(actual), {
    subtotal: 0.06, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08
  });
  assert.equal(pricing.computeTotals(items, '').tax, 0.02);
});

test('CURRENT BEHAVIOUR: saved subtotal, discount, tax, and total do not control invoice figures', function () {
  var input = order([item(100, '0902')], '', { subtotal: 999, discount: 99, tax: 1, total: 901 });
  var before = structuredClone(input);
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(input)), {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118
  });
  assert.deepEqual(input, before);
});

test('Rendered invoice shows billed totals and warns for a genuinely different ledger total', function () {
  var items = [item(1020, '1006')];
  var html = invoice.render(order(items, 'SAVE10', { total: 963.9 }));
  assert.match(html, /Invoice Total<\/td><td class="r">₹963\.90<\/td>/);
  assert.match(html, /CGST \+ SGST \(Total GST\)<\/td><td class="r">₹45\.90/);
  assert.match(html, /Coupon Discount \(SAVE10\).*?-₹102\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
  assert.match(invoice.render(order(items, 'SAVE10', { total: 1100 })), /by -₹136\.10/);
  assert.match(invoice.render(order(items, 'SAVE10', { total: 900 })), /by \+₹63\.90/);
});

test('CURRENT BEHAVIOUR: rendered notice checks total only, even when saved GST differs', function () {
  var html = invoice.render(order([item(100, '0902')], '', { total: 118, tax: 0 }));
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
  assert.match(html, /Total GST\)<\/td><td class="r">₹18\.00/);
});

test('CURRENT BEHAVIOUR: all-18-percent cart without a coupon matches checkout', function () {
  var items = [item(100, '0902'), item(50, '0901', { qty: 2 })];
  assert.deepEqual(amounts(invoice.computeInvoiceFigures(order(items))), amounts(pricing.computeTotals(items, '')));
});

test('CURRENT BEHAVIOUR: missing items produce zero figures and no rows', function () {
  assert.deepEqual(invoice.computeInvoiceFigures({}), {
    subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: []
  });
});
