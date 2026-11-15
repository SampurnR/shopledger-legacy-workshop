var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('./invoice');
var pricing = require('./pricing');

// Synthetic fixtures only: no store, server, or persisted order data is loaded.
function item(overrides) {
  return Object.assign({ name: 'Rice', sku: 'RICE', hsn: '1006', price: 100, qty: 1 }, overrides);
}

function figures(items, coupon) {
  return invoice.computeInvoiceFigures({ items: items, coupon: coupon });
}

test('CURRENT BEHAVIOUR: #1002 invoice matches the billed ledger', function () {
  var items = [item({ price: 510, qty: 2 })];
  var billed = pricing.computeTotals(items, 'SAVE10');
  assert.equal(billed.discount, 102);
  assert.equal(billed.tax, 45.90);
  assert.equal(billed.total, 963.90);
  var order = Object.assign({}, billed, {
    id: 1002, customer: 'Anil Kulkarni', items: items, coupon: 'SAVE10'
  });
  assert.deepEqual(invoice.computeInvoiceFigures(order), {
    subtotal: 1020, discount: 102, tax: 45.90,
    cgst: 22.95, sgst: 22.95, total: 963.90,
    rows: [{ name: 'Rice', sku: 'RICE', hsn: '1006', qty: 2, price: 510,
      gstPercent: 5, line: 1020, lineTax: 45.90 }]
  });
});

test('CURRENT BEHAVIOUR: SAVE10 on Rs 2240 respects the Rs 150 cap and taxes after discount', function () {
  var items = [item({ price: 2240 })];
  assert.equal(pricing.computeTotals(items, 'SAVE10').discount, 150);
  var actual = figures(items, 'SAVE10');
  assert.equal(actual.subtotal, 2240);
  assert.equal(actual.tax, 104.50);
  assert.equal(actual.discount, 150);
  assert.equal(actual.total, 2194.50);
});

test('CURRENT BEHAVIOUR: non-coupon items use their 5% and 12% HSN slabs', function () {
  var items = [item(), item({ name: 'Ghee', hsn: '0405', price: 200 })];
  assert.equal(pricing.computeTotals(items).tax, 29);
  var actual = figures(items);
  assert.deepEqual(actual.rows.map(function (row) { return row.gstPercent; }), [5, 12]);
  assert.deepEqual(actual.rows.map(function (row) { return row.lineTax; }), [5, 24]);
  assert.equal(actual.tax, 29);
  assert.equal(actual.total, 329);
});

test('CURRENT BEHAVIOUR: all-18% HSN items without a coupon agree with checkout', function () {
  var items = [item({ hsn: '0902', price: 125, qty: 2 }), item({ hsn: '0901', price: 100 })];
  var actual = figures(items);
  var billed = pricing.computeTotals(items);
  assert.equal(actual.subtotal, 350);
  assert.equal(actual.discount, 0);
  assert.equal(actual.tax, 63);
  assert.equal(actual.total, 413);
  assert.equal(actual.tax, billed.tax);
  assert.equal(actual.total, billed.total);
});

test('CURRENT BEHAVIOUR: explicit percentage GST overrides HSN and taxes after coupon', function () {
  var actual = figures([item({ price: 1000, gstRate: 5, hsn: '0902' })], 'SAVE10');
  assert.equal(actual.rows[0].gstPercent, 5);
  assert.equal(actual.rows[0].lineTax, 45);
  assert.equal(actual.tax, 45);
  assert.equal(actual.discount, 100);
  assert.equal(actual.total, 945);
});

test('CURRENT BEHAVIOUR: decimal and zero GST rates are respected', function () {
  var actual = figures([item({ gstRate: 0.05 }), item({ gstRate: 0 })]);
  assert.deepEqual(actual.rows.map(function (row) { return row.gstPercent; }), [5, 0]);
  assert.deepEqual(actual.rows.map(function (row) { return row.lineTax; }), [5, 0]);
  assert.equal(actual.tax, 5);
  assert.equal(actual.total, 205);
});

test('CURRENT BEHAVIOUR: coupon lookup normalizes case and whitespace and ignores unknown codes', function () {
  ['save10', ' SAVE10 '].forEach(function (code) {
    var actual = figures([item({ price: 1000 })], code);
    assert.equal(actual.discount, 100);
    assert.equal(actual.total, 945);
  });
  assert.equal(figures([item({ price: 1000 })], 'UNKNOWN').discount, 0);
});

test('CURRENT BEHAVIOUR: coupons below minimum and expired coupons do not apply', function () {
  var belowMinimum = figures([item()], 'SAVE10');
  assert.equal(belowMinimum.discount, 0);
  assert.equal(belowMinimum.total, 105);
  var expired = figures([item({ price: 1000 })], 'DIWALI20');
  assert.equal(expired.discount, 0);
  assert.equal(expired.total, 1050);
});

test('CURRENT BEHAVIOUR: flat discount below the coupon minimum is ignored', function () {
  var actual = figures([item({ price: 10 })], 'FLAT50');
  assert.equal(actual.discount, 0);
  assert.equal(actual.tax, 0.50);
  assert.equal(actual.total, 10.50);
});

test('CURRENT BEHAVIOUR: tax rounds per line and GST split rounds CGST first', function () {
  var actual = figures([item({ price: 0.03, gstRate: 18 }), item({ price: 0.03, gstRate: 18 }), item({ price: 0.03, gstRate: 18 })]);
  assert.deepEqual(actual.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01, 0.01]);
  assert.equal(actual.subtotal, 0.09);
  assert.equal(actual.tax, 0.03);
  assert.equal(actual.total, 0.12);
  var oddCent = figures([item({ price: 0.05, gstRate: 18 })]);
  assert.equal(oddCent.tax, 0.01);
  assert.equal(oddCent.cgst, 0.01);
  assert.equal(oddCent.sgst, 0);
});

test('CURRENT BEHAVIOUR: missing items return zeros and missing SKU/HSN use dashes', function () {
  assert.deepEqual(invoice.computeInvoiceFigures({}), {
    subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: []
  });
  assert.deepEqual(figures([{ name: 'Loose item', price: 10, qty: 2 }]).rows, [
    { name: 'Loose item', sku: '-', hsn: '-', qty: 2, price: 10,
      gstPercent: 18, line: 20, lineTax: 3.60 }
  ]);
});

test('invoice figures and rows match checkout for the same items and coupon', function () {
  var items = [item({ price: 510, qty: 2 })];
  var expected = pricing.computeTotals(items, 'SAVE10');
  var actual = figures(items, 'SAVE10');
  ['subtotal', 'discount', 'tax', 'cgst', 'sgst', 'total'].forEach(function (key) {
    assert.equal(actual[key], expected[key], key);
  });
  actual.rows.forEach(function (row, i) {
    assert.equal(row.line, expected.lines[i].gross);
    assert.equal(row.lineTax, expected.lines[i].tax);
    assert.equal(row.gstPercent, expected.lines[i].gstPercent);
  });
  var html = invoice.render(Object.assign({ id: 1002, items: items, coupon: 'SAVE10' }, expected));
  assert.ok(html.includes('₹963.90'));
  assert.ok(!html.includes('Accountant Reconciliation Notice:'));
});
