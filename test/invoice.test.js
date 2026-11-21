var test = require('node:test');
var assert = require('node:assert/strict');
var invoice = require('../lib/invoice');
var pricing = require('../lib/pricing');

// Synthetic fixtures only. These modules do not load the JSON store.
function item(overrides) {
  return Object.assign({
    id: 1, name: 'Test rice', sku: 'TEST-01', hsn: '1006', price: 100, qty: 1
  }, overrides);
}

function order(items, coupon) {
  var billed = pricing.computeTotals(items, coupon);
  return {
    id: 42, date: '21/11/2026', customer: 'Test Customer',
    paymentMode: 'cash', status: 'completed', items: items, coupon: coupon || '',
    subtotal: billed.subtotal, discount: billed.discount,
    tax: billed.tax, total: billed.total
  };
}

function totals(figures) {
  return {
    subtotal: figures.subtotal, discount: figures.discount, tax: figures.tax,
    cgst: figures.cgst, sgst: figures.sgst, total: figures.total
  };
}

test('REGRESSION: invoice total and GST match the billed HSN order', function () {
  var fixture = order([item()]);
  var printed = invoice.computeInvoiceFigures(fixture);
  assert.deepEqual(totals(printed), {
    subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105
  });
  assert.deepEqual([printed.rows[0].gstPercent, printed.rows[0].lineTax], [5, 5]);
});

test('REGRESSION: mixed HSN slabs and a capped coupon match billed figures', function () {
  var items = [
    item({ price: 1000 }),
    item({ id: 2, name: 'Test ghee', hsn: '0405', price: 500 }),
    item({ id: 3, name: 'Test tea', hsn: '0902', price: 500 })
  ];
  var billed = pricing.computeTotals(items, 'SAVE10');
  assert.deepEqual(totals(billed), {
    subtotal: 2000, discount: 150, tax: 185, cgst: 92.5, sgst: 92.5, total: 2035
  });
  assert.deepEqual(billed.lines.map(function (line) {
    return [line.gstPercent, line.discount, line.taxable, line.tax];
  }), [[5, 75, 925, 46.25], [12, 37.5, 462.5, 55.5], [18, 37.5, 462.5, 83.25]]);

  var printed = invoice.computeInvoiceFigures(order(items, 'SAVE10'));
  assert.deepEqual(totals(printed), {
    subtotal: 2000, discount: 150, tax: 185, cgst: 92.5, sgst: 92.5, total: 2035
  });
  assert.deepEqual(printed.rows.map(function (row) {
    return [row.hsn, row.gstPercent, row.line, row.lineTax];
  }), [['1006', 5, 1000, 46.25], ['0405', 12, 500, 55.5], ['0902', 18, 500, 83.25]]);
});

test('CURRENT BEHAVIOUR: invoice ignores stored monetary figures and does not mutate the order', function () {
  var fixture = order([item()], '');
  Object.assign(fixture, { subtotal: 999, discount: 888, tax: 777, total: 666 });
  var before = JSON.stringify(fixture);
  assert.deepEqual(invoice.computeInvoiceFigures(fixture), {
    subtotal: 100, discount: 0, tax: 5, cgst: 2.5, sgst: 2.5, total: 105,
    rows: [{ name: 'Test rice', sku: 'TEST-01', hsn: '1006', qty: 1,
      price: 100, gstPercent: 5, line: 100, lineTax: 5 }]
  });
  invoice.render(fixture);
  assert.equal(JSON.stringify(fixture), before);
});

[
  { name: 'percentage GST override', rate: 5, invoiceTax: 5, invoiceTotal: 105, percent: 5, billedTotal: 105 },
  { name: 'decimal GST override matches checkout', rate: 0.05, invoiceTax: 5, invoiceTotal: 105, percent: 5, billedTotal: 105 },
  { name: 'zero GST override remains tax exempt', rate: 0, invoiceTax: 0, invoiceTotal: 100, percent: 0, billedTotal: 100 }
].forEach(function (example) {
  test('REGRESSION: ' + example.name, function () {
    var fixture = order([item({ gstRate: example.rate })]);
    var printed = invoice.computeInvoiceFigures(fixture);
    assert.equal(fixture.total, example.billedTotal);
    assert.equal(printed.tax, example.invoiceTax);
    assert.equal(printed.total, example.invoiceTotal);
    assert.equal(printed.rows[0].gstPercent, example.percent);
  });
});

[
  { name: 'percentage discount reduces taxable value', price: 1000, coupon: 'SAVE10', billed: [100, 162, 1062], printed: [100, 162, 1062] },
  { name: 'percentage discount respects the cap', price: 2000, coupon: 'SAVE10', billed: [150, 333, 2183], printed: [150, 333, 2183] },
  { name: 'coupon minimum is respected', price: 100, coupon: 'SAVE10', billed: [0, 18, 118], printed: [0, 18, 118] },
  { name: 'inactive coupon is ignored', price: 1000, coupon: 'DIWALI20', billed: [0, 180, 1180], printed: [0, 180, 1180] },
  { name: 'flat discount reduces taxable value', price: 300, coupon: 'FLAT50', billed: [50, 45, 295], printed: [50, 45, 295] },
  { name: 'ineligible flat discount cannot make invoice total negative', price: 20, coupon: 'FLAT50', billed: [0, 3.6, 23.6], printed: [0, 3.6, 23.6] },
  { name: 'invoice normalizes coupon whitespace and case', price: 1000, coupon: ' save10 ', billed: [100, 162, 1062], printed: [100, 162, 1062] },
  { name: 'unknown coupon gives no discount', price: 100, coupon: 'UNKNOWN', billed: [0, 18, 118], printed: [0, 18, 118] }
].forEach(function (example) {
  test('REGRESSION: ' + example.name, function () {
    // Direct calculator inputs characterize legacy orders too; checkout rejects
    // invalid coupons before calling its calculator.
    var fixture = order([item({ hsn: '0902', price: example.price })], example.coupon);
    var printed = invoice.computeInvoiceFigures(fixture);
    assert.deepEqual([fixture.discount, fixture.tax, fixture.total], example.billed);
    assert.deepEqual([printed.discount, printed.tax, printed.total], example.printed);
  });
});

test('REGRESSION: invoice sums rounded row taxes like checkout', function () {
  var fixture = order([
    item({ hsn: '0902', price: 0.03 }),
    item({ id: 2, hsn: '0902', price: 0.03 })
  ]);
  var printed = invoice.computeInvoiceFigures(fixture);
  assert.deepEqual([fixture.tax, fixture.total], [0.02, 0.08]);
  assert.deepEqual(totals(printed), {
    subtotal: 0.06, discount: 0, tax: 0.02, cgst: 0.01, sgst: 0.01, total: 0.08
  });
  assert.deepEqual(printed.rows.map(function (row) { return row.lineTax; }), [0.01, 0.01]);
});

test('CURRENT BEHAVIOUR: unknown HSN uses the default rate in both calculators', function () {
  var fixture = order([item({ hsn: 'UNKNOWN' })]);
  var printed = invoice.computeInvoiceFigures(fixture);
  assert.deepEqual([fixture.tax, fixture.total], [18, 118]);
  assert.deepEqual(totals(printed), {
    subtotal: 100, discount: 0, tax: 18, cgst: 9, sgst: 9, total: 118
  });
});

test('CURRENT BEHAVIOUR: absent items yield zero figures despite stored totals', function () {
  assert.deepEqual(invoice.computeInvoiceFigures({ total: 500, tax: 50 }), {
    subtotal: 0, discount: 0, tax: 0, cgst: 0, sgst: 0, total: 0, rows: []
  });
});

test('REGRESSION: printed invoice shows billed GST and total without a mismatch notice', function () {
  var html = invoice.render(order([item()]));
  assert.match(html, /<td class="r">5%<\/td>/);
  assert.match(html, /Total GST\)<\/td><td class="r">[^<]*5\.00<\/td>/);
  assert.match(html, /Invoice Total<\/td><td class="r">[^<]*105\.00<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice:/);
});

test('REGRESSION: percentage coupon matches both the total and GST', function () {
  var fixture = order([item({ hsn: '0902', price: 1000 })], 'SAVE10');
  var printed = invoice.computeInvoiceFigures(fixture);
  assert.deepEqual([fixture.total, printed.total], [1062, 1062]);
  assert.deepEqual([fixture.tax, printed.tax], [162, 162]);
  assert.doesNotMatch(invoice.render(fixture), /Accountant Reconciliation Notice:/);
});
